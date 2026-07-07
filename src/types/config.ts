/**
 * Contrato de configuración con la app del robot.
 * DEBE mantenerse idéntico a EventConfig.kt / default_config.json
 * en app_anato (rama feature/config-remota).
 */

export interface TextoEstilo {
  texto: string
  /** hex "#RRGGBB"; vacío = usar el diseño por defecto del layout */
  color_texto: string
  color_fondo: string
}

export interface BotonEstilo extends TextoEstilo {
  color_contorno: string
}

export interface Pregunta {
  texto: string
  /** mínimo 2, máximo 3 (limitación de layout en el robot) */
  opciones: string[]
  /** índice de la respuesta correcta (0-based) */
  correcta: number
}

export interface PantallaInicial {
  fondo_url: string
  titulo: TextoEstilo
  subtitulo: TextoEstilo
  boton: BotonEstilo
  tts_toca_pantalla: string
  tts_llega_stand: string
  tts_despedida_stand: string
  tts_reanuda_patrulla: string
  tts_sigueme: string
  video_patrullaje_url: string
  /** nombre de la secuencia creada en Temi Center */
  secuencia_guia: string
}

export interface PantallaRuleta {
  fondo_url: string
  tts_acierta: string
  tts_no_acierta: string
  tts_sin_respuesta: string
  preguntas: Pregunta[]
}

export interface Tiempos {
  countdown_pausa_seg: number
  countdown_stand_seg: number
}

export interface EventConfig {
  /** se incrementa en cada guardado; la app recarga cuando cambia */
  version: number
  empresa: string
  pantalla_inicial: PantallaInicial
  pantalla_ruleta: PantallaRuleta
  tiempos: Tiempos
}

/** Límites de validación del panel (acordados con la app) */
export const LIMITES = {
  TTS_MAX: 300,
  PREGUNTA_MAX: 120,
  TITULO_MAX: 80,
  BOTON_MAX: 20,
  OPCIONES_MIN: 2,
  OPCIONES_MAX: 3,
  PREGUNTAS_MIN: 2,
} as const

/** Config vacía para crear un proyecto nuevo */
export function configVacia(): EventConfig {
  return {
    version: 1,
    empresa: '',
    pantalla_inicial: {
      fondo_url: '',
      titulo: { texto: '', color_texto: '', color_fondo: '' },
      subtitulo: { texto: '', color_texto: '', color_fondo: '' },
      boton: { texto: '', color_texto: '', color_fondo: '', color_contorno: '' },
      tts_toca_pantalla: '',
      tts_llega_stand: '',
      tts_despedida_stand: '',
      tts_reanuda_patrulla: '',
      tts_sigueme: '¡Sígueme!',
      video_patrullaje_url: '',
      secuencia_guia: '',
    },
    pantalla_ruleta: {
      fondo_url: '',
      tts_acierta: '',
      tts_no_acierta: '',
      tts_sin_respuesta: '¡No hubo respuesta!',
      preguntas: [],
    },
    tiempos: {
      countdown_pausa_seg: 20,
      countdown_stand_seg: 20,
    },
  }
}

/** Fila de la tabla projects en Supabase */
export interface Project {
  id: string
  nombre: string
  config: EventConfig
  activo: boolean
  updated_at: string
  created_at: string
}

/** Fila de la tabla robots en Supabase (asignación robot → proyecto) */
export interface RobotAssignment {
  serial: string
  project_id: string | null
  updated_at: string
}
