# CLAUDE.md

Contexto para Claude Code al trabajar en este repo. Léelo antes de tocar
código — evita repetir bugs ya resueltos y decisiones ya tomadas.

## Qué es esto

Dashboard personal (no un producto para vender) de métricas de YouTube,
Facebook e Instagram para el canal **Biohacker Latino**, construido para
Mario. Es la alternativa gratuita a pagar Supermetrics — agrega las 3
plataformas en un solo lugar, cosa que ningún analytics nativo hace.

**Separado por completo de `biohacker-score`** (la app de scoring de salud,
otro repo) — ni código ni infraestructura compartida, a propósito.

## Estado real (no asumas — corre las queries)

- YouTube: **conectado y funcionando**, sincroniza el catálogo completo.
- Facebook / Instagram: **pendientes** — Mario pidió explícitamente dejarlos
  para después de que YouTube esté sólido. No los actives sin que él lo pida.
- Para saber el estado real de los datos (no lo que dice este archivo, que
  puede quedar desactualizado), consulta directo con el MCP de Supabase:
  `select platform, status, message, ran_at from sync_log order by ran_at desc limit 10;`
  contra el proyecto `tqpjsnkhtzjqkcbwjpfh`.

## Arquitectura (ver README.md para el detalle completo)

```
Vercel Cron (diario, 10:00 UTC) → /api/cron/sync
  → lib/sync/youtube.ts (YouTube Data API v3, uploads playlist paginada)
  → lib/sync/meta.ts (Facebook/Instagram Graph API — pendiente activar)
  → Supabase Postgres (proyecto tqpjsnkhtzjqkcbwjpfh, RLS on, solo service role)
      ↓
Dashboard Next.js (App Router) lee la DB, nunca llama APIs externas directo
  /            Resumen
  /tendencias  Series de tiempo por canal
  /contenido   Ranking simple de todo el contenido
  /analisis    Gráfico de barras vs mediana + hero figure + tendencia
```

## Reglas antes de tocar código

1. **`getSupabaseAdmin()` es perezoso a propósito** (`lib/supabaseAdmin.ts`).
   No lo vuelvas a instanciar a nivel de módulo — rompe el build.
2. **El cliente de Supabase pasa `cache: "no-store"` a propósito.** Sin eso,
   Next.js cachea las respuestas de PostgREST y el dashboard sirve datos
   viejos para siempre, sin error visible.
3. **Cada plataforma del cron corre con su propio try/catch** (`runPlatform`
   en `app/api/cron/sync/route.ts`). Si agregas una plataforma nueva, síguela
   aislando — una plataforma sin credenciales nunca debe tumbar a las demás.
4. **YouTube se sincroniza vía `playlistItems.list` sobre la uploads
   playlist**, no `search.list` (ver `lib/sync/youtube.ts`) — es 100x más
   barato en cuota y trae TODO el catálogo, no solo los últimos N. Si algo se
   ve que "dejó de actualizar" un video viejo, probablemente alguien volvió a
   usar `search.list` con un límite.
5. **Deploys son manuales vía `deploy_to_vercel`** (o el dashboard de
   Vercel), no vía push a Git — el proyecto de Vercel no está conectado al
   repo. Después de cada `git push` a este repo, hay que redeployar aparte.
6. **No pongas secretos reales en archivos del repo** (ni en commits, ni en
   este archivo). Van solo como env vars en Vercel → Settings → Environments.
7. **Estilo de código**: sin librería de UI ni de gráficas — CSS plano en
   `app/globals.css` con variables (`--bg`, `--panel`, `--accent`, `--good`,
   `--bad`, etc.), gráficos hechos a mano en SVG cuando hacen falta (ver
   `app/analisis/BarChart.tsx`) siguiendo el skill de dataviz: barras
   delgadas con extremo redondeado, línea de mediana como referencia, cifras
   grandes sueltas en fuente proporcional (nunca `tabular-nums` fuera de
   tablas).

## Al agregar Facebook/Instagram (cuando Mario lo pida)

1. Guiar Fase 0 de Meta paso a paso (ver README.md — developers.facebook.com,
   Page Access Token, IG Business Account ID).
2. Las funciones `syncFacebook`/`syncInstagram` en `lib/sync/meta.ts` ya
   existen y están cableadas en el cron — solo faltan las env vars
   `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`.
3. El Page Access Token expira ~60 días — avisar a Mario o automatizar el
   refresco cuando llegue el momento.
