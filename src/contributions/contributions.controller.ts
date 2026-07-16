import { Controller, Get, Param, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ContributionsService } from './contributions.service';
import { ImageGeneratorService } from './image-generator.service';
import { GetContributionsParamsDto } from './dto/get-contributions.dto';

@Controller('contributions')
export class ContributionsController {
  constructor(
    private readonly contributionsService: ContributionsService,
    private readonly imageGenerator: ImageGeneratorService,
  ) {}

  // JSON endpoint — still useful if you build an interactive frontend later
  @Get(':username')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async getContributions(@Param() params: GetContributionsParamsDto) {
    return this.contributionsService.getOrFetch(params.username);
  }

  // Image endpoint — this is the one embedded in GitHub READMEs
  // Usage in README.md: ![3D Contributions](https://your-api-url/contributions/USERNAME/image.svg)
  @Get(':username/image.svg')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async getContributionImage(@Param() params: GetContributionsParamsDto, @Res() res: Response) {
    const data = await this.contributionsService.getOrFetch(params.username);
    const svg = this.imageGenerator.generateIsometricSvg(data.days);

    res.setHeader('Content-Type', 'image/svg+xml');
    // GitHub caches embedded images aggressively; keep this shortish so updates show reasonably fast
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  }
}