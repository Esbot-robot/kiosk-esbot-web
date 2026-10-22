// ─────────────────────────────────────────────────────────────────────────
// Edge Function "azure-token"
//
// Entrega a un robot vinculado un token temporal (10 minutos) de Azure Speech,
// para que la clave de Azure NO tenga que ir dentro de la APK. La clave vive
// solo aquí, como secreto de la función:
//
//   supabase secrets set AZURE_SPEECH_KEY=... AZURE_SPEECH_REGION=eastus
//
// Cómo funciona:
//   1. El robot manda su serial y su token de robot (el de la vinculación,
//      ver supabase/token_robot.sql).
//   2. La función comprueba que ese token es válido (robot_token_valido).
//   3. Con la clave de Azure pide un token de 10 minutos y se lo devuelve.
//
// Un robot sin vincular, o con el vínculo revocado, no recibe nada. Y un token de
// Azure robado deja de servir a los 10 minutos.
//
// Se despliega SIN verificación JWT (la clave pública sb_publishable_... no es un
// JWT; la comprobación real la hace esta función con el token del robot):
//
//   supabase functions deploy azure-token --no-verify-jwt
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Los tokens de Azure duran 10 minutos; se avisa al robot un poco antes */
const VIDA_TOKEN_SEG = 540

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
    if (!serial || !token || serial.length > 40 || token.length > 200) {
      return respuesta({ error: 'datos_incompletos' }, 400)
    }

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: valido, error } = await admin.rpc('robot_token_valido', { p_serial: serial, p_token: token })
    if (error) throw error
    if (!valido) return respuesta({ error: 'token_invalido' }, 401)

    const clave = Deno.env.get('AZURE_SPEECH_KEY')
    const region = Deno.env.get('AZURE_SPEECH_REGION') ?? 'eastus'
    if (!clave) return respuesta({ error: 'voz_no_configurada' }, 503)

    const azure = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: 'POST',
      headers: { 'Ocp-Apim-Subscription-Key': clave, 'Content-Length': '0' },
    })
    if (!azure.ok) {
      // El texto de error de Azure no contiene la clave: sirve para saber si falla la clave, la región o el recurso
      const detalle = (await azure.text().catch(() => '')).slice(0, 300)
      console.error('Azure rechazó la petición del token', azure.status, 'región:', region, 'detalle:', detalle)
      return respuesta({ error: 'azure_rechazo', estado: azure.status }, 502)
    }
    return respuesta({ token: await azure.text(), region, expira_seg: VIDA_TOKEN_SEG })
  } catch (e) {
    console.error('azure-token', e)
    return respuesta({ error: 'error_interno' }, 500)
  }
})
