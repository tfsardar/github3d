import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { GithubGraphqlService } from './github-graphql.service';

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly github: GithubGraphqlService,
    private readonly config: ConfigService,
  ) {}

  async getOrFetch(username: string, year?: number) {
    const normalized = username.toLowerCase();
    const targetYear = year ?? new Date().getUTCFullYear();

    const user = await this.prisma.user.upsert({
      where: { username: normalized },
      create: { username: normalized },
      update: {},
    });

    const latest = await this.prisma.contributionSnapshot.findFirst({
      where: { userId: user.id, year: targetYear },
      orderBy: { fetchedAt: 'desc' },
    });

    // The current year's data is still changing daily, so its cache expires sooner
    // than past years, which are already final and never change.
    const currentYear = new Date().getUTCFullYear();
    const ttlHours =
      targetYear === currentYear ? Number(this.config.get('CACHE_TTL_HOURS') ?? 12) : 24 * 30;

    if (latest && this.isFresh(latest.fetchedAt, ttlHours)) {
      return this.toResponse(latest, true);
    }

    // Cache miss or stale — fetch fresh data from GitHub for that specific year
    const fresh = await this.github.fetchContributions(normalized, targetYear);

    const snapshot = await this.prisma.contributionSnapshot.create({
      data: {
        userId: user.id,
        year: targetYear,
        totalCount: fresh.totalCount,
        data: fresh.days as any,
      },
    });

    return this.toResponse(snapshot, false);
  }

  private isFresh(fetchedAt: Date, ttlHours: number): boolean {
    const ageMs = Date.now() - fetchedAt.getTime();
    return ageMs < ttlHours * 60 * 60 * 1000;
  }

  private toResponse(
    snapshot: { totalCount: number; data: any; fetchedAt: Date; year: number },
    fromCache: boolean,
  ) {
    return {
      totalCount: snapshot.totalCount,
      days: snapshot.data,
      year: snapshot.year,
      fetchedAt: snapshot.fetchedAt,
      fromCache,
    };
  }
}