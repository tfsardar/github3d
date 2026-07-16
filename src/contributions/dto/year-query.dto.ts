import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

const VALID_THEMES = ['classic', 'dark', 'neon', 'fire', 'ocean', 'purple', 'sakura'] as const;
const VALID_ANIMATIONS = ['rise', 'wave', 'fade', 'bounce', 'none'] as const;

export class YearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2008) // GitHub's own founding year — nothing valid before this
  @Max(new Date().getUTCFullYear())
  year?: number;

  @IsOptional()
  @IsIn(VALID_THEMES, { message: `theme must be one of: ${VALID_THEMES.join(', ')}` })
  theme?: string;

  @IsOptional()
  @Matches(/^#?[0-9a-fA-F]{6}$/, { message: 'color must be a 6-digit hex value' })
  color?: string;

  @IsOptional()
  @Matches(/^#?[0-9a-fA-F]{6}$/, { message: 'primary must be a 6-digit hex value' })
  primary?: string;

  @IsOptional()
  @Matches(/^#?[0-9a-fA-F]{6}$/, { message: 'secondary must be a 6-digit hex value' })
  secondary?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(2400) // matches MAX_DISPLAY_SIZE clamp in ImageGeneratorService
  width?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(200)
  @Max(2400)
  height?: number;

  @IsOptional()
  @IsIn(VALID_ANIMATIONS, { message: `animation must be one of: ${VALID_ANIMATIONS.join(', ')}` })
  animation?: string;

  @IsOptional()
  @IsIn(['transparent'], { message: 'background must be "transparent"' })
  background?: string;
}