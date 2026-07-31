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
      { auth: { persistSession: false } }
    );
  }
  return client;
}
