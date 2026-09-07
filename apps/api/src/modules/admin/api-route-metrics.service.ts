import { readFileSync } from 'fs';
import { join } from 'path';
import { Injectable, OnModuleInit, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';

export interface ApiControllerMetric {
  name: string;
  path: string;
  routes: number;
}

export interface ApiVersionInfo {
  api: string;
  nestjs: string;
  swagger: string;
  openapi: string;
  environment: string;
  port: number;
  publicUrl: string;
  docsPath: string;
  docsEnabled: boolean;
}

export interface ApiRouteMetrics {
  totalEndpoints: number;
  totalControllers: number;
  globalPrefix: string;
  byMethod: Record<string, number>;
  controllers: ApiControllerMetric[];
  version: ApiVersionInfo;
}

const METHOD_LABELS: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.HEAD]: 'HEAD',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.ALL]: 'ALL',
};

const DEFAULT_API_VERSION: ApiVersionInfo = {
  api: '0.1.0',
  nestjs: '11',
  swagger: '11',
  openapi: '0.1.0',
  environment: 'development',
  port: 4000,
  publicUrl: 'http://localhost:4000',
  docsPath: '/api/docs',
  docsEnabled: true,
};

@Injectable()
export class ApiRouteMetricsService implements OnModuleInit {
  private metrics: ApiRouteMetrics = {
    totalEndpoints: 0,
    totalControllers: 0,
    globalPrefix: 'api',
    byMethod: {},
    controllers: [],
    version: DEFAULT_API_VERSION,
  };

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const byMethod: Record<string, number> = {};
    const controllers: ApiControllerMetric[] = [];
    let totalEndpoints = 0;
    let totalControllers = 0;
    const globalPrefix = this.config.get<string>('app.globalPrefix') ?? 'api';

    for (const wrapper of this.discovery.getControllers()) {
      const { instance, metatype } = wrapper;
      if (!instance || !metatype) continue;

      let controllerRoutes = 0;
      const controllerPath =
        this.reflector.get<string | string[]>(PATH_METADATA, metatype) ?? '';

      this.metadataScanner.scanFromPrototype(
        instance,
        Object.getPrototypeOf(instance),
        (methodName) => {
          const handler = instance[methodName];
          const routePath = this.reflector.get<string | string[]>(
            PATH_METADATA,
            handler,
          );
          const requestMethod = this.reflector.get<RequestMethod>(
            METHOD_METADATA,
            handler,
          );
          if (routePath === undefined || requestMethod === undefined) return;

          controllerRoutes += 1;
          totalEndpoints += 1;
          const label = METHOD_LABELS[requestMethod] ?? String(requestMethod);
          byMethod[label] = (byMethod[label] ?? 0) + 1;
        },
      );

      if (controllerRoutes > 0) {
        totalControllers += 1;
        controllers.push({
          name: metatype.name.replace(/Controller$/, ''),
          path: this.normalizePath(controllerPath),
          routes: controllerRoutes,
        });
      }
    }

    controllers.sort((a, b) => b.routes - a.routes || a.name.localeCompare(b.name));

    this.metrics = {
      totalEndpoints,
      totalControllers,
      globalPrefix,
      byMethod,
      controllers,
      version: this.buildVersionInfo(globalPrefix),
    };
  }

  getMetrics(): ApiRouteMetrics {
    return this.metrics;
  }

  private normalizePath(path: string | string[]): string {
    const segment = Array.isArray(path) ? path.join('/') : path;
    if (!segment) return '/';
    return segment.startsWith('/') ? segment : `/${segment}`;
  }

  private buildVersionInfo(globalPrefix = 'api'): ApiVersionInfo {
    const env = this.config.get<string>('app.env') ?? 'development';
    const port = this.config.get<number>('app.port') ?? 4000;
    const publicUrl =
      this.config.get<string>('app.publicUrl') ?? 'http://localhost:4000';
    const apiVersion = this.readPackageVersion(process.cwd(), '0.1.0');

    return {
      api: apiVersion,
      nestjs: this.readDependencyVersion('@nestjs/core', '11'),
      swagger: this.readDependencyVersion('@nestjs/swagger', '11'),
      openapi: apiVersion,
      environment: env,
      port,
      publicUrl,
      docsPath: `/${globalPrefix}/docs`,
      docsEnabled: env !== 'production',
    };
  }

  private readPackageVersion(cwd: string, fallback: string): string {
    try {
      const pkg = JSON.parse(
        readFileSync(join(cwd, 'package.json'), 'utf8'),
      ) as { version?: string };
      return pkg.version ?? fallback;
    } catch {
      return fallback;
    }
  }

  private readDependencyVersion(moduleName: string, fallback: string): string {
    try {
      const pkgPath = require.resolve(`${moduleName}/package.json`);
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
        version?: string;
      };
      return pkg.version ?? fallback;
    } catch {
      return fallback;
    }
  }
}
