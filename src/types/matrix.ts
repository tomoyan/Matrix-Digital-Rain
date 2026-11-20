export type PresetPaletteId = 'classic' | 'amber' | 'blue' | 'red' | 'teal' | 'violet';
export type PaletteId = PresetPaletteId | 'custom' | 'random';

export interface PaletteConfig {
  id: PaletteId;
  label: string;
  /** Leading bright head glyph color */
  head: string;
  /** Soft halo around the head glyph */
  headGlow: string;
  /** Primary bright stream body RGB */
  primaryRgb: [number, number, number];
  /** Deep fading tail RGB */
  deepRgb: [number, number, number];
  /** UI accent hex */
  accentHex: string;
  /** UI subtle glow rgba */
  accentGlow: string;
}

export const PRESET_PALETTE_ORDER: PresetPaletteId[] = [
  'classic',
  'amber',
  'blue',
  'red',
  'teal',
  'violet',
];

export const PALETTES: Record<PresetPaletteId, PaletteConfig> = {
  classic: {
    id: 'classic',
    label: 'Classic Green',
    head: '#E6FFF0',
    headGlow: 'rgba(80, 255, 140, 0.9)',
    primaryRgb: [32, 238, 92],
    deepRgb: [0, 74, 24],
    accentHex: '#22EE5C',
    accentGlow: 'rgba(34, 238, 92, 0.5)',
  },
  amber: {
    id: 'amber',
    label: 'Amber',
    head: '#FFF7E0',
    headGlow: 'rgba(255, 196, 61, 0.88)',
    primaryRgb: [255, 176, 32],
    deepRgb: [104, 48, 0],
    accentHex: '#FFB020',
    accentGlow: 'rgba(255, 176, 32, 0.5)',
  },
  blue: {
    id: 'blue',
    label: 'Blue',
    head: '#E8F6FF',
    headGlow: 'rgba(88, 190, 255, 0.9)',
    primaryRgb: [48, 168, 255],
    deepRgb: [8, 48, 108],
    accentHex: '#30A8FF',
    accentGlow: 'rgba(48, 168, 255, 0.5)',
  },
  red: {
    id: 'red',
    label: 'Red',
    head: '#FFE8EA',
    headGlow: 'rgba(255, 86, 102, 0.9)',
    primaryRgb: [255, 56, 76],
    deepRgb: [106, 10, 22],
    accentHex: '#FF384C',
    accentGlow: 'rgba(255, 56, 76, 0.5)',
  },
  teal: {
    id: 'teal',
    label: 'Teal',
    head: '#E6FFF9',
    headGlow: 'rgba(64, 245, 198, 0.88)',
    primaryRgb: [22, 224, 168],
    deepRgb: [0, 66, 56],
    accentHex: '#16E0A8',
    accentGlow: 'rgba(22, 224, 168, 0.5)',
  },
  violet: {
    id: 'violet',
    label: 'Violet',
    head: '#F4ECFF',
    headGlow: 'rgba(186, 128, 255, 0.9)',
    primaryRgb: [176, 104, 255],
    deepRgb: [58, 20, 108],
    accentHex: '#B068FF',
    accentGlow: 'rgba(176, 104, 255, 0.5)',
  },
};

export interface MatrixSettings {
  speed: number; // 0.25 to 2.5
  density: number; // 0.35 to 1.0
  fontSize: number; // 12 to 28 px
  trailLength: number; // 10 to 44 cells
  glow: number; // 0 to 1
  mirrored: boolean;
  depthLayers: boolean;
  scanlines: boolean;
  interactive: boolean;
  palette: PaletteId;
  customColor: string; // #RRGGBB
  randomCycleSeconds: number; // 2 to 15 seconds per gradual random transition
  audioEnabled: boolean;
  audioVolume: number; // 0 to 1
  screensaverEnabled: boolean;
  screensaverDelaySeconds: number; // 10 to 120 seconds of inactivity
}

export const SCREENSAVER_CALM_SPEED = 0.45;

export const DEFAULT_SETTINGS: MatrixSettings = {
  speed: 1.0,
  density: 0.88,
  fontSize: 18,
  trailLength: 26,
  glow: 0.72,
  mirrored: true,
  depthLayers: true,
  scanlines: true,
  interactive: true,
  palette: 'classic',
  customColor: '#22EE5C',
  randomCycleSeconds: 6,
  audioEnabled: false,
  audioVolume: 0.7,
  screensaverEnabled: true,
  screensaverDelaySeconds: 20,
};

export function parseHexColor(hex: string): [number, number, number] | null {
  const cleaned = hex.trim().replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) return null;
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return [r, g, b];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function hslToRgb(
  h: number,
  s: number,
  l: number
): [number, number, number] {
  const hue = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hue / 60) % 2) - 1));
  const m = l - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hue < 60) {
    r = c;
    g = x;
  } else if (hue < 120) {
    r = x;
    g = c;
  } else if (hue < 180) {
    g = c;
    b = x;
  } else if (hue < 240) {
    g = x;
    b = c;
  } else if (hue < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

export function createPaletteFromRgb(
  rgb: [number, number, number],
  id: PaletteId,
  label: string
): PaletteConfig {
  const [r, g, b] = rgb;
  const headR = r + (255 - r) * 0.82;
  const headG = g + (255 - g) * 0.82;
  const headB = b + (255 - b) * 0.82;
  const deepRgb: [number, number, number] = [
    Math.round(r * 0.28),
    Math.round(g * 0.28),
    Math.round(b * 0.28),
  ];

  return {
    id,
    label,
    head: rgbToHex(headR, headG, headB),
    headGlow: `rgba(${r}, ${g}, ${b}, 0.9)`,
    primaryRgb: [r, g, b],
    deepRgb,
    accentHex: rgbToHex(r, g, b),
    accentGlow: `rgba(${r}, ${g}, ${b}, 0.5)`,
  };
}

export function resolvePalette(settings: MatrixSettings): PaletteConfig {
  if (settings.palette === 'random') {
    return {
      ...PALETTES.classic,
      id: 'random',
      label: 'Random Cycle',
    };
  }

  if (settings.palette !== 'custom') {
    return PALETTES[settings.palette];
  }

  const rgb = parseHexColor(settings.customColor) ?? PALETTES.classic.primaryRgb;
  return createPaletteFromRgb(rgb, 'custom', 'Custom');
}
