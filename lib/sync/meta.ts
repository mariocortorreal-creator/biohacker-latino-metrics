import type { SupabaseClient } from "@supabase/supabase-js";

const GRAPH = "https://graph.facebook.com/v19.0";

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url.toString());
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message ?? `Graph API error (${res.status})`);
  return body;
}

// Page Insights: seguidores + impresiones del día.
export async function syncFacebook(supabase: SupabaseClient, channelDbId: string) {
  const pageId = process.env.META_PAGE_ID!;
  const token = process.env.META_PAGE_ACCESS_TOKEN!;
  const today = new Date().toISOString().slice(0, 10);

  const page = await graphGet(pageId, { fields: "fan_count", access_token: token });
  const insights = await graphGet(`${pageId}/insights`, {
    metric: "page_impressions,page_engaged_users",
    period: "day",
    access_token: token,
  });
  const impressions =
    insights.data?.find((d: any) => d.name === "page_impressions")?.values?.slice(-1)[0]
      ?.value ?? 0;

  await supabase.from("daily_snapshots").upsert(
    {
      channel_id: channelDbId,
      date: today,
      followers_or_subs: page.fan_count ?? 0,
      views_total: impressions,
    },
    { onConflict: "channel_id,date" }
  );
}

// Cuenta de Instagram Business + métricas por post reciente.
export async function syncInstagram(supabase: SupabaseClient, channelDbId: string) {
  const igId = process.env.META_IG_BUSINESS_ACCOUNT_ID!;
  const token = process.env.META_PAGE_ACCESS_TOKEN!;
  const today = new Date().toISOString().slice(0, 10);

  const account = await graphGet(igId, {
    fields: "followers_count,media_count",
    access_token: token,
  });

  await supabase.from("daily_snapshots").upsert(
    {
      channel_id: channelDbId,
      date: today,
      followers_or_subs: account.followers_count ?? 0,
      views_total: null,
    },
    { onConflict: "channel_id,date" }
  );

  const media = await graphGet(`${igId}/media`, {
    fields: "id,caption,timestamp,permalink,like_count,comments_count",
    limit: "25",
    access_token: token,
  });

  for (const m of media.data ?? []) {
    const { data: item } = await supabase
      .from("content_items")
      .upsert(
        {
          channel_id: channelDbId,
          platform: "instagram",
          external_id: m.id,
          published_at: m.timestamp,
          type: "post",
          title_or_caption: m.caption ?? null,
          url: m.permalink,
        },
        { onConflict: "platform,external_id" }
      )
      .select()
      .single();
    if (!item) continue;

    await supabase.from("content_metrics_daily").upsert(
      {
        content_item_id: item.id,
        date: today,
        likes: m.like_count ?? 0,
        comments: m.comments_count ?? 0,
      },
      { onConflict: "content_item_id,date" }
    );
  }
}
