import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

const PLATFORM_LABEL: Record<string, string> = {
  youtube: "YouTube",
  facebook: "Facebook",
  instagram: "Instagram",
};

async function getOverview() {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: channels } = await supabaseAdmin.from("channels").select("*");
  const cards = [];
  for (const ch of channels ?? []) {
    const { data: snaps } = await supabaseAdmin
      .from("daily_snapshots")
      .select("*")
      .eq("channel_id", ch.id)
      .order("date", { ascending: false })
      .limit(2);
    const [today, yesterday] = snaps ?? [];
    cards.push({ channel: ch, today, yesterday });
  }
  return cards;
}

export default async function OverviewPage() {
  const cards = await getOverview();

  return (
    <main>
      <h1>Resumen</h1>
      {cards.length === 0 && (
        <p>
          Todavía no hay canales configurados. Se crean automáticamente la primera vez que
          corre el cron diario (<code>/api/cron/sync</code>).
        </p>
      )}
      <div className="grid">
        {cards.map(({ channel, today, yesterday }) => {
          const delta =
            today && yesterday
              ? (today.followers_or_subs ?? 0) - (yesterday.followers_or_subs ?? 0)
              : null;
          return (
            <div className="card" key={channel.id}>
              <h2>{PLATFORM_LABEL[channel.platform] ?? channel.platform}</h2>
              <p className="metric">{today?.followers_or_subs ?? "—"}</p>
              <p className="label">seguidores / suscriptores</p>
              {delta !== null && (
                <p className={`delta ${delta >= 0 ? "up" : "down"}`}>
                  {delta >= 0 ? "+" : ""}
                  {delta} vs. ayer
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
