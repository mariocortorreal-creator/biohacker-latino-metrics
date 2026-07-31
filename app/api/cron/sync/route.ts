import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { syncYoutube } from "@/lib/sync/youtube";
import { syncFacebook, syncInstagram } from "@/lib/sync/meta";

export const dynamic = "force-dynamic";

async function ensureChannel(platform: string, externalId: string, name: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("channels")
    .upsert({ platform, external_id: externalId, name }, { onConflict: "platform,external_id" })
    .select()
    .single();
  if (error) throw error;
  return data.id as string;
}

// Corre la sincronización de una plataforma de forma aislada: si falla
// (por ejemplo, porque a esa plataforma todavía le faltan credenciales),
// se registra el error en sync_log y las demás plataformas siguen su curso.
async function runPlatform(platform: string, fn: () => Promise<void>) {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    await fn();
    await supabaseAdmin.from("sync_log").insert({ platform, status: "success" });
  } catch (err) {
    await supabaseAdmin.from("sync_log").insert({
      platform,
      status: "error",
      message: (err as Error).message,
    });
  }
}

// Vercel Cron llama este endpoint una vez al día (ver vercel.json) con
// Authorization: Bearer <CRON_SECRET>.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  await runPlatform("youtube", async () => {
    const ytChannelId = process.env.YOUTUBE_CHANNEL_ID!;
    const ytDbId = await ensureChannel("youtube", ytChannelId, "Biohacker Latino (YouTube)");
    await syncYoutube(getSupabaseAdmin(), ytDbId, ytChannelId);
  });

  await runPlatform("facebook", async () => {
    const fbPageId = process.env.META_PAGE_ID!;
    const fbDbId = await ensureChannel("facebook", fbPageId, "Biohacker Latino (Facebook)");
    await syncFacebook(getSupabaseAdmin(), fbDbId);
  });

  await runPlatform("instagram", async () => {
    const igId = process.env.META_IG_BUSINESS_ACCOUNT_ID!;
    const igDbId = await ensureChannel("instagram", igId, "Biohacker Latino (Instagram)");
    await syncInstagram(getSupabaseAdmin(), igDbId);
  });

  return NextResponse.json({ ok: true });
}
