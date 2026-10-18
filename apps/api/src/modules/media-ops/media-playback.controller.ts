import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MediaPlaybackAccessService } from './media-playback-access.service';
import { MediaPlaybackService, PlaybackQuality } from './media-playback.service';

class PlaybackBody {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  startSeconds?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  episodeIndex?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  audioIndex?: number;

  @IsOptional()
  @IsIn(['auto', '1080', '720', '480'])
  quality?: PlaybackQuality;
}

@Controller('media/playback')
@Public()
@Roles()
@SkipThrottle()
@UseGuards(RolesGuard, OptionalJwtAuthGuard)
export class MediaPlaybackController {
  constructor(
    private readonly playback: MediaPlaybackService,
    private readonly playbackAccess: MediaPlaybackAccessService,
  ) {}

  @Get('sessions/:sessionId')
  async status(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('sessionId') sessionId: string,
  ) {
    await this.playbackAccess.assertPlayAllowed(user);
    return this.playback.status(sessionId);
  }

  @Post('sessions/:sessionId')
  async retarget(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('sessionId') sessionId: string,
    @Body() body: PlaybackBody,
  ) {
    await this.playbackAccess.assertPlayAllowed(user);
    return this.playback.retarget(sessionId, body);
  }

  @Post(':titleId')
  async start(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('titleId') titleId: string,
    @Body() body: PlaybackBody,
  ) {
    await this.playbackAccess.assertPlayAllowed(user);
    return this.playback.start(titleId, body);
  }

  @Get('sessions/:sessionId/:file')
  async file(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('sessionId') sessionId: string,
    @Param('file') file: string,
    @Res() res: Response,
  ) {
    await this.playbackAccess.assertPlayAllowed(user);
    try {
      const baseFile = decodeURIComponent(file.split('?')[0]?.split('#')[0] ?? file);
      if (baseFile === 'media.mp4') {
        const child = this.playback.beginStream(sessionId);
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders?.();
        const stdout = child.stdout;
        if (!stdout) {
          res.status(404).end();
          return;
        }
        stdout.pipe(res);
        const stop = () => {
          if (child.exitCode == null && !child.killed) child.kill('SIGTERM');
        };
        res.on('close', stop);
        child.on('close', () => {
          if (!res.writableEnded) res.end();
        });
        child.on('error', () => {
          if (!res.headersSent) res.status(500).end();
          else if (!res.writableEnded) res.end();
        });
        return;
      }
      const caption = this.playback.captionText(sessionId, baseFile);
      if (caption != null) {
        res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(caption);
        return;
      }
      if (baseFile === 'index.m3u8') {
        const body = await this.playback.mobilePlaylist(sessionId);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(body);
        return;
      }
      const opened = await this.playback.ensurePlaybackFile(sessionId, baseFile);
      res.setHeader('Content-Type', opened.type);
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(opened.path);
    } catch {
      res.status(404).end();
    }
  }
}
