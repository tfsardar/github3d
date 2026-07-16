import { Injectable, BadGatewayException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ContributionDay {
  date: string;
  count: number;
  level: number; // 0-4, matches GitHub's own intensity scale
}

export interface ContributionResult {
  totalCount: number;
  days: ContributionDay[];
}

const QUERY = `
  query($username: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $username) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              contributionLevel
            }
          }
        }
      }
    }
  }
`;

// GitHub's enum levels map to 0-4 for consistent bar heights on the frontend
const LEVEL_MAP: Record<string, number> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

@Injectable()
export class GithubGraphqlService {
  constructor(private readonly config: ConfigService) {}

  async fetchContributions(username: string, year: number): Promise<ContributionResult> {
    const token = this.config.get<string>('GITHUB_TOKEN');
    const currentYear = new Date().getUTCFullYear();

    // Full calendar year, except the current year which stops "now" instead of Dec 31
    const from = `${year}-01-01T00:00:00Z`;
    const to =
      year === currentYear
        ? new Date().toISOString()
        : `${year}-12-31T23:59:59Z`;

    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Token stays server-side only — never sent to or readable by the frontend
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: QUERY, variables: { username, from, to } }),
    });

    if (!res.ok) {
      throw new BadGatewayException('Failed to reach GitHub API');
    }

    const json = await res.json();

    if (json.errors) {
      throw new NotFoundException(`GitHub user "${username}" not found`);
    }

    const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
      throw new NotFoundException(`GitHub user "${username}" not found`);
    }

    const days: ContributionDay[] = calendar.weeks.flatMap((week: any) =>
      week.contributionDays.map((d: any) => ({
        date: d.date,
        count: d.contributionCount,
        level: LEVEL_MAP[d.contributionLevel] ?? 0,
      })),
    );

    return {
      totalCount: calendar.totalContributions,
      days,
    };
  }
}