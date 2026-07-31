import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";

function getYoutubeClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.YOUTUBE_OAUTH_CLIENT_ID,
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.YOUTUBE_OAUTH_REFRESH_TOKEN,
  });
  return google.youtube({ version: "v3", auth: oauth2Client });
}

// Trae stats del canal + últimos videos y guarda snapshot diario.
export async function syncYoutube(
  supabase: SupabaseClient,
  channelDbId: string,
  channelId: string
) {
  const youtube = getYoutubeClient();
  const today = new Date().toISOString().slice(0, 10);

  const channelRes = await youtube.channels.list({
    part: ["statistics"],
    id: [channelId],
  });
  const stats = channelRes.data.items?.[0]?.statistics;

  await supabase.from("daily_snapshots").upsert(
    {
      channel_id: channelDbId,
      date: today,
      followers_or_subs: Number(stats?.subscriberCount ?? 0),
      views_total: Number(stats?.viewCount ?? 0),
    },
    { onConflict: "channel_id,date" }
  );

  const searchRes = await youtube.search.list({
    part: ["id"],
    channelId,
    order: "date",
    maxResults: 25,
    type: ["video"],
  });
  const videoIds = (searchRes.data.items ?? [])
    .map((i) => i.id?.videoId)
    .filter((id): id is string => Boolean(id));
  if (videoIds.length === 0) return;

  const videosRes = await youtube.videos.list({
    part: ["snippet", "statistics"],
    id: videoIds,
  });

  for (const v of videosRes.data.items ?? []) {
    const { data: item } = await supabase
      .from("content_items")
      .upsert(
        {
          channel_id: channelDbId,
          platform: "youtube",
          external_id: v.id,
          published_at: v.snippet?.publishedAt,
          type: "video",
          title_or_caption: v.snippet?.title,
          url: `https://youtube.com/watch?v=${v.id}`,
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
        views: Number(v.statistics?.viewCount ?? 0),
        likes: Number(v.statistics?.likeCount ?? 0),
        comments: Number(v.statistics?.commentCount ?? 0),
      },
      { onConflict: "content_item_id,date" }
    );
  }
}
