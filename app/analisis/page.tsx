import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { analyzeContent, computeGrowthTrend, type ContentInsightItem } from "@/lib/analysis";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
};

async function getAnalysis() {
  const supabaseAdmin = getSupabaseAdmin();

  const { data: items } = await supabaseAdmin
    .from("content_items")
    .select("id, platform, title_or_caption, url, published_at, content_metrics_daily(views, date)");

  const contentItems: ContentInsightItem[] = (items ?? []).map((item: any) => {
    const latest = [...(item.content_metrics_daily ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date)
    )[0];
    return {
      id: item.id,
      title: item.title_or_caption ?? "(sin título)",
      url: item.url,
      platform: item.platform,
      views: latest?.views ?? 0,
      publishedAt: item.published_at,
    };
  });

  const contentAnalysis = analyzeContent(contentItems);

  const { data: channels } = await supabaseAdmin.from("channels").select("*");
  const growthByChannel = [];
  for (const ch of channels ?? []) {
    const { data: snaps } = await supabaseAdmin
      .from("daily_snapshots")
      .select("date, followers_or_subs")
      .eq("channel_id", ch.id);
    const trend = computeGrowthTrend(
      (snaps ?? []).map((s) => ({ date: s.date, value: s.followers_or_subs }))
    );
    growthByChannel.push({ channel: ch, trend });
  }

  return { contentAnalysis, growthByChannel };
}

function ContentRow({
  item,
  variant,
}: {
  item: { title: string; url: string; platform: string; views: number; ratioVsMedian: number | null };
  variant: "good" | "bad";
}) {
  return (
    <div className="insight-row">
      <a href={item.url} target="_blank" rel="noreferrer">
        [{PLATFORM_LABEL[item.platform] ?? item.platform}] {item.title.slice(0, 70)}
      </a>
      <span className="insight-figure">
        <span className={`badge badge-${variant === "good" ? "good" : "bad"}`}>
          {item.ratioVsMedian !== null ? `${item.ratioVsMedian.toFixed(1)}x mediana` : "—"}
        </span>{" "}
        {item.views.toLocaleString("es")} vistas
      </span>
    </div>
  );
}

export default async function AnalisisPage() {
  const { contentAnalysis, growthByChannel } = await getAnalysis();
  const { medianViews, overperformers, underperformers, recentCount, matureCount } = contentAnalysis;

  return (
    <main>
      <h1>Análisis</h1>

      <section>
        <h2 className="section-title">Tendencia de crecimiento</h2>
        <p className="section-caption">
          Requiere al menos 2 días de snapshots por canal para poder calcular una tendencia real.
        </p>
        <div className="grid">
          {growthByChannel.map(({ channel, trend }) => (
            <div className="card" key={channel.id}>
              <h2>{PLATFORM_LABEL[channel.platform] ?? channel.platform}</h2>
              {trend.ready ? (
                <>
                  <p className="metric">
                    {trend.delta >= 0 ? "+" : ""}
                    {trend.delta.toLocaleString("es")}
                  </p>
                  <p className="label">
                    seguidores/subs desde {trend.from.date} ({trend.daysTracked} días de datos)
                  </p>
                </>
              ) : (
                <p className="label">
                  Llevamos {trend.daysTracked} día(s) de datos — necesitamos al menos 2 para
                  calcular una tendencia.
                </p>
              )}
            </div>
          ))}
          {growthByChannel.length === 0 && (
            <p className="label">Todavía no hay canales sincronizados.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">Lo que está funcionando</h2>
        <p className="section-caption">
          Contenido con al menos {medianViews > 0 ? "1.5x" : "—"} la mediana de vistas del canal
          ({medianViews.toLocaleString("es")} vistas), excluyendo publicaciones de los últimos 5
          días (todavía no tuvieron tiempo de recibir su alcance real).
        </p>
        <div className="insight-list">
          {overperformers.length === 0 && (
            <p className="label">Sin suficientes datos maduros todavía para detectar patrones.</p>
          )}
          {overperformers.map((item) => (
            <ContentRow key={item.id} item={item} variant="good" />
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title">Lo que no está funcionando</h2>
        <p className="section-caption">
          Contenido con la mitad o menos de la mediana de vistas del canal, mismo criterio de
          madurez (5+ días).
        </p>
        <div className="insight-list">
          {underperformers.length === 0 && (
            <p className="label">Sin suficientes datos maduros todavía para detectar patrones.</p>
          )}
          {underperformers.map((item) => (
            <ContentRow key={item.id} item={item} variant="bad" />
          ))}
        </div>
        {recentCount > 0 && (
          <p className="section-caption" style={{ marginTop: "0.75rem" }}>
            {recentCount} publicación(es) de los últimos 5 días excluida(s) del análisis —{" "}
            <span className="badge badge-neutral">todavía sin datos suficientes</span>
          </p>
        )}
        {matureCount === 0 && (
          <p className="label">Ninguna publicación tiene más de 5 días todavía.</p>
        )}
      </section>
    </main>
  );
}
