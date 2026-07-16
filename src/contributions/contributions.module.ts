import { Module } from '@nestjs/common';
import { ContributionsController } from './contributions.controller';
import { ContributionsService } from './contributions.service';
import { GithubGraphqlService } from './github-graphql.service';
import { ImageGeneratorService } from './image-generator.service';


@Module({
  controllers: [ContributionsController],
  providers: [ContributionsService, GithubGraphqlService,ImageGeneratorService],
})
export class ContributionsModule {}
