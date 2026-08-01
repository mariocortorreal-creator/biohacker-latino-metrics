import { google, youtube_v3 } from "googleapis";
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

// Recorre la playlist de "subidos" del canal (1 unidad de cuota por página,
// contra 100 de search.list) y junta TODOS los video IDs — no solo los
// últimos N. Sin esto, un canal que publica seguido deja de actualizar sus
// videos más viejos en cuanto salen de la ventana de "más recientes".
async function listAllVideoIds(youtube: youtube_v3.Youtube, uploadsPlaylistId: string) {
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await youtube.playlistItems.list({
      part: ["contentDetails"],
      playlistId: uploadsPlaylistId,
      maxResults: 50,
      pageToken,
    });
    for (const item of res.data.items ?? []) {
      if (item.contentDetails?.videoId) videoIds.push(item.contentDetails.videoId);
    }
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);

  return videoIds;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

// Trae stats del canal + TODO el catálogo de videos y guarda snapshot diario.
export async function syncYoutube(
  supabase: SupabaseClient,
  channelDbId: string,
  channelId: string
) {
  const youtube = getYoutubeClient();
  const today = new Date().toISOString().slice(0, 10);

  const channelRes = await youtube.channels.list({
    part: ["statistics", "contentDetails"],
    id: [channelId],
  });
  const channel = channelRes.data.items?.[0];
  const stats = channel?.statistics;
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads;

  await supabase.from("daily_snapshots").upsert(
    {
      channel_id: channelDbId,
      date: today,
      followers_or_subs: Number(stats?.subscriberCount ?? 0),
      views_total: Number(stats?.viewCount ?? 0),
    },
    { onConflict: "channel_id,date" }
  );

  if (!uploadsPlaylistId) return;

  const videoIds = await listAllVideoIds(youtube, uploadsPlaylistId);
  if (videoIds.length === 0) return;

  for (const idBatch of chunk(videoIds, 50)) {
    const videosRes = await youtube.videos.list({
      part: ["snippet", "statistics"],
      id: idBatch,
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
}
