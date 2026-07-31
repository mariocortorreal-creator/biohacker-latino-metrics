import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
};

async function getTrends() {
  const { data: channels } = await supabaseAdmin.from("channels").select("*");
  const trends = [];
  for (const ch of channels ?? []) {
    const { data: snaps } = await supabaseAdmin
      .from("daily_snapshots")
      .select("*")
      .eq("channel_id", ch.id)
      .order("date", { ascending: false })
      .limit(30);
    trends.push({ channel: ch, snaps: snaps ?? [] });
  }
  return trends;
}

export default async function TendenciasPage() {
  const trends = await getTrends();

  return (
    <main>
      <h1>Tendencias (últimos 30 días)</h1>
      {trends.map(({ channel, snaps }) => (
        <section key={channel.id} style={{ marginBottom: "2rem" }}>
          <h2 style={{ color: "var(--muted)", fontWeight: 500, fontSize: "0.95rem" }}>
            {PLATFORM_LABEL[channel.platform] ?? channel.platform}
          </h2>
          {snaps.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>Sin datos todavía.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Seguidores/Subs</th>
                  <th>Vistas/Impresiones totales</th>
                </tr>
              </thead>
              <tbody>
                {snaps.map((s) => (
                  <tr key={s.id}>
                    <td>{s.date}</td>
                    <td>{s.followers_or_subs ?? "—"}</td>
                    <td>{s.views_total ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </main>
  );
}
