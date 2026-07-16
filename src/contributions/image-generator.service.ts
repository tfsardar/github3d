import { Injectable } from '@nestjs/common';
import { ContributionDay } from './github-graphql.service';

const TILE_W = 18; // half-width of each diamond tile
const TILE_H = 9; // half-height of each diamond tile
const HEIGHT_UNIT = 7; // pixels of bar height per contribution level

// Base colors per level (0 = no contributions .. 4 = highest)
const LEVEL_COLORS = ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'];

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

@Injectable()
export class ImageGeneratorService {
  generateIsometricSvg(days: ContributionDay[]): string {
    // Group flat day list into weeks (columns of 7 rows), same layout as GitHub calendar
    const weeks: ContributionDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    const width = 900;
    const height = 300;
    const originX = width / 2;
    const originY = 60;

    const cubes: string[] = [];

    weeks.forEach((week, col) => {
      week.forEach((day, row) => {
        const h = day.level * HEIGHT_UNIT + 1; // minimum 1px so empty days still show a thin tile
        const color = LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0];

        const x = originX + (col - row) * (TILE_W / 2);
        const y = originY + (col + row) * (TILE_H / 2);

        // Top diamond face
        const top = [
          [x, y - h - TILE_H / 2],
          [x + TILE_W / 2, y - h],
          [x, y - h + TILE_H / 2],
          [x - TILE_W / 2, y - h],
        ];

        // Left face (darker shade)
        const left = [
          [x - TILE_W / 2, y - h],
          [x, y - h + TILE_H / 2],
          [x, y + TILE_H / 2],
          [x - TILE_W / 2, y],
        ];

        // Right face (darkest shade)
        const right = [
          [x, y - h + TILE_H / 2],
          [x + TILE_W / 2, y - h],
          [x + TILE_W / 2, y],
          [x, y + TILE_H / 2],
        ];

        const toPoints = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ');

        cubes.push(
          `<polygon points="${toPoints(left)}" fill="${darken(color, 30)}" />`,
          `<polygon points="${toPoints(right)}" fill="${darken(color, 55)}" />`,
          `<polygon points="${toPoints(top)}" fill="${color}" />`,
        );
      });
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="100%" height="100%" fill="#0d1117" />
  ${cubes.join('\n  ')}
</svg>`;
  }
}