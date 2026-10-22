# Kiosk Esbot — Panel de administración

Panel web para configurar y supervisar los robots temi que ejecutan la app
[`app_events`](https://github.com/Esbot-robot/app_events) (carpeta `app_anato`),
sin recompilar la app: proyectos con sus pantallas y botones, estado de los
robots, analítica de interacciones, contactos de los visitantes y usuarios.

## Contenido

- [Stack](#stack)
- [Arquitectura](#arquitectura)
- [Roles](#roles)
- [Secciones del panel](#secciones-del-panel)
- [Estructura del código](#estructura-del-código)
- [Instalación](#instalación)
- [Desarrollo](#desarrollo)
- [Publicación y flujo de trabajo](#publicación-y-flujo-de-trabajo)
- [Seguridad](#seguridad)
- [Convenciones](#convenciones)

## Stack

| Parte | Tecnología |
|---|---|
| Interfaz | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Datos en el navegador | TanStack Query, React Router (router de datos) |
| Backend | Supabase: Postgres con RLS, Auth, Storage, Realtime y Edge Functions |
| Reportes | jsPDF (PDF de analítica), CSV generado en el navegador |
| Avisos | SweetAlert2 |
| Calidad | `tsc` (tipos) y oxlint (`npm run lint`) |
| Publicación | Cloudflare Pages |

## Arquitectura

```
Panel (este repo) ──sesión de usuario──▶ Supabase
                                          ├─ Postgres  projects, robots, robot_status, events,
                                          │            contactos, fotos, perfiles, actividad,
                                          │            robot_tokens …  (todo con RLS)
                                          ├─ Storage   media/  configs/{serial}.json  fotos/  apks/ (privado)
                                          ├─ Realtime  quién está en línea (canal privado)
                                          └─ Edge      usuarios · limpiar-fotos · azure-token · apk-descarga
                                                │
App del robot ◀── config pública ──────────────┘   (configs/{serial}.json, cacheada: funciona sin internet)
App del robot ──── token del robot ───────────────▶ funciones latido / registrar_evento / azure-token
```

- **El robot no inicia sesión.** Descarga su configuración de un archivo público y
  se identifica ante el servidor con un **token propio por robot** (ver
  [Seguridad](#seguridad)).
- **Los datos del panel viajan con la sesión del usuario** y las reglas de acceso
  (RLS) deciden qué ve cada rol.
- El contrato de la configuración es `src/types/config.ts`, espejo de
  `EventConfig.kt` en la app. Si cambia uno, cambia el otro.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **Super administrador** | Todo: proyectos, robots, usuarios, analítica completa, videollamadas, almacenamiento y la campana de actividad. |
| **Administrador** | Proyectos, robots (incluye vincular y dar de alta), contactos, analítica (sin Videollamadas ni Almacenamiento). Gestiona solo clientes lectores. |
| **Cliente lector** | Ve únicamente los proyectos que se le asignaron, sus contactos y su analítica (sin robots). No edita. |

Las reglas viven en la base (`supabase/roles.sql`): ocultar un botón en la interfaz
no es la protección, lo es la RLS.

## Secciones del panel

- **Proyectos** y **Editor**: pantalla inicial, botones (jugar/quiz, video, ubicación,
  secuencia, foto, registro, catálogo), preguntas, voces y tiempos. Cada guardado
  sube la config a `configs/{serial}.json` de los robots fijados.
- **Analítica**: *Interacciones* (gráfica, desglose por robot y proyecto, detalle,
  CSV y PDF), *Proyectos*, *Robots*, *Videollamadas* y *Almacenamiento*.
- **Robots**: estado en vivo, batería, versión de la config, ruta, modo quieto,
  órdenes (actualizar config, reiniciar app, videollamada, carita, decir algo) y
  **vínculo** (vincular, volver a vincular, revocar, agregar robot por serial) y
  **actualización remota de la app**: versión instalada de cada robot, *Versiones de la
  app* (subir y eliminar APK, solo super administrador) y *Actualizar app* por robot.
- **Contactos**: registros que dejan los visitantes por el formulario del QR.
- **Usuarios**: crear, editar y eliminar usuarios, quién está en línea y «Entrar como».
- **Ajustes** (menú del perfil): cambiar el propio nombre.
- **Galería** y **Registro** (públicas, por enlace): entrega de fotos y formulario del QR.

## Estructura del código

```
src/
  pages/        una página por ruta (Editor, Robots, Analitica*, Contactos, Usuarios…)
  components/   piezas compartidas; editor/ trae los popups de cada botón
  lib/          utilidades: supabase.ts, perfil.ts (roles), csv.ts, reportePdf.ts,
                usoMedia.ts, presencia.ts, usuariosApi.ts…
  types/config.ts   contrato de la configuración con la app
  paginas.ts    carga diferida de las páginas
supabase/
  *.sql             cambios de base de datos, cada uno con su *_revertir.sql
  functions/        Edge Functions (usuarios, limpiar-fotos, azure-token)
public/_headers     cabeceras de seguridad de Cloudflare Pages
public/_redirects   reenvío a index.html (aplicación de una sola página)
```

## Instalación

### 1. Supabase

1. Crear el proyecto en [supabase.com](https://supabase.com).
2. **Storage**: crear los buckets públicos `media` y `configs`, y `fotos`
   (público, 3 MB, solo `image/jpeg`; ver cabecera de `fotos.sql`).
3. **SQL Editor**: ejecutar los archivos de `supabase/` en este orden. Cada uno
   explica en su cabecera qué necesita antes y cómo deshacerlo:

   | # | Archivo | Para qué |
   |---|---|---|
   | 1 | `schema.sql` | **Solo instalación inicial**: tablas base y reglas. No volver a correrlo completo en producción (recrea políticas ya cerradas). |
   | 2 | `fotos.sql` | Botón «Tomar foto» y galería |
   | 3 | `contactos.sql` | Formulario de registro por QR |
   | 4 | `roles.sql` | Perfiles, roles y actividad. **Editar antes el correo del super administrador** (variable en el archivo). |
   | 5 | `roles_notificaciones.sql`, `roles_presencia.sql` | Campana y usuarios en línea |
   | 6 | `modo_quieto.sql`, `ruta_panel.sql`, `version_config.sql` | Órdenes por el latido |
   | 7 | `comandos_robot.sql`, `videollamada_prueba.sql`, `carita.sql`, `decir.sql` | Órdenes del panel al robot (cada una amplía `enviar_comando`) |
   | 8 | `quieto_sin_video.sql` | Modo quieto sin video |
   | 9 | `presencia_privada.sql` | Presencia en canal privado (antes de publicar el panel que lo usa) |
   | 10 | `cerrar_lectura_publica.sql` | Cierra la lectura anónima de `projects` y `robots` |
   | 11 | `limpieza_fotos.sql` | Borrado diario de fotos vencidas (requiere la función `limpiar-fotos` desplegada) |
   | 12 | `token_robot.sql`, `token_robot_alta.sql` | Token por robot y alta manual |
   | 12b | `ota_app.sql` | Actualización remota: bucket privado `apks`, versiones, versión instalada y orden `actualizar_app` (requiere `token_robot.sql` y `decir.sql`) |
   | 13 | `token_robot_cerrar.sql` | **Cierre**: quita el acceso anónimo directo de los robots. Solo con todos los robots vinculados. |

   `roles_smartbooks.sql` es una asignación de datos puntual: no forma parte de una
   instalación nueva. Los archivos `*_prueba.sql` simulan un robot ficticio y **no
   dejan nada** en la base: terminan con un error a propósito que deshace todo.
4. **Authentication → Users**: crear el usuario del super administrador (el correo
   que se puso en `roles.sql`).

### 2. Edge Functions

Se despliegan desde esta carpeta con la CLI de Supabase (`npx supabase login` y
`npx supabase link --project-ref <ref>` la primera vez):

```bash
npx supabase functions deploy usuarios
npx supabase functions deploy limpiar-fotos --no-verify-jwt
npx supabase functions deploy azure-token --no-verify-jwt
npx supabase functions deploy apk-descarga --no-verify-jwt
```

`azure-token` entrega a los robots vinculados un token temporal de Azure Speech,
para que la clave no viaje dentro de la APK. Sus secretos se guardan una sola vez
(la clave no se pega en chats ni se escribe en el repositorio):

```bash
npx supabase secrets set AZURE_SPEECH_KEY=<clave> AZURE_SPEECH_REGION=eastus
npx supabase secrets list      # muestra el nombre y la huella (SHA-256) de cada secreto
```

### 3. Variables de entorno

Copiar `.env.example` a `.env` y completar con *Settings → API*:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (clave pública; la protección está en la RLS, no en ocultarla)

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm run lint     # oxlint
npm run build    # tsc -b && vite build  → dist/
```

Antes de abrir un PR deben pasar `npm run lint` y `npm run build`.

## Publicación y flujo de trabajo

- `main` es producción: **Cloudflare Pages despliega cada fusión**. No se hace push
  directo a `main`.
- **Una rama por tarea** (`feature/…`, `hotfix/…`), Pull Request hacia `main` y
  «Squash and merge». Las ramas se borran al fusionar.
- Cada PR genera una **vista previa** de Cloudflare, que usa la misma base de
  producción: no hay entorno de pruebas todavía.
- Variables en Cloudflare: las mismas del `.env`.
- **Orden al publicar un cambio que toca varias partes:**
  SQL → funciones (`functions deploy`) → panel → APK de la app.
  Una columna o función nueva debe existir **antes** de que algo la use.
- Los robots con la app anterior siguen conectados: las columnas nuevas aceptan
  vacío y no se borra ni se cambia nada que la app vieja use.

## Seguridad

- **RLS en todas las tablas.** Cada rol ve solo lo suyo; las reglas restrictivas de
  `roles.sql` se suman a las anteriores.
- **Token por robot.** El robot se vincula una sola vez con un código de 8
  caracteres generado en el panel (*Robots → Vincular*; vale 15 minutos, un solo
  uso, 5 intentos). La base solo guarda la huella del token. El latido y los
  eventos pasan por las funciones `latido` y `registrar_evento`, que validan el
  token. Con `token_robot_cerrar.sql` el camino anónimo directo queda cerrado.
- **Actualización remota (OTA):** solo el super administrador sube versiones y ordena
  actualizar. La APK vive en un bucket **privado**; el robot la descarga con un enlace
  temporal (10 minutos) que `apk-descarga` entrega solo si el token del robot es válido
  **y** se le ordenó esa versión. El robot verifica huella, paquete, versión y firma, y
  Android exige que una persona confirme la instalación en su pantalla.
- **Funciones con permisos mínimos:** las de panel exigen sesión y rol; las de robot,
  su token. Ninguna tabla sensible se lee con la clave pública.
- **Cabeceras** (`public/_headers`): anti-sniffing, anti-iframe, HSTS y una política
  de contenido (CSP) en modo *report-only*.
- **CSV:** los textos que escriben los visitantes se neutralizan (`src/lib/csv.ts`)
  para que Excel no los ejecute como fórmula.
- **Secretos:** nunca en el repositorio. Los de las funciones viven en
  `supabase secrets`; la clave de Azure ya no va en la APK.
- **Operaciones destructivas:** respaldo (CSV o copia) antes de cualquier SQL que
  borre datos.

## Convenciones

- **Cambios de base de datos:** un archivo `.sql` por cambio, repetible
  (`if not exists`), con su `_revertir.sql`, y una cabecera que diga qué hace, el
  orden de aplicación y cómo deshacerlo. Los archivos ya aplicados no se editan:
  se escribe uno nuevo.
- **Commits** en inglés, claros y por tarea.
- **Texto del panel:** tono institucional y directo, con «Ingrese», «Seleccione»
  y comillas «».
- **Idioma del código:** los nombres existentes están en español; el código nuevo
  debería ir en inglés. Los contratos con la app y la base (claves del JSON,
  columnas, tipos de evento) no se renombran sin una migración.
