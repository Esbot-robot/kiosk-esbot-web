/** Detalle que guardan los disparadores de actividad (ver supabase/roles.sql) */
export interface DetalleActividad {
  secciones?: string[]
  nombre_anterior?: string | null
  ruta?: string[]
}

/** Nombre legible de cada parte del proyecto que puede cambiar al guardar */
const SECCIONES: Record<string, string> = {
  'inicial.titulo': 'título',
  'inicial.titulo_visible': 'título',
  'inicial.subtitulo': 'subtítulo',
  'inicial.subtitulo_visible': 'subtítulo',
  'inicial.logo_url': 'logo',
  'inicial.logo_visible': 'logo',
  'inicial.fondo_url': 'fondo',
  'inicial.boton': 'botón Jugar',
  'inicial.boton_activo': 'botón Jugar',
  'inicial.botones_adicionales': 'botones adicionales',
  'inicial.boton_foto': 'botón de foto',
  'inicial.boton_registro': 'botón de registro',
  'inicial.video_patrullaje_url': 'video de patrullaje',
  'inicial.color_contador': 'color del contador',
  'ruleta.preguntas': 'preguntas',
  'ruleta.fondo_url': 'fondo de la ruleta',
  'ruleta.colores_opciones': 'colores de las respuestas',
  'ruleta.colores_texto_opciones': 'colores de las respuestas',
  'ruleta.despues_quiz': 'después del quiz',
}

function nombreSeccion(clave: string): string {
  if (SECCIONES[clave]) return SECCIONES[clave]
  if (clave.startsWith('inicial.tts_')) return 'voces'
  if (clave.startsWith('ruleta.tts_')) return 'voces de la ruleta'
  if (clave.startsWith('tiempos.')) return 'tiempos'
  return clave.split('.').pop() ?? clave
}

export function detalleLegible(a: { detalle?: DetalleActividad | null }): string | null {
  const secciones = [...new Set((a.detalle?.secciones ?? []).map(nombreSeccion))]
  const partes: string[] = []
  if (a.detalle?.nombre_anterior) partes.push(`antes se llamaba "${a.detalle.nombre_anterior}"`)
  if (secciones.length) partes.push(`cambió: ${secciones.join(', ')}`)
  if (a.detalle?.ruta?.length) partes.push(a.detalle.ruta.join(' → '))
  return partes.length ? partes.join(' · ') : null
}
