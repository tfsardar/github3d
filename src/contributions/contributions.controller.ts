import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ContributionsService } from './contributions.service';
import { ImageGeneratorService, ThemeName, AnimationType, RenderOptions } from './image-generator.service';
import { GetContributionsParamsDto } from './dto/get-contributions.dto';
import { YearQueryDto } from './dto/year-query.dto';

@Controller('contributions')
export class ContributionsController {
  constructor(
    private readonly contributionsService: ContributionsService,
    private readonly imageGenerator: ImageGeneratorService,
  ) {}

  // JSON endpoint — still useful if you build an interactive frontend later
  // Usage: GET /contributions/torvalds?year=2024
  @Get(':username')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async getContributions(@Param() params: GetContributionsParamsDto, @Query() query: YearQueryDto) {
    return this.contributionsService.getOrFetch(params.username, query.year);
  }

  // Image endpoint — this is the one embedded in GitHub READMEs
  // Usage in README.md:
  //   Current year:            ![3D Contributions](https://your-api-url/contributions/USERNAME/image.svg)
  //   Specific year:           ![3D Contributions 2024](https://your-api-url/contributions/USERNAME/image.svg?year=2024)
  //   Theme:                   ?theme=neon
  //   Custom single color:     ?color=ff0000
  //   Custom gradient:         ?primary=ff0000&secondary=0000ff
  //   Custom size:             ?width=1200   or   ?height=500
  //   Animation style:         ?animation=wave
  //   Transparent background:  ?background=transparent
  @Get(':username/image.svg')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getContributionImage(
    @Param() params: GetContributionsParamsDto,
    @Query() query: YearQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.contributionsService.getOrFetch(params.username, query.year);

    const options: RenderOptions = {
      theme: query.theme as ThemeName | undefined,
      primaryColor: this.toHex(query.primary ?? query.color),
      secondaryColor: this.toHex(query.secondary),
      width: query.width,
      height: query.height,
      animation: query.animation as AnimationType | undefined,
      transparentBackground: query.background === 'transparent',
    };

    const svg = this.imageGenerator.generateIsometricSvg(
      data.days,
      { username: params.username, totalCount: data.totalCount, year: data.year },
      options,
    );

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }

  private toHex(value?: string): string | undefined {
    if (!value) return undefined;
    return value.startsWith('#') ? value : `#${value}`;
  }
}