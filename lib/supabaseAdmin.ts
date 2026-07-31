import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only: usa la service role key, nunca se expone al cliente.
// Instanciado perezosamente para no fallar en build cuando las env vars
// todavía no están configuradas (Next.js ejecuta el módulo en "collecting
// page data" incluso para rutas dinámicas).
let client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: { persistSession: false },
        // Next.js parchea el fetch global y cachea peticiones GET por URL
        // incluso en rutas "force-dynamic" — sin esto, PostgREST devuelve
        // siempre la primera respuesta que vio (ej. "sin canales" antes de
        // que corriera el cron), aunque los datos ya hayan cambiado.
        global: { fetch: (url, options) => fetch(url, { ...options, cache: "no-store" }) },
      }
    );
  }
  return client;
}
