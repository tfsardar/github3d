import { Injectable } from '@nestjs/common';
import { ContributionDay } from './github-graphql.service';

const TILE_W = 18; // half-width of each diamond tile
const TILE_H = 9; // half-height of each diamond tile
const HEIGHT_UNIT = 8; // pixels of bar height per contribution level
const PADDING = 50;
const TITLE_HEIGHT = 60;

// Fallback cap when the caller doesn't pass an explicit width/height —
// keeps the graph from stretching page-wide in a README.
const DEFAULT_MAX_DISPLAY_WIDTH = 1200;

// Hard safety limits so ?width=99999 can't be used to generate a huge SVG (DoS risk)
const MIN_DISPLAY_SIZE = 200;
const MAX_DISPLAY_SIZE = 2400;

export type ThemeName =
  | 'classic'
  | 'dark'
  | 'neon'
  | 'fire'
  | 'ocean'
  | 'purple'
  | 'sakura';

export type AnimationType = 'rise' | 'wave' | 'fade' | 'bounce' | 'none';

export interface RenderOptions {
  theme?: ThemeName;
  primaryColor?: string; // e.g. "ff0000" or "#ff0000"
  secondaryColor?: string; // e.g. "0000ff" or "#0000ff"
  width?: number;
  height?: number;
  animation?: AnimationType;
  transparentBackground?: boolean;
}

interface Palette {
  levelColors: string[];
  floorColor: string;
  floorStroke: string;
  bgTop: string;
  bgBottom: string;
  titleColor: string;
  subtitleColor: string;
}

// 🟩 Classic / 🌙 Dark / 🌈 Neon / 🔥 Fire / 🌊 Ocean / 💜 Purple / 🌸 Sakura
const THEMES: Record<ThemeName, Palette> = {
  classic: {
    levelColors: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
    floorColor: '#ebedf0',
    floorStroke: '#d0d7de',
    bgTop: '#ffffff',
    bgBottom: '#f6f8fa',
    titleColor: '#24292f',
    subtitleColor: '#57606a',
  },
  dark: {
    levelColors: ['#1b2733', '#0e4f3d', '#12805c', '#1fb87a', '#3fe3a0'],
    floorColor: '#1b2733',
    floorStroke: '#2a3a47',
    bgTop: '#0d1420',
    bgBottom: '#151f2e',
    titleColor: '#e6edf3',
    subtitleColor: '#8b98a5',
  },
  neon: {
    levelColors: ['#1a0b2e', '#6b21a8', '#c026d3', '#ec4899', '#22d3ee'],
    floorColor: '#1a0b2e',
    floorStroke: '#3b1360',
    bgTop: '#0a0118',
    bgBottom: '#150826',
    titleColor: '#f0abfc',
    subtitleColor: '#a78bfa',
  },
  fire: {
    levelColors: ['#2b0a02', '#7c2d12', '#c2410c', '#f97316', '#fde047'],
    floorColor: '#2b0a02',
    floorStroke: '#451a03',
    bgTop: '#180400',
    bgBottom: '#2a0800',
    titleColor: '#fed7aa',
    subtitleColor: '#fb923c',
  },
  ocean: {
    levelColors: ['#031621', '#053a52', '#0a6d8c', '#14a3c7', '#5fe0f0'],
    floorColor: '#031621',
    floorStroke: '#0a2e40',
    bgTop: '#010b12',
    bgBottom: '#041823',
    titleColor: '#bae6fd',
    subtitleColor: '#38bdf8',
  },
  purple: {
    levelColors: ['#1e1033', '#3b1d63', '#5b21a6', '#8b5cf6', '#c4b5fd'],
    floorColor: '#1e1033',
    floorStroke: '#2e1a4d',
    bgTop: '#120a24',
    bgBottom: '#1c1038',
    titleColor: '#e9d5ff',
    subtitleColor: '#a78bfa',
  },
  sakura: {
    levelColors: ['#fdf2f6', '#fbcfe8', '#f9a8d4', '#f472b6', '#db2777'],
    floorColor: '#fdf2f6',
    floorStroke: '#fbcfe8',
    bgTop: '#fff5f8',
    bgBottom: '#ffeef4',
    titleColor: '#831843',
    subtitleColor: '#be185d',
  },
};

function normalizeHex(hex: string): string {
  const clean = hex.startsWith('#') ? hex : `#${hex}`;
  return /^#[0-9a-fA-F]{6}$/.test(clean) ? clean : '#3fe3a0'; // fallback if malformed input
}

