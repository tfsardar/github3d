import { Matches, MaxLength, MinLength } from 'class-validator';

export class GetContributionsParamsDto {
  // GitHub usernames only allow alphanumerics and single hyphens.
  // This regex blocks injection attempts, path traversal, and GraphQL query breakage.
  @MinLength(1)
  @MaxLength(39) // GitHub's own username length limit
  @Matches(/^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$/, {
    message: 'Invalid GitHub username format',
  })
  username: string;
}