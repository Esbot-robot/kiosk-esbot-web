// ─────────────────────────────────────────────────────────────────────────
// Edge Function "alerta-bateria"
//
// Avisa por correo cuando un robot se está quedando sin batería y nadie lo
// ha llevado a cargar. La llama una tarea programada (pg_cron) cada minuto;
// ver supabase/alerta_bateria.sql.
//
//   · 15 % o menos y sin cargar  -> primer aviso
//   · 5 % o menos y sin cargar   -> segundo aviso, urgente
//   · cargando o 25 % o más      -> se reinicia: la próxima descarga vuelve a avisar
//
// Solo cuenta robots con latido reciente: un robot apagado deja su última
// batería guardada y no debe disparar avisos viejos.
//
// Lo que ya se avisó queda en la tabla alertas_bateria (no en robot_status:
// escribir ahí con la clave de servicio cuenta como latido y lo mostraría
// «en línea»).
//
// Es segura aunque cualquiera pudiera llamarla: cada aviso sale una sola vez
// por descarga, y el único parámetro ({"mantener": true}) solo hace una lectura.
//
// Brevo da de baja las claves que pasan 90 días sin uso: una tarea diaria llama
// con {"mantener": true} y la función hace una consulta de solo lectura (no envía
// nada), para que la clave siga viva aunque ningún robot baje del 15 %.
//
// Secretos (Edge Functions -> Secrets), ninguno va en el código:
//   BREVO_API_KEY       clave de Brevo (solo «correos transaccionales: enviar»)
//   ALERTA_CORREOS      destinatarios separados por coma
//   ALERTA_REMITENTE    opcional; por defecto alertas@esbot.co (esbot.co ya está autenticado en Brevo)
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

const NIVEL_AVISO = 15
const NIVEL_URGENTE = 5
/** con esto o más (o cargando) se da por cargado y se reinicia el aviso */
const NIVEL_REINICIO = 25
/** sin latido hace más de esto, la batería guardada ya no es confiable */
const LATIDO_RECIENTE_MS = 3 * 60_000

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

interface Robot {
  serial: string
  nombre: string | null
  bateria: number | null
  cargando: boolean | null
  updated_at: string
}

function escapar(texto: string): string {
  return texto.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
}

async function enviarCorreo(asunto: string, texto: string, html: string): Promise<void> {
  const clave = Deno.env.get('BREVO_API_KEY')
  const destinatarios = (Deno.env.get('ALERTA_CORREOS') ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean)
  if (!clave || destinatarios.length === 0) throw new Error('Faltan BREVO_API_KEY o ALERTA_CORREOS en los secretos')
  const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': clave, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'Kiosk Esbot', email: Deno.env.get('ALERTA_REMITENTE') || 'alertas@esbot.co' },
      to: destinatarios.map((email) => ({ email })),
      subject: asunto,
      textContent: texto,
      htmlContent: html,
    }),
  })
  if (!respuesta.ok) throw new Error(`Brevo respondió ${respuesta.status}: ${await respuesta.text()}`)
}

/** Consulta de solo lectura a Brevo: mantiene viva la clave (caduca tras 90 días sin uso) */
async function mantenerClave(): Promise<Response> {
  const clave = Deno.env.get('BREVO_API_KEY')
  if (!clave) return Response.json({ error: 'Falta BREVO_API_KEY en los secretos' }, { status: 500 })
  const hoy = new Date().toISOString().slice(0, 10)
  const respuesta = await fetch(
    `https://api.brevo.com/v3/smtp/statistics/aggregatedReport?startDate=${hoy}&endDate=${hoy}`,
    { headers: { 'api-key': clave, accept: 'application/json' } }
  )
  // Con error se devuelve lo que dijo Brevo (clave inválida, IP no autorizada…): no trae datos sensibles
  const detalle = respuesta.ok ? undefined : (await respuesta.text()).slice(0, 300)
  return Response.json({ mantener: respuesta.status, detalle }, { status: respuesta.ok ? 200 : 500 })
}

