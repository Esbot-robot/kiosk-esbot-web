import type { EventConfig } from '../types/config'

/**
 * Progreso de un proyecto: 16 puntos fijos, iguales para todos los proyectos
 * (se usen o no). Lo que está apagado y falta se marca como "no usado" para
 * explicar por qué un proyecto no llega al 100 %.
 */
export interface PuntoProgreso {
  nombre: string
  hecho: boolean
  /** false = la función está apagada u oculta en ese proyecto */
  usado: boolean
}

const lleno = (v: unknown) => typeof v === 'string' && v.trim() !== ''

export function puntosProgreso(cfg: EventConfig | null | undefined, tieneRobot: boolean): PuntoProgreso[] {
  const pi = cfg?.pantalla_inicial
  const pr = cfg?.pantalla_ruleta
  const jugar = pi?.boton_activo ?? true
  const despues = pr?.despues_quiz
  return [
    { nombre: 'Fondo', hecho: lleno(pi?.fondo_url), usado: true },
    { nombre: 'Logo', hecho: lleno(pi?.logo_url), usado: pi?.logo_visible ?? true },
    { nombre: 'Título', hecho: lleno(pi?.titulo?.texto), usado: pi?.titulo_visible ?? true },
    { nombre: 'Subtítulo', hecho: lleno(pi?.subtitulo?.texto), usado: pi?.subtitulo_visible ?? true },
    { nombre: 'Botón Jugar', hecho: lleno(pi?.boton?.texto), usado: jugar },
    { nombre: 'Video de patrullaje', hecho: lleno(pi?.video_patrullaje_url), usado: true },
    { nombre: 'Voz al tocar pantalla', hecho: lleno(pi?.tts_toca_pantalla), usado: true },
    { nombre: 'Voz al reanudar patrulla', hecho: lleno(pi?.tts_reanuda_patrulla), usado: true },
    {
      // Un solo punto: seguir patrulla = cumplido; ir al stand = secuencia + 2 voces
      nombre: 'Después del quiz',
      hecho:
        despues?.modo === 'seguir_patrulla' ||
        (lleno(despues?.secuencia_guia) && lleno(pi?.tts_llega_stand) && lleno(pi?.tts_despedida_stand)),
      usado: jugar,
    },
    { nombre: 'Fondo de la ruleta', hecho: lleno(pr?.fondo_url), usado: jugar },
    { nombre: 'Preguntas', hecho: (pr?.preguntas?.length ?? 0) >= 2, usado: jugar },
    { nombre: 'Voz si acierta', hecho: lleno(pr?.tts_acierta), usado: jugar },
    { nombre: 'Voz si no acierta', hecho: lleno(pr?.tts_no_acierta), usado: jugar },
    { nombre: 'Voz de agradecimiento', hecho: lleno(pr?.tts_agradecimiento), usado: jugar },
    { nombre: 'Voz sin respuesta', hecho: lleno(pr?.tts_sin_respuesta), usado: jugar },
    { nombre: 'Robot asignado', hecho: tieneRobot, usado: true },
  ]
}

export function porcentajeProgreso(puntos: PuntoProgreso[]): number {
  return Math.round((100 * puntos.filter((p) => p.hecho).length) / puntos.length)
}
