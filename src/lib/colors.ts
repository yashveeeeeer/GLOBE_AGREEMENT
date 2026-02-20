// Commenda palette
// Blue Bell:   #3790C9  rgb(55, 144, 201)
// Fresh Sky:   #5FB3DC  rgb(95, 179, 220)
// Grey:        #827875  rgb(130, 120, 117)
// Porcelain:   #FAF9F6  rgb(250, 249, 246)
// Blue Bell 2: #41A0D8  rgb(65, 160, 216)

const TYPE_COLORS: Record<string, string> = {
  BIT: "#3790C9",
  FTA: "#2e8b57",
  CEPA: "#d4880f",
  EPA: "#9b59b6",
  ART: "#c0392b",
  ARTI: "#e74c6f",
  OTHER: "#5FB3DC",
  TIFA: "#1abc9c",
  ECA: "#b8860b",
  TIA: "#8e44ad",
  ECTA: "#27ae60",
  CECPA: "#d35400",
  RCEP: "#41A0D8",
  USMCA: "#16a085",
  ETEA: "#5dade2",
  TPP: "#2980b9",
  TICFA: "#7d3c98",
  ATEC: "#2471a3",
  ANZFTA: "#0e6655",
  TICA: "#c0547a",
  TPA: "#7e5aa2",
  CECA: "#148f77",
  DR: "#b7950b",
  NAFTA: "#cb4335",
};

const DEFAULT_COLOR = "#3790C9";

export function getTypeColor(typeCode: string): string {
  return TYPE_COLORS[typeCode] || DEFAULT_COLOR;
}

const rgbaCache = new Map<string, string>();

export function getTypeColorRgba(typeCode: string, alpha: number): string {
  const key = `${typeCode}-${alpha}`;
  let cached = rgbaCache.get(key);
  if (cached) return cached;
  const hex = getTypeColor(typeCode);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  cached = `rgba(${r},${g},${b},${alpha})`;
  rgbaCache.set(key, cached);
  return cached;
}

export const POINT_COLOR_DEFAULT = "#3790C9";
export const POINT_COLOR_HOVER = "#5FB3DC";
export const POINT_COLOR_SELECTED = "#1a4f7a";