function hexToRgb(hex: string): [number, number, number] {
  const num = parseInt(hex.replace('#', ''), 16);
  return [(num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function blend(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, ((num >> 16) & 0xff) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}

// Builds a 5-step level gradient from a custom primary (+ optional secondary) color,
// used when ?color= or ?primary=&secondary= is passed instead of a theme name.
function buildCustomLevelColors(primary: string, secondary?: string): string[] {
  const from = secondary ? normalizeHex(secondary) : '#1b2733';
  const to = normalizeHex(primary);
  return [0, 0.25, 0.5, 0.75, 1].map((t) => blend(from, to, t));
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface Point {
  x: number;
  y: number;
}

function toPoints(pts: Point[]): string {
  return pts.map((p) => `${p.x},${p.y}`).join(' ');
}

// Per-animation-style CSS. "none" intentionally has no entry — callers skip
// the animation class/style entirely when animation === 'none'.
const ANIMATION_CSS: Record<Exclude<AnimationType, 'none'>, { className: string; css: string }> = {
  rise: {
    className: 'cube-rise',
    css: `
    .cube-rise { animation: riseUp 0.5s ease-out both; }
    @keyframes riseUp {
      from { transform: scaleY(0); opacity: 0; }
      to { transform: scaleY(1); opacity: 1; }
    }`,
  },
  fade: {
    className: 'cube-fade',
    css: `
    .cube-fade { animation: fadeIn 0.6s ease-out both; }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }`,
  },
  bounce: {
    className: 'cube-bounce',
    css: `
    .cube-bounce { animation: bounceUp 0.6s cubic-bezier(.34,1.56,.64,1) both; }
    @keyframes bounceUp {
      from { transform: scaleY(0); opacity: 0; }
      to { transform: scaleY(1); opacity: 1; }
    }`,
  },
  wave: {
    className: 'cube-wave',
    css: `
    .cube-wave { animation: waveUp 0.7s ease-in-out both; }
    @keyframes waveUp {
      0% { transform: translateY(10px) scaleY(0); opacity: 0; }
      60% { transform: translateY(-3px) scaleY(1.05); opacity: 1; }
      100% { transform: translateY(0) scaleY(1); opacity: 1; }
    }`,
  },
};

@Injectable()
export class ImageGeneratorService {
  generateIsometricSvg(
    days: ContributionDay[],
    meta?: { username?: string; totalCount?: number; year?: number },
    options?: RenderOptions,
  ): string {
    const themeName: ThemeName = options?.theme && THEMES[options.theme] ? options.theme : 'dark';
    const basePalette = THEMES[themeName];

    // Custom color(s) override just the level colors — everything else (bg, floor)
    // stays from the selected theme so custom colors still look intentional, not broken.
    const palette: Palette = options?.primaryColor
      ? { ...basePalette, levelColors: buildCustomLevelColors(options.primaryColor, options.secondaryColor) }
      : basePalette;

    const animation: AnimationType = options?.animation ?? 'rise';
    const animMeta = animation !== 'none' ? ANIMATION_CSS[animation] : null;

    const transparentBg = options?.transparentBackground === true;

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
        const color = palette.levelColors[day.level] ?? palette.levelColors[0];
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
        `<polygon points="${toPoints(floor)}" fill="${palette.floorColor}" stroke="${palette.floorStroke}" stroke-width="0.5" />`,
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

      const cubeFaces =
        `<polygon points="${toPoints(left)}" fill="${darken(color, 40)}" />` +
        `<polygon points="${toPoints(right)}" fill="${darken(color, 65)}" />` +
        `<polygon points="${toPoints(top)}" fill="${color}" />`;

      if (animMeta) {
        shapes.push(
          `<g class="${animMeta.className}" style="transform-origin: ${x}px ${y}px; animation-delay: ${delay}s;">${cubeFaces}</g>`,
        );
      } else {
        // animation === 'none' → static, no wrapper styling needed
        shapes.push(`<g>${cubeFaces}</g>`);
      }
    });

    const title = meta?.username ? `@${escapeXml(meta.username)}` : '';
    const yearLabel = meta?.year ? ` in ${meta.year}` : '';
    const subtitle =
      meta?.totalCount !== undefined ? `${meta.totalCount} contributions${yearLabel}` : '';

    // Resolve final output pixel size:
    // - explicit ?width= / ?height= wins and scales the other dimension proportionally
    // - otherwise fall back to the default max-width cap (shrink-only, never upscale)
    let displayWidth: number;
    let displayHeight: number;

    if (options?.width) {
      const clampedWidth = Math.min(MAX_DISPLAY_SIZE, Math.max(MIN_DISPLAY_SIZE, options.width));
      displayWidth = clampedWidth;
      displayHeight = Math.round(height * (clampedWidth / width));
    } else if (options?.height) {
      const clampedHeight = Math.min(MAX_DISPLAY_SIZE, Math.max(MIN_DISPLAY_SIZE, options.height));
      displayHeight = clampedHeight;
      displayWidth = Math.round(width * (clampedHeight / height));
    } else {
      const scale = Math.min(1, DEFAULT_MAX_DISPLAY_WIDTH / width);
      displayWidth = Math.round(width * scale);
      displayHeight = Math.round(height * scale);
    }

    const backgroundRect = transparentBg
      ? ''
      : `<rect width="100%" height="100%" fill="url(#bg)" rx="14" />`;

    const bgDefs = transparentBg
      ? ''
      : `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${palette.bgTop}" />
      <stop offset="100%" stop-color="${palette.bgBottom}" />
    </linearGradient>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${displayWidth}" height="${displayHeight}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
  <defs>
    ${bgDefs}
  </defs>
  <style>${animMeta ? animMeta.css : ''}
  </style>
  ${backgroundRect}
  ${title ? `<text x="${PADDING}" y="30" font-family="Segoe UI, sans-serif" font-size="18" font-weight="600" fill="${palette.titleColor}">${title}</text>` : ''}
  ${subtitle ? `<text x="${PADDING}" y="50" font-family="Segoe UI, sans-serif" font-size="12" fill="${palette.subtitleColor}">${subtitle}</text>` : ''}
  ${shapes.join('\n  ')}
</svg>`;
  }
}