Deno.serve(async (req) => {
  const cuerpo = (await req.json().catch(() => ({}))) as { mantener?: boolean }
  if (cuerpo.mantener) return await mantenerClave()

  const db = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), { auth: { persistSession: false } })

  const [robots, avisos, asignados] = await Promise.all([
    db.from('robot_status').select('serial, nombre, bateria, cargando, updated_at'),
    db.from('alertas_bateria').select('serial, nivel'),
    db.from('robots').select('serial, projects(nombre)'),
  ])
  if (robots.error) return Response.json({ error: robots.error.message }, { status: 500 })
  if (avisos.error) return Response.json({ error: avisos.error.message }, { status: 500 })

  const avisado = new Map((avisos.data ?? []).map((a) => [a.serial as string, a.nivel as number]))
  const proyecto = new Map(
    ((asignados.data ?? []) as unknown as { serial: string; projects: { nombre: string } | null }[]).map((r) => [
      r.serial,
      r.projects?.nombre ?? '',
    ])
  )
  const ahora = Date.now()
  const enviados: string[] = []
  const errores: string[] = []

  for (const r of (robots.data ?? []) as Robot[]) {
    const nivelAvisado = avisado.get(r.serial)

    // Ya cargó (o lo están cargando): la próxima descarga vuelve a avisar
    if (nivelAvisado !== undefined && (r.cargando || (r.bateria ?? 0) >= NIVEL_REINICIO)) {
      await db.from('alertas_bateria').delete().eq('serial', r.serial)
      continue
    }

    if (r.bateria == null || r.cargando) continue
    if (ahora - new Date(r.updated_at).getTime() > LATIDO_RECIENTE_MS) continue

    let nivel: number | null = null
    if (r.bateria <= NIVEL_URGENTE && (nivelAvisado === undefined || nivelAvisado > NIVEL_URGENTE)) nivel = NIVEL_URGENTE
    else if (r.bateria <= NIVEL_AVISO && nivelAvisado === undefined) nivel = NIVEL_AVISO
    if (nivel === null) continue

    const nombre = r.nombre || r.serial
    const nombreProyecto = proyecto.get(r.serial) || 'sin proyecto fijado'
    const hora = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', dateStyle: 'short', timeStyle: 'short' })
    const urgente = nivel === NIVEL_URGENTE
    const asunto = `${urgente ? 'URGENTE: ' : ''}${nombre} con ${r.bateria} % de batería`
    const accion = urgente
      ? 'Está a punto de apagarse. Llévelo a la base de carga.'
      : 'Llévelo a la base de carga antes de que se apague.'
    const texto =
      `${nombre} tiene ${r.bateria} % de batería y no está cargando.\n${accion}\n\n` +
      `Proyecto: ${nombreProyecto}\nSerial: ${r.serial}\nHora: ${hora}`
    const html = `<div style="font-family:Arial,sans-serif;font-size:15px">
<p style="font-size:18px;font-weight:bold">${escapar(nombre)}: ${r.bateria} % de batería</p>
<p>${escapar(accion)}</p>
<table style="border-collapse:collapse;margin-top:8px">
<tr><td style="padding:2px 12px 2px 0">Proyecto</td><td>${escapar(nombreProyecto)}</td></tr>
<tr><td style="padding:2px 12px 2px 0">Serial</td><td>${escapar(r.serial)}</td></tr>
<tr><td style="padding:2px 12px 2px 0">Hora</td><td>${escapar(hora)}</td></tr>
</table>
</div>`

    try {
      await enviarCorreo(asunto, texto, html)
      // Se guarda después de enviar: si el correo falla, se reintenta en el próximo minuto
      await db.from('alertas_bateria').upsert({ serial: r.serial, nivel, bateria: r.bateria, enviada_at: new Date().toISOString() })
      enviados.push(`${r.serial}:${nivel}`)
    } catch (e) {
      errores.push(`${r.serial}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return Response.json({ enviados, errores }, { status: errores.length ? 500 : 200 })
})
