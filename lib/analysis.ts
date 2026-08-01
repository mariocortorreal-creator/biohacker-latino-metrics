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

export type PerformanceStatus = "good" | "bad" | "neutral";

export interface AnalyzedItem extends ContentInsightItem {
  daysSincePublished: number | null;
  ratioVsMedian: number | null;
  status: PerformanceStatus;
}

// Un video publicado hace menos de este umbral todavía no tuvo tiempo de
// recibir su alcance real — no se juzga como "bajo/alto rendimiento" todavía.
const RECENT_DAYS_THRESHOLD = 5;
const OVERPERFORM_RATIO = 1.5;
const UNDERPERFORM_RATIO = 0.5;

function statusFor(ratio: number | null): PerformanceStatus {
  if (ratio === null) return "neutral";
  if (ratio >= OVERPERFORM_RATIO) return "good";
  if (ratio <= UNDERPERFORM_RATIO) return "bad";
  return "neutral";
}

// Cuántos videos como máximo entran al gráfico de ranking (mantiene el
// gráfico legible aunque el canal tenga cientos de piezas de contenido).
const TOP_RANKED_LIMIT = 12;

export function analyzeContent(items: ContentInsightItem[], now = Date.now()) {
  const withAge = items.map((item) => ({
    ...item,
    daysSincePublished: item.publishedAt
      ? Math.floor((now - new Date(item.publishedAt).getTime()) / 86400000)
      : null,
  }));

  const mature = withAge.filter(
    (i) => i.daysSincePublished === null || i.daysSincePublished >= RECENT_DAYS_THRESHOLD
  );
  const recent = withAge.filter(
    (i) => i.daysSincePublished !== null && i.daysSincePublished < RECENT_DAYS_THRESHOLD
  );

  const medianViews = median(mature.map((i) => i.views));

  const withRatio: AnalyzedItem[] = mature.map((i) => {
    const ratioVsMedian = medianViews > 0 ? i.views / medianViews : null;
    return { ...i, ratioVsMedian, status: statusFor(ratioVsMedian) };
  });

  const topRanked = [...withRatio].sort((a, b) => b.views - a.views).slice(0, TOP_RANKED_LIMIT);

  const overperformers = withRatio
    .filter((i) => i.status === "good")
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  const underperformers = withRatio
    .filter((i) => i.status === "bad")
    .sort((a, b) => a.views - b.views)
    .slice(0, 5);

  const topPerformer = topRanked[0] ?? null;

  return {
    medianViews,
    topRanked,
    overperformers,
    underperformers,
    topPerformer,
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
