import { existsSync } from 'fs';
import { readdir, stat, statfs } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import * as os from 'node:os';
import { resolveUploadsRoot } from '../../shared/uploads/uploads-root';

export type MovieServerStorageBreakdown = {
  name: string;
  bytes: number;
  /** Samba mount roots are not summed into website storage. */
  external?: boolean;
};

export type MovieServerHostMetrics = {
  timestamp: string;
  cpu: {
    usagePercent: number | null;
    cores: number;
    load1: number;
    load5: number;
    load15: number;
  };
  memory: {
    totalMb: number;
    usedMb: number;
    freeMb: number;
    usedPercent: number;
    apiRssMb: number;
  };
  storage: {
    uploadsPath: string;
    diskTotalGb: number;
    diskUsedGb: number;
    diskFreeGb: number;
    diskUsedPercent: number;
    uploadsBytes: number;
    breakdown: MovieServerStorageBreakdown[];
    tempPlaybackBytes: number;
  };
};

const BREAKDOWN_CACHE_MS = 12_000;
const SKIP_DEEP_SCAN = new Set(['smb-mounts']);

@Injectable()
export class MovieServerHostMetricsService {
  private lastCpu: { idle: number; total: number } | null = null;
  private breakdownCache: { at: number; breakdown: MovieServerStorageBreakdown[]; uploadsBytes: number } | null =
    null;

  async snapshot(): Promise<MovieServerHostMetrics> {
    const uploadsPath = resolveUploadsRoot();
    const [disk, breakdownRow, tempPlaybackBytes] = await Promise.all([
      this.diskForPath(uploadsPath),
      this.uploadsBreakdown(uploadsPath),
      this.tempPlaybackBytes(),
    ]);

    const mem = this.hostMemory();
    return {
      timestamp: new Date().toISOString(),
      cpu: this.cpuSample(),
      memory: mem,
      storage: {
        uploadsPath,
        ...disk,
        uploadsBytes: breakdownRow.uploadsBytes,
        breakdown: breakdownRow.breakdown,
        tempPlaybackBytes,
      },
    };
  }

  private cpuSample(): MovieServerHostMetrics['cpu'] {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      const times = cpu.times;
      idle += times.idle;
      total += times.user + times.nice + times.sys + times.idle + times.irq;
    }

    let usagePercent: number | null = null;
    if (this.lastCpu) {
      const idleDiff = idle - this.lastCpu.idle;
      const totalDiff = total - this.lastCpu.total;
      if (totalDiff > 0) {
        usagePercent = Math.round((1 - idleDiff / totalDiff) * 1000) / 10;
        usagePercent = Math.min(100, Math.max(0, usagePercent));
      } else {
        usagePercent = 0;
      }
    }
    this.lastCpu = { idle, total };

    const [load1 = 0, load5 = 0, load15 = 0] = os.loadavg();
    return {
      usagePercent,
      cores: cpus.length,
      load1: Math.round(load1 * 100) / 100,
      load5: Math.round(load5 * 100) / 100,
      load15: Math.round(load15 * 100) / 100,
    };
  }

  private hostMemory(): MovieServerHostMetrics['memory'] {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    const toMb = (n: number) => Math.round((n / 1024 / 1024) * 100) / 100;
    const rss = process.memoryUsage().rss;
    return {
      totalMb: toMb(total),
      usedMb: toMb(used),
      freeMb: toMb(free),
      usedPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      apiRssMb: toMb(rss),
    };
  }

  private async diskForPath(path: string): Promise<{
    diskTotalGb: number;
    diskUsedGb: number;
    diskFreeGb: number;
    diskUsedPercent: number;
  }> {
    try {
      const fs = await statfs(path);
      const total = Number(fs.blocks) * Number(fs.bsize);
      const free = Number(fs.bfree) * Number(fs.bsize);
      const used = Math.max(0, total - free);
      const toGb = (n: number) => Math.round((n / 1024 / 1024 / 1024) * 100) / 100;
      return {
        diskTotalGb: toGb(total),
        diskUsedGb: toGb(used),
        diskFreeGb: toGb(free),
        diskUsedPercent: total > 0 ? Math.round((used / total) * 1000) / 10 : 0,
      };
    } catch {
      return { diskTotalGb: 0, diskUsedGb: 0, diskFreeGb: 0, diskUsedPercent: 0 };
    }
  }

  private async uploadsBreakdown(uploadsPath: string): Promise<{
    breakdown: MovieServerStorageBreakdown[];
    uploadsBytes: number;
  }> {
    const now = Date.now();
    if (this.breakdownCache && now - this.breakdownCache.at < BREAKDOWN_CACHE_MS) {
      return {
        breakdown: this.breakdownCache.breakdown,
        uploadsBytes: this.breakdownCache.uploadsBytes,
      };
    }

    const breakdown: MovieServerStorageBreakdown[] = [];
    let uploadsBytes = 0;
    const names = await readdir(uploadsPath).catch(() => [] as string[]);
    names.sort((a, b) => a.localeCompare(b));

    for (const name of names) {
      const full = join(uploadsPath, name);
      if (SKIP_DEEP_SCAN.has(name)) {
        breakdown.push({ name, bytes: 0, external: true });
        continue;
      }
      const bytes = await this.directoryBytes(full);
      breakdown.push({ name, bytes });
      uploadsBytes += bytes;
    }

    this.breakdownCache = { at: now, breakdown, uploadsBytes };
    return { breakdown, uploadsBytes };
  }

  private async directoryBytes(root: string): Promise<number> {
    let total = 0;
    const stack: string[] = [root];
    while (stack.length > 0) {
      const dir = stack.pop()!;
      const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          stack.push(full);
          continue;
        }
        if (entry.isFile() || entry.isSymbolicLink()) {
          const info = await stat(full).catch(() => null);
          if (info) total += info.size;
        }
      }
    }
    return total;
  }

  private async tempPlaybackBytes(): Promise<number> {
    const roots = [
      join('/dev/shm', 'uniqbd-mobile-hls'),
      join(tmpdir(), 'uniqbd-mobile-hls'),
      join(resolveUploadsRoot(), 'hls-pack'),
    ];
    let total = 0;
    for (const root of roots) {
      if (!existsSync(root)) continue;
      total += await this.directoryBytes(root);
    }
    return total;
  }
}
