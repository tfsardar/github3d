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

  async getOrFetch(username: string) {
    const normalized = username.toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { username: normalized },
      include: {
        snapshots: {
          orderBy: { fetchedAt: 'desc' },
          take: 1,
        },
      },
    });

    const ttlHours = Number(this.config.get('CACHE_TTL_HOURS') ?? 12);
    const latest = user?.snapshots[0];

    if (latest && this.isFresh(latest.fetchedAt, ttlHours)) {
      return this.toResponse(latest, true);
    }

    // Cache miss or stale — fetch fresh data from GitHub
    const fresh = await this.github.fetchContributions(normalized);

    const dbUser = await this.prisma.user.upsert({
      where: { username: normalized },
      create: { username: normalized },
      update: {},
    });

    const snapshot = await this.prisma.contributionSnapshot.create({
      data: {
        userId: dbUser.id,
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

  private toResponse(snapshot: { totalCount: number; data: any; fetchedAt: Date }, fromCache: boolean) {
    return {
      totalCount: snapshot.totalCount,
      days: snapshot.data,
      fetchedAt: snapshot.fetchedAt,
      fromCache,
    };
  }
}
