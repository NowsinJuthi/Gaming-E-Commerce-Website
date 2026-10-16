import { Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
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
@UseGuards(RolesGuard)
export class MediaPlaybackController {
  constructor(private readonly playback: MediaPlaybackService) {}

  @Get('sessions/:sessionId')
  status(@Param('sessionId') sessionId: string) {
    return this.playback.status(sessionId);
  }

  @Post('sessions/:sessionId')
  retarget(@Param('sessionId') sessionId: string, @Body() body: PlaybackBody) {
    return this.playback.retarget(sessionId, body);
  }

  @Post(':titleId')
  start(@Param('titleId') titleId: string, @Body() body: PlaybackBody) {
    return this.playback.start(titleId, body);
  }

  @Get('sessions/:sessionId/:file')
  async file(
    @Param('sessionId') sessionId: string,
    @Param('file') file: string,
    @Res() res: Response,
  ) {
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
