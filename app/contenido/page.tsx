import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
};

async function getRanking() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: items } = await supabaseAdmin
    .from("content_items")
    .select("*, content_metrics_daily(*)")
    .order("published_at", { ascending: false })
    .limit(50);

  return (items ?? [])
    .map((item: any) => {
      const latest = [...(item.content_metrics_daily ?? [])].sort((a, b) =>
        b.date.localeCompare(a.date)
      )[0];
      return { item, latest };
    })
    .sort((a, b) => (b.latest?.views ?? 0) - (a.latest?.views ?? 0));
}

export default async function ContenidoPage() {
  const ranking = await getRanking();

  return (
    <main>
      <h1>Ranking de contenido</h1>
      {ranking.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>Sin contenido sincronizado todavía.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Plataforma</th>
              <th>Título / caption</th>
              <th>Vistas</th>
              <th>Likes</th>
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {ranking.map(({ item, latest }) => (
              <tr key={item.id}>
                <td>{PLATFORM_LABEL[item.platform] ?? item.platform}</td>
                <td>
                  <a href={item.url} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
                    {(item.title_or_caption ?? "(sin título)").slice(0, 60)}
                  </a>
                </td>
                <td>{latest?.views ?? "—"}</td>
                <td>{latest?.likes ?? "—"}</td>
                <td>{latest?.comments ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
