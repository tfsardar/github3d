import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ContributionsService } from './contributions.service';
import {
  ImageGeneratorService,
  ThemeName,
  AnimationType,
  RenderOptions,
} from './image-generator.service';
import { GetContributionsParamsDto } from './dto/get-contributions.dto';
import { YearQueryDto } from './dto/year-query.dto';

const VALID_THEMES: ThemeName[] = [
  'classic',
  'dark',
  'neon',
  'fire',
  'ocean',
  'purple',
  'sakura',
];
const VALID_ANIMATIONS: AnimationType[] = ['rise', 'wave', 'fade', 'bounce', 'none'];

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
    @Query('theme') themeQuery?: string,
    @Query('color') colorQuery?: string,
    @Query('primary') primaryQuery?: string,
    @Query('secondary') secondaryQuery?: string,
    @Query('width') widthQuery?: string,
    @Query('height') heightQuery?: string,
    @Query('animation') animationQuery?: string,
    @Query('background') backgroundQuery?: string,
    @Res() res?: Response,
  ) {
    const data = await this.contributionsService.getOrFetch(params.username, query.year);

    const options: RenderOptions = {
      theme: this.parseTheme(themeQuery),
      primaryColor: this.parseHexColor(primaryQuery ?? colorQuery),
      secondaryColor: this.parseHexColor(secondaryQuery),
      width: this.parsePositiveInt(widthQuery),
      height: this.parsePositiveInt(heightQuery),
      animation: this.parseAnimation(animationQuery),
      transparentBackground: backgroundQuery === 'transparent',
    };

    const svg = this.imageGenerator.generateIsometricSvg(
      data.days,
      { username: params.username, totalCount: data.totalCount, year: data.year },
      options,
    );

    res!.setHeader('Content-Type', 'image/svg+xml');
    res!.setHeader('Cache-Control', 'public, max-age=3600');
    res!.send(svg);
  }

  // --- query param parsing helpers (kept here so bad input never reaches the SVG generator) ---

  private parseTheme(value?: string): ThemeName | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    return VALID_THEMES.includes(normalized as ThemeName) ? (normalized as ThemeName) : undefined;
  }

  private parseAnimation(value?: string): AnimationType | undefined {
    if (!value) return undefined;
    const normalized = value.toLowerCase();
    return VALID_ANIMATIONS.includes(normalized as AnimationType)
      ? (normalized as AnimationType)
      : undefined;
  }

  private parseHexColor(value?: string): string | undefined {
    if (!value) return undefined;
    const clean = value.startsWith('#') ? value.slice(1) : value;
    // only accept exactly 6 hex chars — anything else is ignored rather than
    // passed through, since it ends up inside an SVG fill attribute
    return /^[0-9a-fA-F]{6}$/.test(clean) ? `#${clean}` : undefined;
  }

  private parsePositiveInt(value?: string): number | undefined {
    if (!value) return undefined;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  }
}