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
      if (file === 'index.m3u8') {
        const body = await this.playback.playlistForServe(sessionId);
        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Cache-Control', 'no-store');
        res.send(body);
        return;
      }
      const opened = this.playback.openFile(sessionId, file);
      res.setHeader('Content-Type', opened.type);
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(opened.path);
    } catch {
      res.status(404).end();
    }
  }
}
