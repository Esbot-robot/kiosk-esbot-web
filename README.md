# Kiosk Esbot — Panel de administración

Panel web para configurar los módulos interactivos de la app del robot temi
(repo `app_anato`, rama `feature/config-remota`) sin recompilar la app.

## Stack

- **Frontend:** React 18 + Vite + TypeScript + Tailwind CSS
- **Backend:** Supabase (Postgres + Auth + Storage)
- **Deploy:** Cloudflare Pages (o cualquier hosting estático)

## Arquitectura

```
Panel (este repo) ──escribe──▶ Supabase
                                 ├─ projects (jsonb con EventConfig)
                                 ├─ robots   (serial → proyecto activo)
                                 └─ Storage  (media/ y configs/{serial}.json)
                                        │
App del robot ◀──GET simple sin headers─┘  (cachea y funciona offline)
```

El contrato de datos es `src/types/config.ts` — espejo exacto de
`EventConfig.kt` / `default_config.json` en la app Android. Si cambias uno,
cambia el otro.

## Configuración inicial (una sola vez)

1. Crear proyecto en [supabase.com](https://supabase.com)
2. SQL Editor → pegar y ejecutar `supabase/schema.sql`
3. Storage → crear buckets **públicos**: `media` y `configs`
4. Authentication → Users → **Add user** (el correo/contraseña del admin)
5. Copiar `.env.example` a `.env` y completar con Settings → API:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
```

## Deploy (Cloudflare Pages)

1. Subir este repo a GitHub
2. Cloudflare Dashboard → Pages → conectar el repo
3. Build command: `npm run build` — Output: `dist`
4. Variables de entorno: las mismas del `.env`
