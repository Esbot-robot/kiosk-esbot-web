// ─────────────────────────────────────────────────────────────────────────
// Edge Function "limpiar-fotos"
//
// Borra las fotos vencidas (expira_at < ahora, es decir, de hace más de
// 7 días): primero los archivos del bucket "fotos" y después sus filas.
// La llama una tarea programada (pg_cron) una vez al día; ver
// supabase/limpieza_fotos.sql.
//
// Por qué una Edge Function y no un DELETE en SQL: Supabase no deja borrar
// archivos tocando storage.objects directamente, y aunque dejara, el archivo
// físico quedaría huérfano ocupando espacio. La API de Storage sí borra los
// dos. Esta función corre en los servidores de Supabase con la clave de
// servicio, que nunca sale de ahí.
//
// Es segura aunque cualquiera pudiera llamarla: no recibe parámetros y solo
// borra lo que ya está vencido, que igual se borraría esa noche. Lo peor que
// puede pasar es que la limpieza corra antes de la hora.
// ─────────────────────────────────────────────────────────────────────────
import { createClient } from 'npm:@supabase/supabase-js@2'

/** fotos por vuelta: 2 archivos cada una = 1000, el máximo que borra Storage de una vez */
const POR_VUELTA = 500
/** tope por ejecución para no pasar el tiempo límite de la función */
const MAX_VUELTAS = 20

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

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), {
    auth: { persistSession: false },
  })

  let borradas = 0
  for (let vuelta = 0; vuelta < MAX_VUELTAS; vuelta++) {
    const { data: vencidas, error: errLeer } = await supabase
      .from('fotos')
      .select('id')
      .lt('expira_at', new Date().toISOString())
      .limit(POR_VUELTA)
    if (errLeer) return respuesta(500, { borradas, error: `leer fotos: ${errLeer.message}` })
    if (!vencidas || vencidas.length === 0) break

    // Cada foto tiene el archivo grande y la miniatura de la galería.
    // Si alguno ya no existe, Storage lo ignora sin error.
    const ids = vencidas.map((f) => f.id as string)
    const archivos = ids.flatMap((id) => [`${id}.jpg`, `${id}_mini.jpg`])
    const { error: errStorage } = await supabase.storage.from('fotos').remove(archivos)
    if (errStorage) {
      // No se borran las filas: mañana se reintenta con las mismas fotos.
      // Borrarlas ahora dejaría archivos que ya nadie sabría que existen.
      return respuesta(500, { borradas, error: `borrar archivos: ${errStorage.message}` })
    }

    const { error: errFilas } = await supabase.from('fotos').delete().in('id', ids)
    if (errFilas) return respuesta(500, { borradas, error: `borrar filas: ${errFilas.message}` })

    borradas += ids.length
    if (ids.length < POR_VUELTA) break // ya no quedan más
  }

  console.log(`limpiar-fotos: ${borradas} fotos vencidas borradas`)
  return respuesta(200, { borradas })
})

function respuesta(status: number, cuerpo: Record<string, unknown>) {
  if (status !== 200) console.error('limpiar-fotos:', cuerpo)
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
