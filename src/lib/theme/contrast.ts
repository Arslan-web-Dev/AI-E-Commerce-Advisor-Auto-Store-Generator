/** WCAG 2.x relative luminance, contrast ratio and deterministic adjustment. */

import { isHexColor, type ThemeColors } from './schema';

export type ContrastAdjustment = {
  color: string;
  adjusted: boolean;
  originalRatio: number;
  ratio: number;
};

export type ContrastEvaluation = {
  colors: ThemeColors;
  originalColors: ThemeColors;
  adjustedColors: string[];
  contrast: {
    primaryOnSurface: number;
    secondaryOnSurface: number;
    onPrimaryOnPrimary: number;
    onSurfaceOnSurface: number;
  };
};

type Rgb = { r: number; g: number; b: number };

function assertHex(color: string): void {
  if (!isHexColor(color)) throw new Error('Contrast helpers require six-digit hex colours.');
}

export function parseHex(color: string): Rgb {
  assertHex(color);
  return {
    r: Number.parseInt(color.slice(1, 3), 16),
    g: Number.parseInt(color.slice(3, 5), 16),
    b: Number.parseInt(color.slice(5, 7), 16),
  };
}

export function formatHex({ r, g, b }: Rgb): string {
  const channel = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0').toUpperCase();
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

/** sRGB linearization followed by the WCAG luminance weights. */
export function relativeLuminance(color: string): number {
  const { r, g, b } = parseHex(color);
  const linear = (value: number) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** WCAG contrast ratio; the lighter luminance is always the numerator. */
export function contrastRatio(foreground: string, background: string): number {
  const first = relativeLuminance(foreground);
  const second = relativeLuminance(background);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

function mix(from: string, to: string, amount: number): string {
  const a = parseHex(from);
  const b = parseHex(to);
  const ratio = Math.max(0, Math.min(1, amount));
  return formatHex({
    r: a.r + (b.r - a.r) * ratio,
    g: a.g + (b.g - a.g) * ratio,
    b: a.b + (b.b - a.b) * ratio,
  });
}

/**
 * Deterministically moves a colour toward a target until it meets the ratio.
 * `auto` tests black and white first because they always bound the solution.
 */
export function adjustColorForContrast(
  foreground: string,
  background: string,
  minimumRatio: number,
  mode: 'auto' | 'lighten' | 'darken' = 'auto',
): ContrastAdjustment {
  assertHex(foreground);
  assertHex(background);
  const originalRatio = contrastRatio(foreground, background);
  if (originalRatio >= minimumRatio) {
    return { color: foreground, adjusted: false, originalRatio, ratio: originalRatio };
  }

  const candidates: string[] = [];
  if (mode === 'auto') {
    candidates.push('#000000', '#FFFFFF');
  }
  const target = mode === 'lighten' ? '#FFFFFF' : '#000000';
  for (let step = 1; step <= 100; step += 1) {
    candidates.push(mix(foreground, target, step / 100));
  }

  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio >= minimumRatio) {
      return { color: candidate, adjusted: true, originalRatio, ratio };
    }
  }

  const blackRatio = contrastRatio('#000000', background);
  const whiteRatio = contrastRatio('#FFFFFF', background);
  const fallback = blackRatio >= whiteRatio ? '#000000' : '#FFFFFF';
  return {
    color: fallback,
    adjusted: true,
    originalRatio,
    ratio: Math.max(blackRatio, whiteRatio),
  };
}

/** Applies AA thresholds: 3:1 for large text/UI, 4.5:1 for normal text. */
export function evaluatePaletteContrast(input: ThemeColors): ContrastEvaluation {
  const originalColors: ThemeColors = { ...input };
  const adjustedColors: string[] = [];

  const accentMode = relativeLuminance(input.surface) > 0.18 ? 'darken' : 'lighten';
  const primary = adjustColorForContrast(input.primary, input.surface, 3, accentMode);
  const secondary = adjustColorForContrast(input.secondary, input.surface, 3, accentMode);
  const onPrimary = adjustColorForContrast(input.onPrimary, primary.color, 4.5, 'auto');
  const onSurface = adjustColorForContrast(input.onSurface, input.surface, 4.5, 'auto');

  const record = (token: keyof ThemeColors, result: ContrastAdjustment) => {
    if (result.adjusted) adjustedColors.push(token);
    return result.color;
  };

  const colors: ThemeColors = {
    primary: record('primary', primary),
    secondary: record('secondary', secondary),
    onPrimary: record('onPrimary', onPrimary),
    onSurface: record('onSurface', onSurface),
    surface: input.surface,
  };

  return {
    colors,
    originalColors,
    adjustedColors,
    contrast: {
      primaryOnSurface: primary.ratio,
      secondaryOnSurface: secondary.ratio,
      onPrimaryOnPrimary: onPrimary.ratio,
      onSurfaceOnSurface: onSurface.ratio,
    },
  };
}

export const WCAG_AA_THRESHOLDS = {
  normalText: 4.5,
  largeText: 3,
} as const;
