import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ContributionsService } from './contributions.service';
import { ImageGeneratorService } from './image-generator.service';
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
  //   Current year:  ![3D Contributions](https://your-api-url/contributions/USERNAME/image.svg)
  //   Specific year: ![3D Contributions 2024](https://your-api-url/contributions/USERNAME/image.svg?year=2024)
  @Get(':username/image.svg')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getContributionImage(
    @Param() params: GetContributionsParamsDto,
    @Query() query: YearQueryDto,
    @Res() res: Response,
  ) {
    const data = await this.contributionsService.getOrFetch(params.username, query.year);
    const svg = this.imageGenerator.generateIsometricSvg(data.days, {
      username: params.username,
      totalCount: data.totalCount,
      year: data.year,
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }
}