import { HEATMAP_LEVEL_COLORS } from '../lib/heatmap';
import { t } from '../lib/i18n';
import type { Locale } from '../types';

type HeatmapLegendProps = {
  locale: Locale;
  className?: string;
};

export function HeatmapLegend({ locale, className = 'heatmap-card-legend' }: HeatmapLegendProps) {
  return (
    <div className={className}>
      <span>{t(locale, 'heatmapLow')}</span>
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: HEATMAP_LEVEL_COLORS.empty }} />
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: HEATMAP_LEVEL_COLORS.l1 }} />
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: HEATMAP_LEVEL_COLORS.l2 }} />
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: HEATMAP_LEVEL_COLORS.l3 }} />
      <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: HEATMAP_LEVEL_COLORS.l4 }} />
      <span>{t(locale, 'heatmapHigh')}</span>
    </div>
  );
}
