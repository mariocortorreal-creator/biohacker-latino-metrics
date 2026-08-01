# biohacker-latino-metrics

Dashboard personal de métricas (YouTube, Facebook, Instagram) para el canal
Biohacker Latino. Proyecto separado de `biohacker-score` — no comparte código
ni infraestructura.

## Estado actual (1 ago 2026)

- ✅ **YouTube**: conectado y sincronizando de verdad. Trae el **catálogo
  completo** de videos (57 al momento de escribir esto, no solo los últimos
  25 — ver "Decisiones técnicas" abajo) + stats del canal, una vez al día vía
  cron.
- ⏳ **Facebook e Instagram**: pendientes a propósito — Mario decidió dejar
  YouTube sólido primero antes de sumar Meta. El cron ya está preparado para
  las 3 plataformas; Facebook/Instagram solo fallan hoy porque faltan sus
  variables de entorno (`META_*`), y fallan de forma aislada sin afectar a
  YouTube.
- ✅ Dashboard desplegado y funcionando: https://biohacker-latino-metrics.vercel.app
  (protegido por Vercel Authentication — solo la cuenta de Mario puede verlo).
- ✅ Panel de **Análisis** con detección de contenido sobre/bajo la mediana
  del canal (gráfico de barras) y tendencia de crecimiento (bloqueada hasta
  tener ≥2 días de snapshots).

## Arquitectura

Un cron diario (`/api/cron/sync`, programado en `vercel.json`, corre a las
10:00 UTC) jala datos de las 3 plataformas y los guarda en Postgres
(Supabase). El dashboard Next.js lee esa base de datos y no llama a las APIs
externas directamente.

- Base de datos: proyecto Supabase `biohacker-latino-metrics`
  (`tqpjsnkhtzjqkcbwjpfh`), RLS activado en las 5 tablas — solo la service
  role key puede leer/escribir, el publishable/anon key no tiene acceso.
- Dashboard: 4 vistas — Resumen (`/`), Tendencias (`/tendencias`),
  Contenido (`/contenido`), Análisis (`/analisis`).
- Vercel: proyecto `biohacker-latino-metrics` bajo el team
  `mariocortorreal-4715s-projects`.

## Decisiones técnicas (para no repetir errores ya resueltos)

- **Cliente de Supabase instanciado perezosamente** (`lib/supabaseAdmin.ts`):
  si se crea a nivel de módulo, el build de Next.js falla en "collecting page
  data" cuando las env vars todavía no existen.
- **Cache de `fetch` desactivado explícitamente** en el cliente de Supabase:
  Next.js parchea `fetch` globalmente y cachea peticiones GET por URL incluso
  en rutas `force-dynamic`. Sin `cache: "no-store"` el dashboard sirve datos
  viejos indefinidamente (nos pasó: mostraba "sin canales" incluso después de
  que el cron ya había corrido).
- **Cada plataforma del cron corre aislada** (`runPlatform` en
  `app/api/cron/sync/route.ts`): si a Facebook/Instagram les faltan
  credenciales, YouTube igual se sincroniza y responde 200.
- **Sync de YouTube vía uploads playlist, no `search.list`**
  (`lib/sync/youtube.ts`): `search.list` cuesta 100 unidades de cuota y solo
  traía los últimos 25 videos — un canal que publica seguido dejaba de
  actualizar videos viejos en menos de un mes. `playlistItems.list` sobre la
  uploads playlist del canal cuesta 1 unidad por página y trae TODO el
  catálogo, paginado.
- **Los números grandes (stat tiles / hero figure) no usan `tabular-nums`**
  — esa fuente es solo para columnas de tablas; en cifras sueltas se ve
  desalineada. Ver `app/globals.css`.
- **Deploys van directo a Vercel, no vía integración de Git.** Un `git push`
  a este repo *no* dispara un deploy automático — el proyecto de Vercel no
  está conectado al repo de GitHub, los deploys se hicieron con la
  herramienta `deploy_to_vercel` pasando el árbol de archivos directo. Si en
  el futuro se quiere auto-deploy on push, hay que conectar el repo desde el
  dashboard de Vercel (Settings → Git).

## Configuración (Fase 0 del plan)

Copia `.env.example` a `.env.local` y completa cada variable. Las de Supabase
y YouTube ya están resueltas en producción (valores reales en Vercel →
Settings → Environments → Production); Meta sigue pendiente.

### Supabase (resuelto)
```
NEXT_PUBLIC_SUPABASE_URL=https://tqpjsnkhtzjqkcbwjpfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<Project Settings → API → clave secret/service_role>
```

### YouTube (resuelto — Google Cloud)
Ya configurado en producción: proyecto de Google Cloud creado, YouTube Data
API v3 + YouTube Analytics API habilitadas, OAuth client tipo "Desktop app",
refresh token generado y cargado en Vercel. Si hay que regenerar el refresh
token algún día, el flujo es:
1. Google Cloud Console → el proyecto ya existe → APIs & Services → Credentials.
2. Genera un nuevo refresh token autorizando con la cuenta dueña del canal
   (scopes: `youtube.readonly`, `yt-analytics.readonly`).
3. Actualiza `YOUTUBE_OAUTH_REFRESH_TOKEN` en Vercel y redeploy.

### Meta — Facebook Page + Instagram Business (pendiente)
1. Crea una app en [developers.facebook.com](https://developers.facebook.com/).
2. Agrégate como admin/tester de la app (evita el proceso de App Review,
   válido porque solo accedes a tus propios activos).
3. Genera un Page Access Token de larga duración (~60 días) con permisos
   `pages_read_engagement` y `read_insights`.
4. Obtén el Instagram Business Account ID vinculado a la Page.
5. Completa `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`
   en Vercel → Settings → Environments → Production, y redeploy.

El Page Access Token expira cada ~60 días — hay que regenerarlo periódicamente
(pendiente automatizar el refresco en una fase futura).

### Cron
`CRON_SECRET` ya está configurado en producción. Vercel Cron lo manda
automáticamente como `Authorization: Bearer <CRON_SECRET>`.

## Desarrollo local

```
npm install
npm run dev
```

## Seguridad

El dashboard no tiene su propio login, pero Vercel Authentication ya protege
la URL de producción por defecto — solo la cuenta de Vercel de Mario puede
verla. No hace falta configurar contraseña adicional a menos que se quiera
compartir el link con alguien más.

## Próximos pasos

1. Dejar correr el cron unos días para que "Tendencia de crecimiento" en
   `/analisis` tenga suficiente historial (necesita ≥2 días de snapshots).
2. Cuando Mario esté listo: completar Fase 0 de Meta (credenciales de
   Facebook/Instagram arriba) y confirmar que el cron las sincroniza.
3. Evaluar traer datos de YouTube Analytics API (watch time, fuentes de
   tráfico) — ya tenemos el scope OAuth, falta usarlo; daría análisis más
   profundo que solo vistas/likes/comentarios públicos.
