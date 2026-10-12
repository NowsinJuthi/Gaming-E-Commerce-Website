import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, rmSync, unlinkSync } from 'fs';
import { join } from 'path';
import { resolveUploadsRoot } from './uploads-root';

@Injectable()
export class UploadsService {
  private readonly root: string;
  private readonly globalPrefix: string;
  private readonly avatarsDir: string;
  private readonly productsDir: string;
  private readonly logosDir: string;
  private readonly bannersDir: string;
  private readonly blogsDir: string;
  private readonly liveChatDir: string;
  private readonly mfsQrDir: string;

  constructor(private readonly config: ConfigService) {
    this.root = this.config.get<string>('app.uploadsDir') ?? resolveUploadsRoot();
    this.globalPrefix = this.config.get<string>('app.globalPrefix') ?? 'api';
    this.avatarsDir = join(this.root, 'avatars');
    this.productsDir = join(this.root, 'products');
    this.logosDir = join(this.root, 'logos');
    this.bannersDir = join(this.root, 'banners');
    this.blogsDir = join(this.root, 'blog');
    this.liveChatDir = join(this.root, 'live-chat');
    this.mfsQrDir = join(this.root, 'mfs-qr');
  }

  buildProductImagePublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('products', filename);
  }

  buildLogoPublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('logos', filename);
  }

  buildBannerPublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('banners', filename);
  }

  buildBlogImagePublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('blog', filename);
  }

  buildAvatarPublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('avatars', filename);
  }

  buildMfsQrPublicUrl(filename: string): string {
    return this.buildUploadPublicUrl('mfs-qr', filename);
  }

  private buildUploadPublicUrl(folder: string, filename: string): string {
    const prefix = this.globalPrefix.replace(/^\/+|\/+$/g, '');
    const safeName = filename.replace(/^\/+/, '').replace(/\.\./g, '');
    return `/${prefix}/uploads/${folder}/${safeName}`;
  }

  buildLiveChatPublicUrl(relativePath: string): string {
    const prefix = this.globalPrefix.replace(/^\/+|\/+$/g, '');
    const safePath = relativePath.replace(/^\/+/, '').replace(/\.\./g, '');
    return `/${prefix}/uploads/live-chat/${safePath}`;
  }

  tryDeleteBlogImageByUrl(url: string | undefined): void {
    this.tryDeleteByUrlMarker(url, '/uploads/blog/', this.blogsDir, false);
  }

  tryDeleteAvatarByUrl(url: string | undefined): void {
    this.tryDeleteByUrlMarker(url, '/uploads/avatars/', this.avatarsDir, false);
  }

  tryDeleteLiveChatByUrl(url: string | undefined): void {
    this.tryDeleteByUrlMarker(url, '/uploads/live-chat/', this.liveChatDir, true);
  }

  deleteLiveChatRoomFolder(roomId: string): void {
    if (!/^[a-f0-9]{24}$/i.test(roomId)) return;
    const dir = join(this.liveChatDir, roomId);
    if (!existsSync(dir)) return;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  private tryDeleteByUrlMarker(
    url: string | undefined,
    marker: string,
    baseDir: string,
    allowSubpaths: boolean,
  ): void {
    if (!url?.trim()) return;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const rel = url.slice(idx + marker.length).split('?')[0]?.trim();
    if (!rel || rel.includes('..')) return;
    if (!allowSubpaths && rel.includes('/')) return;
    const filePath = join(baseDir, rel);
    if (!filePath.startsWith(baseDir)) return;
    if (!existsSync(filePath)) return;
    try {
      unlinkSync(filePath);
    } catch {
      /* ignore */
    }
  }
}
