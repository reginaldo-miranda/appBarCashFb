/**
 * Converts a hex color into a soft, readable card style (22% background opacity + solid left border).
 */
export function getSoftIdleCardStyle(color?: string | null): {
  backgroundColor: string;
  borderLeftWidth: number;
  borderLeftColor: string;
} | undefined {
  if (!color || typeof color !== 'string') return undefined;
  const trimmed = color.trim();
  const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!hexMatch) {
    return {
      backgroundColor: trimmed,
      borderLeftWidth: 4,
      borderLeftColor: trimmed,
    };
  }

  let hex = hexMatch[1];
  if (hex.length === 3) {
    hex = hex.split('').map((c) => c + c).join('');
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.22)`,
    borderLeftWidth: 4,
    borderLeftColor: `#${hex}`,
  };
}
