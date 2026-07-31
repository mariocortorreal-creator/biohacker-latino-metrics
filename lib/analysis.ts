// Funciones puras de análisis — sin acceso a red/DB, fáciles de razonar y probar.

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface ContentInsightItem {
  id: string;
  title: string;
  url: string;
  platform: string;
  views: number;
  publishedAt: string | null;
}

export interface AnalyzedItem extends ContentInsightItem {
  daysSincePublished: number | null;
  ratioVsMedian: number | null;
}

// Un video publicado hace menos de este umbral todavía no tuvo tiempo de
// recibir su alcance real — no se juzga como "bajo/alto rendimiento" todavía.
const RECENT_DAYS_THRESHOLD = 5;
const OVERPERFORM_RATIO = 1.5;
const UNDERPERFORM_RATIO = 0.5;

export function analyzeContent(items: ContentInsightItem[], now = Date.now()) {
  const withAge: AnalyzedItem[] = items.map((item) => ({
    ...item,
    daysSincePublished: item.publishedAt
      ? Math.floor((now - new Date(item.publishedAt).getTime()) / 86400000)
      : null,
    ratioVsMedian: null,
  }));

  const mature = withAge.filter(
    (i) => i.daysSincePublished === null || i.daysSincePublished >= RECENT_DAYS_THRESHOLD
  );
  const recent = withAge.filter(
    (i) => i.daysSincePublished !== null && i.daysSincePublished < RECENT_DAYS_THRESHOLD
  );

  const medianViews = median(mature.map((i) => i.views));

  const withRatio = mature.map((i) => ({
    ...i,
    ratioVsMedian: medianViews > 0 ? i.views / medianViews : null,
  }));

  const overperformers = withRatio
    .filter((i) => i.ratioVsMedian !== null && i.ratioVsMedian >= OVERPERFORM_RATIO)
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const underperformers = withRatio
    .filter((i) => i.ratioVsMedian !== null && i.ratioVsMedian <= UNDERPERFORM_RATIO)
    .sort((a, b) => a.views - b.views)
    .slice(0, 5);

  return {
    medianViews,
    overperformers,
    underperformers,
    recentCount: recent.length,
    matureCount: mature.length,
  };
}

export interface GrowthSnapshot {
  date: string;
  value: number | null;
}

export function computeGrowthTrend(snapshots: GrowthSnapshot[]) {
  const distinctDates = Array.from(new Set(snapshots.map((s) => s.date))).sort();
  if (distinctDates.length < 2) {
    return { ready: false as const, daysTracked: distinctDates.length };
  }
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const delta = (last.value ?? 0) - (first.value ?? 0);
  return {
    ready: true as const,
    daysTracked: distinctDates.length,
    delta,
    from: { date: first.date, value: first.value },
    to: { date: last.date, value: last.value },
  };
}
