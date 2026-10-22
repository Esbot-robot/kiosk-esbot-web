// ─────────────────────────────────────────────────────────────────────────
// Edge Function "apk-descarga"
//
// Entrega a un robot el enlace temporal para descargar la APK de la versión que el
// super administrador le ordenó (orden 'actualizar_app:<código>', ver supabase/ota_app.sql).
//
// Qué comprueba antes de entregar nada:
//   1. El token del robot es válido (robot_token_valido): un robot sin vincular o con el
//      vínculo revocado no recibe nada.
//   2. A ESE robot se le ordenó justamente esa versión: un robot no puede pedir otra
//      versión ni una APK que nadie le mandó instalar.
//   3. La versión existe.
// El enlace dura 10 minutos. Además del enlace entrega la huella SHA-256 y el tamaño, para
// que el robot compruebe el archivo antes de instalarlo.
//
// Se despliega SIN verificación JWT (la clave pública sb_publishable_... no es un JWT; la
// comprobación real la hace esta función con el token del robot):
//
//   supabase functions deploy apk-descarga --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** el enlace de descarga vence a los 10 minutos */
const VIDA_ENLACE_SEG = 600

/** Clave de servicio: la nueva (sb_secret_...) si existe; si no, la antigua */
function claveServicio(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const primera = Object.values(nuevas)[0]
    if (primera) return primera
  } catch {
    // formato inesperado: se usa la antigua
  }
  const antigua = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!antigua) throw new Error('No hay clave de servicio disponible en la función')
  return antigua
}

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return respuesta({ error: 'metodo_no_permitido' }, 405)

  try {
    const cuerpo = await req.json().catch(() => null)
    const serial = typeof cuerpo?.serial === 'string' ? cuerpo.serial : ''
    const token = typeof cuerpo?.token === 'string' ? cuerpo.token : ''
    const codigo = cuerpo?.version_code
    if (!serial || !token || serial.length > 40 || token.length > 200 || !Number.isInteger(codigo) || codigo < 1 || codigo > 999999) {
      return respuesta({ error: 'datos_incompletos' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: valido, error: errorToken } = await admin.rpc('robot_token_valido', { p_serial: serial, p_token: token })
    if (errorToken) throw errorToken
    if (!valido) return respuesta({ error: 'token_invalido' }, 401)

    // A este robot se le ordenó esta versión (y no otra)
    const { data: estado, error: errorEstado } = await admin
      .from('robot_status')
      .select('comando')
      .eq('serial', serial)
      .maybeSingle()
    if (errorEstado) throw errorEstado
    if (estado?.comando !== `actualizar_app:${codigo}`) return respuesta({ error: 'sin_orden' }, 403)

    const { data: version, error: errorVersion } = await admin
      .from('app_versiones')
      .select('version_code, version_name, apk_path, sha256, tamano_bytes')
      .eq('version_code', codigo)
      .maybeSingle()
    if (errorVersion) throw errorVersion
    if (!version) return respuesta({ error: 'version_inexistente' }, 404)

    const { data: firmado, error: errorEnlace } = await admin.storage
      .from('apks')
      .createSignedUrl(version.apk_path, VIDA_ENLACE_SEG)
    if (errorEnlace || !firmado?.signedUrl) {
      console.error('No se pudo firmar el enlace de la APK', errorEnlace?.message)
      return respuesta({ error: 'enlace_no_disponible' }, 500)
    }

    return respuesta({
      url: firmado.signedUrl,
      sha256: version.sha256,
      tamano_bytes: version.tamano_bytes,
      version_code: version.version_code,
      version_name: version.version_name,
    })
  } catch (e) {
    console.error('apk-descarga', e)
    return respuesta({ error: 'error_interno' }, 500)
  }
})
