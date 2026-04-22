export const HEATMAP_LEVEL_COLORS = {
  empty: '#2c2c2e',
  l1: 'rgba(255, 69, 58, 0.25)',
  l2: 'rgba(255, 69, 58, 0.5)',
  l3: 'rgba(255, 69, 58, 0.75)',
  l4: '#ff453a',
} as const;

export function getHeatmapColor(amount: number, maxAmount: number): string {
  if (amount <= 0 || maxAmount <= 0) return HEATMAP_LEVEL_COLORS.empty;
  const ratio = amount / maxAmount;
  if (ratio <= 0.25) return HEATMAP_LEVEL_COLORS.l1;
  if (ratio <= 0.5) return HEATMAP_LEVEL_COLORS.l2;
  if (ratio <= 0.75) return HEATMAP_LEVEL_COLORS.l3;
  return HEATMAP_LEVEL_COLORS.l4;
}
