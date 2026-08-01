// Gráfico de barras horizontal, hecho a mano en SVG (sin librería de charts).
// Sigue el spec de marcas: barra delgada con el extremo del dato redondeado
// y la base cuadrada, línea de referencia recesiva, etiqueta directa en la
// punta, sin eje/gridlines de sobra. El color es semántico (good/bad/neutral),
// no identidad de serie, así que no lleva leyenda.

export type BarStatus = "good" | "bad" | "neutral";

export interface BarDatum {
  id: string;
  label: string;
  value: number;
  status: BarStatus;
  href?: string;
}

const BAR_HEIGHT = 16;
const ROW_HEIGHT = 28;
const LABEL_WIDTH = 200;
const CHART_WIDTH = 640;
const RIGHT_MARGIN = 56;
const PLOT_WIDTH = CHART_WIDTH - LABEL_WIDTH - RIGHT_MARGIN;
const CORNER_RADIUS = 4;

const STATUS_COLOR: Record<BarStatus, string> = {
  good: "var(--good)",
  bad: "var(--bad)",
  neutral: "var(--muted)",
};

// Rectángulo con el extremo derecho (el "dato") redondeado y la base
// (izquierda, donde nace la barra) cuadrada — nunca los 4 corners parejos.
function rightRoundedBarPath(x0: number, y0: number, width: number, height: number) {
  const r = Math.min(CORNER_RADIUS, width / 2, height / 2);
  const x1 = x0 + width;
  if (r <= 0) {
    return `M${x0},${y0} L${x1},${y0} L${x1},${y0 + height} L${x0},${y0 + height} Z`;
  }
  return [
    `M${x0},${y0}`,
    `L${x1 - r},${y0}`,
    `Q${x1},${y0} ${x1},${y0 + r}`,
    `L${x1},${y0 + height - r}`,
    `Q${x1},${y0 + height} ${x1 - r},${y0 + height}`,
    `L${x0},${y0 + height}`,
    "Z",
  ].join(" ");
}

export function BarChart({
  data,
  medianValue,
  medianLabel,
  valueFormatter = (v: number) => v.toLocaleString("es"),
}: {
  data: BarDatum[];
  medianValue: number;
  medianLabel: string;
  valueFormatter?: (v: number) => string;
}) {
  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), medianValue, 1);
  const scale = (v: number) => (v / maxValue) * PLOT_WIDTH;
  const medianX = LABEL_WIDTH + scale(medianValue);
  const plotHeight = data.length * ROW_HEIGHT;
  const height = plotHeight + 22;

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${height}`}
      width="100%"
      role="img"
      aria-label={`Ranking de contenido por vistas, mediana en ${medianLabel}`}
    >
      {medianValue > 0 && (
        <>
          <line
            x1={medianX}
            y1={0}
            x2={medianX}
            y2={plotHeight}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text x={medianX} y={plotHeight + 15} fontSize={11} fill="var(--muted)" textAnchor="middle">
            mediana: {medianLabel}
          </text>
        </>
      )}
      {data.map((d, i) => {
        const y = i * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
        const barWidth = Math.max(scale(d.value), 2);
        const label = d.label.length > 34 ? `${d.label.slice(0, 34)}…` : d.label;
        return (
          <g key={d.id}>
            <title>{`${d.label}: ${valueFormatter(d.value)}`}</title>
            <text
              x={LABEL_WIDTH - 10}
              y={y + BAR_HEIGHT / 2 + 4}
              fontSize={12}
              fill="var(--text)"
              textAnchor="end"
            >
              {label}
            </text>
            <path d={rightRoundedBarPath(LABEL_WIDTH, y, barWidth, BAR_HEIGHT)} fill={STATUS_COLOR[d.status]} />
            <text
              x={LABEL_WIDTH + barWidth + 6}
              y={y + BAR_HEIGHT / 2 + 4}
              fontSize={11}
              fill="var(--muted)"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {valueFormatter(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
