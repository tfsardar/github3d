import { Injectable } from '@nestjs/common';
import { ContributionDay } from './github-graphql.service';

const TILE_W = 18; // half-width of each diamond tile
const TILE_H = 9; // half-height of each diamond tile
const HEIGHT_UNIT = 8; // pixels of bar height per contribution level
const PADDING = 50;
const TITLE_HEIGHT = 60;

// Nicer palette: deep teal -> bright green, with a soft glow at the top
const LEVEL_COLORS = ['#1b2733', '#0e4f3d', '#12805c', '#1fb87a', '#3fe3a0'];
const FLOOR_COLOR = '#1b2733';
const FLOOR_STROKE = '#2a3a47';
const BG_TOP = '#0d1420';
const BG_BOTTOM = '#151f2e';

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

interface Point {
  x: number;
  y: number;
}

function toPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

@Injectable()
export class ImageGeneratorService {
  generateIsometricSvg(
    days: ContributionDay[],
    meta?: { username?: string; totalCount?: number; year?: number },
  ): string {
    // Group flat day list into weeks (columns of 7 rows), same layout as GitHub's own calendar
    const weeks: ContributionDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(days.slice(i, i + 7));
    }

    // First pass: compute every tile's raw (unshifted) coordinates so we can
    // measure the full bounding box. Without this step, older weeks (the left
    // side of the isometric grid) get pushed outside a fixed-size canvas and
    // simply never render — which is why only the most recent weeks showed up.
    type Cube = { x: number; y: number; h: number; color: string };
    const cubes: Cube[] = [];
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    weeks.forEach((week, col) => {
      week.forEach((day, row) => {
        const h = day.level * HEIGHT_UNIT + 2;
        const color = LEVEL_COLORS[day.level] ?? LEVEL_COLORS[0];
        const x = (col - row) * (TILE_W / 2);
        const y = (col + row) * (TILE_H / 2);

        cubes.push({ x, y, h, color });

        minX = Math.min(minX, x - TILE_W / 2);
        maxX = Math.max(maxX, x + TILE_W / 2);
        minY = Math.min(minY, y - h - TILE_H / 2);
        maxY = Math.max(maxY, y + TILE_H / 2);
      });
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const width = contentWidth + PADDING * 2;
    const height = contentHeight + PADDING * 2 + TITLE_HEIGHT;

    // Shift every point so the whole grid sits inside the canvas with even padding
    const offsetX = PADDING - minX;
    const offsetY = PADDING + TITLE_HEIGHT - minY;

    const shapes: string[] = [];
    let cubeIndex = 0;

    cubes.forEach(({ x: rawX, y: rawY, h, color }) => {
      const x = rawX + offsetX;
      const y = rawY + offsetY;

      // Flat floor tile under every cell so empty days still read as part of a grid
      const floor: Point[] = [
        { x, y: y - TILE_H / 2 },
        { x: x + TILE_W / 2, y },
        { x, y: y + TILE_H / 2 },
        { x: x - TILE_W / 2, y },
      ];
      shapes.push(
        `<polygon points="${toPoints(floor)}" fill="${FLOOR_COLOR}" stroke="${FLOOR_STROKE}" stroke-width="0.5" />`,
      );

      if (h <= 2) return; // skip drawing a raised cube for empty/near-empty days, floor tile is enough

      const top: Point[] = [
        { x, y: y - h - TILE_H / 2 },
        { x: x + TILE_W / 2, y: y - h },
        { x, y: y - h + TILE_H / 2 },
        { x: x - TILE_W / 2, y: y - h },
      ];
      const left: Point[] = [
        { x: x - TILE_W / 2, y: y - h },
        { x, y: y - h + TILE_H / 2 },
        { x, y },
        { x: x - TILE_W / 2, y: y - TILE_H / 2 + TILE_H / 2 },
      ];
      const right: Point[] = [
        { x, y: y - h + TILE_H / 2 },
        { x: x + TILE_W / 2, y: y - h },
        { x: x + TILE_W / 2, y },
        { x, y },
      ];

      // Stagger each cube's rise-up animation based on its position so the
      // grid appears to "grow" left-to-right rather than popping in all at once.
      const delay = (cubeIndex * 0.006).toFixed(3);
      cubeIndex += 1;

      shapes.push(
        `<g class="cube-rise" style="transform-origin: ${x}px ${y}px; animation-delay: ${delay}s;">` +
          `<polygon points="${toPoints(left)}" fill="${darken(color, 40)}" />` +
          `<polygon points="${toPoints(right)}" fill="${darken(color, 65)}" />` +
          `<polygon points="${toPoints(top)}" fill="${color}" />` +
          `</g>`,
      );
    });

    const title = meta?.username ? `@${meta.username}` : '';
    const yearLabel = meta?.year ? ` in ${meta.year}` : '';
    const subtitle =
      meta?.totalCount !== undefined ? `${meta.totalCount} contributions${yearLabel}` : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${BG_TOP}" />
      <stop offset="100%" stop-color="${BG_BOTTOM}" />
    </linearGradient>
  </defs>
  <style>
    .cube-rise {
      animation: riseUp 0.5s ease-out both;
    }
    @keyframes riseUp {
      from { transform: scaleY(0); opacity: 0; }
      to { transform: scaleY(1); opacity: 1; }
    }
  </style>
  <rect width="100%" height="100%" fill="url(#bg)" rx="14" />
  ${title ? `<text x="${PADDING}" y="30" font-family="Segoe UI, sans-serif" font-size="18" font-weight="600" fill="#e6edf3">${title}</text>` : ''}
  ${subtitle ? `<text x="${PADDING}" y="50" font-family="Segoe UI, sans-serif" font-size="12" fill="#8b98a5">${subtitle}</text>` : ''}
  ${shapes.join('\n  ')}
</svg>`;
  }
}