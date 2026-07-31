# biohacker-latino-metrics

Dashboard personal de métricas (YouTube, Facebook, Instagram) para el canal
Biohacker Latino. Proyecto separado de `biohacker-score` — no comparte código
ni infraestructura.

## Arquitectura

Un cron diario (`/api/cron/sync`, programado en `vercel.json`) jala datos de
las 3 plataformas y los guarda en Postgres (Supabase). El dashboard Next.js
lee esa base de datos y no llama a las APIs externas directamente.

- Base de datos: proyecto Supabase `biohacker-latino-metrics` (ya creado,
  RLS activado en las 5 tablas — solo la service role key puede leer/escribir,
  el anon key no tiene acceso).
- Dashboard: 3 vistas — Resumen (`/`), Tendencias (`/tendencias`), Contenido (`/contenido`).

## Configuración (Fase 0 del plan)

Copia `.env.example` a `.env.local` y completa cada variable. Las de Supabase
ya están resueltas (ver abajo); las de YouTube y Meta requieren pasos manuales
en tus cuentas — no hay forma de automatizarlos, hay que hacerlos una vez:

### Supabase (ya resuelto)
```
NEXT_PUBLIC_SUPABASE_URL=https://tqpjsnkhtzjqkcbwjpfh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<obtenla del panel de Supabase → Project Settings → API → service_role>
```

### YouTube (Google Cloud)
1. Crea un proyecto en [Google Cloud Console](https://console.cloud.google.com/).
2. Habilita **YouTube Data API v3** y **YouTube Analytics API**.
3. Crea credenciales OAuth 2.0 (tipo "Desktop app" o "Web app").
4. Genera un refresh token una sola vez autorizando con la cuenta de Google
   dueña del canal (hay scripts de ejemplo de Google para esto — el flujo es
   local, una sola vez, no queda expuesto).
5. Completa `YOUTUBE_CHANNEL_ID`, `YOUTUBE_OAUTH_CLIENT_ID`,
   `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REFRESH_TOKEN`.

### Meta (Facebook Page + Instagram Business)
1. Crea una app en [developers.facebook.com](https://developers.facebook.com/).
2. Agrégate como admin/tester de la app (evita el proceso de App Review,
   válido porque solo accedes a tus propios activos).
3. Genera un Page Access Token de larga duración (~60 días) con permisos
   `pages_read_engagement` y `read_insights`.
4. Obtén el Instagram Business Account ID vinculado a la Page.
5. Completa `META_PAGE_ID`, `META_PAGE_ACCESS_TOKEN`, `META_IG_BUSINESS_ACCOUNT_ID`.

El Page Access Token expira cada ~60 días — hay que regenerarlo periódicamente
(pendiente automatizar el refresco en una fase futura).

### Cron
Define `CRON_SECRET` con cualquier valor aleatorio; Vercel Cron lo manda
automáticamente como `Authorization: Bearer <CRON_SECRET>` si defines la misma
variable en el proyecto de Vercel.

## Desarrollo local

```
npm install
npm run dev
```

## Seguridad

El dashboard no tiene su propio login — cualquiera con la URL de producción
puede verlo. Antes de compartir el link o dejarlo público, activa la
protección de despliegue de Vercel (contraseña o Vercel Authentication) desde
la configuración del proyecto.
