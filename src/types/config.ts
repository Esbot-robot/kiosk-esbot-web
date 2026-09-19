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
  /** 0 = transparente; 100 = color de fondo sólido. Solo título y subtítulo. */
  opacidad_fondo?: number
  sombra_activa?: boolean
  color_sombra?: string
  intensidad_sombra?: 'leve' | 'media' | 'fuerte'
}

export interface BotonEstilo extends TextoEstilo {
  color_contorno: string
  /** pildora = botón actual; tarjeta = tarjeta alta con bordes redondeados. */
  forma: 'pildora' | 'tarjeta'
  /** Imagen mostrada directamente en la tarjeta, sin capas ni filtros. */
  imagen_url: string
}

/** Acción opcional disponible desde la pantalla inicial del robot. */
export interface BotonAdicionalInicial {
  /** estable: permite reconocer el botón aunque se cambie su texto */
  id: string
  activo: boolean
  boton: BotonEstilo
  accion: 'video' | 'ir_ubicacion'
  /** video que se reproduce una vez y después devuelve el contador pausado */
  video_url: string
  tts_despues_video: string
  /** nombre exacto de la ubicación creada en el mapa de Temi */
  ubicacion: string
  tts_antes_de_ir: string
  /** video opcional, en bucle durante el desplazamiento */
  video_trayecto_url: string
  tts_al_llegar: string
  /** despedida propia antes de retomar el patrullaje */
  tts_despedida: string
}

export interface Pregunta {
  texto: string
  /** mínimo 2, máximo 3 (limitación de layout en el robot) */
  opciones: string[]
  /** índice de la respuesta correcta (0-based); ignorado en 'calificacion' */
  correcta: number
  /** 'trivia' = tiene respuesta correcta · 'calificacion' = opinión, sin correcta */
  tipo: 'trivia' | 'calificacion'
}

/**
 * Botón "Tomar foto" de la pantalla inicial.
 * El robot toma la foto, la monta dentro del marco, pide un número al
 * servidor y muestra (y dice) el texto con ese número. La foto se reclama
 * después en el stand, desde la galería del evento.
 */
export interface BotonFoto {
  activo: boolean
  boton: BotonEstilo
  /** PNG 1200×1800 con el hueco de la foto transparente */
  marco_url: string
  /** se muestra junto al número y el robot lo dice en voz alta */
  texto: string
  /** segundos que la foto y el número quedan en pantalla */
  segundos_pantalla: number
  /** grados que se inclina la cabeza del robot al tomar la foto (-30 a 50) */
  inclinacion_pantalla: number
  /** segundos de la cuenta regresiva antes de tomar la foto (3 a 15) */
  segundos_cuenta: number
  /** lo que dice el robot al empezar la cuenta regresiva */
  frase_preparacion: string
  /** muestra un QR que abre WhatsApp con el mensaje ya escrito */
  whatsapp_activo: boolean
  /** solo dígitos, con indicativo de país. Ej: 573108676490 */
  whatsapp_numero: string
  /** mensaje que el visitante enviará; {numero} se reemplaza por el de la foto */
  whatsapp_mensaje: string
}

/** frase de la cuenta regresiva cuando el evento no define una */
export const FRASE_PREPARACION_DEFECTO = '¡Ubícate frente a mí y regálame una gran sonrisa!'

export function botonFotoVacio(): BotonFoto {
  return {
    activo: false,
    boton: {
      texto: 'TOMAR FOTO',
      color_texto: '',
      color_fondo: '',
      color_contorno: '',
      forma: 'pildora',
      imagen_url: '',
    },
    marco_url: '',
    texto: 'Escanea el QR, envía el mensaje y pásate por nuestro stand a reclamar tu foto.',
    segundos_pantalla: 10,
    inclinacion_pantalla: 0,
    segundos_cuenta: 10,
    frase_preparacion: FRASE_PREPARACION_DEFECTO,
    whatsapp_activo: false,
    whatsapp_numero: '',
    whatsapp_mensaje: 'Hola, quiero reclamar mi foto #{numero} en el stand.',
  }
}

export interface PantallaInicial {
  fondo_url: string
  /** logo de la empresa, arriba centrado (imgLogo en el robot) */
  logo_url: string
  titulo: TextoEstilo
  subtitulo: TextoEstilo
  boton: BotonEstilo
  /** el botón Jugar (quiz) también se puede apagar: hay eventos que solo quieren fotos */
  boton_activo: boolean
  /** máximo dos acciones adicionales junto al botón Jugar */
  botones_adicionales: BotonAdicionalInicial[]
  /** acción de foto, independiente de los dos botones adicionales */
  boton_foto: BotonFoto
  tts_toca_pantalla: string
  tts_llega_stand: string
  tts_despedida_stand: string
  tts_reanuda_patrulla: string
  tts_sigueme: string
  video_patrullaje_url: string
  /** color del texto "Continuaré en..."; vacío = dorado original */
  color_contador: string
}

export function botonesAdicionalesVacios(): BotonAdicionalInicial[] {
  return [
    {
      id: 'accion_1',
      activo: false,
      boton: { texto: 'Ver video', color_texto: '', color_fondo: '', color_contorno: '', forma: 'pildora', imagen_url: '' },
      accion: 'video',
      video_url: '',
      tts_despues_video: '',
      ubicacion: '',
      tts_antes_de_ir: '',
      video_trayecto_url: '',
      tts_al_llegar: '',
      tts_despedida: '',
    },
    {
      id: 'accion_2',
      activo: false,
      boton: { texto: 'Conocer un lugar', color_texto: '', color_fondo: '', color_contorno: '', forma: 'pildora', imagen_url: '' },
      accion: 'ir_ubicacion',
      video_url: '',
      tts_despues_video: '',
      ubicacion: '',
      tts_antes_de_ir: '',
      video_trayecto_url: '',
      tts_al_llegar: '',
      tts_despedida: '',
    },
  ]
}

/** Qué hace el robot cuando el visitante termina el quiz */
export interface DespuesQuiz {
  /** "guiar_al_stand": dice tts_sigueme y reproduce la secuencia (que incluye
   *  video y movimiento). "seguir_patrulla": retoma la ruta directamente. */
  modo: 'guiar_al_stand' | 'seguir_patrulla'
  /** nombre de la secuencia creada en Temi Center (solo modo guiar_al_stand) */
  secuencia_guia: string
}

export interface PantallaRuleta {
  fondo_url: string
  tts_acierta: string
  tts_no_acierta: string
  /** mensaje de agradecimiento para preguntas de calificación (sin correcta) */
  tts_agradecimiento: string
  tts_sin_respuesta: string
  despues_quiz: DespuesQuiz
  /** color de fondo de cada botón de respuesta (posiciones 1-3);
   *  vacío = color original del robot */
  colores_opciones: string[]
  /** color del texto de cada botón de respuesta (posiciones 1-3);
   *  vacío = blanco (original del robot) */
  colores_texto_opciones: string[]
  preguntas: Pregunta[]
}

/** Colores de fondo originales de los botones de respuesta en el robot */
export const COLORES_OPCIONES_DEFAULT = ['#0931D7', '#2196F3', '#F44336']
/** Color de texto original de los botones de respuesta (blanco) */
export const COLOR_TEXTO_OPCION_DEFAULT = '#FFFFFF'

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
  /** medidos con el texto de Colombia Más: el máximo que se ve bien en el robot */
  TITULO_MAX: 45,
  SUBTITULO_MAX: 70,
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
      logo_url: '',
      titulo: { texto: '', color_texto: '', color_fondo: '', opacidad_fondo: 100, sombra_activa: false, color_sombra: '#000000', intensidad_sombra: 'leve' },
      subtitulo: { texto: '', color_texto: '', color_fondo: '', opacidad_fondo: 100, sombra_activa: false, color_sombra: '#000000', intensidad_sombra: 'leve' },
      boton: { texto: '', color_texto: '', color_fondo: '', color_contorno: '', forma: 'pildora', imagen_url: '' },
      boton_activo: true,
      botones_adicionales: botonesAdicionalesVacios(),
      boton_foto: botonFotoVacio(),
      tts_toca_pantalla: '',
      tts_llega_stand: '',
      tts_despedida_stand: '',
      tts_reanuda_patrulla: '',
      tts_sigueme: '¡Sígueme!',
      video_patrullaje_url: '',
      color_contador: '#FFD700',
    },
    pantalla_ruleta: {
      fondo_url: '',
      tts_acierta: '',
      tts_no_acierta: '',
      tts_agradecimiento: '¡Gracias por tu opinión!',
      tts_sin_respuesta: '¡No hubo respuesta!',
      despues_quiz: { modo: 'guiar_al_stand', secuencia_guia: '' },
      colores_opciones: ['', '', ''],
      colores_texto_opciones: ['', '', ''],
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
  /**
   * Token del enlace de galería que se le entrega al cliente.
   * Vive como columna aparte y NO dentro de config, porque config se publica
   * en configs/{serial}.json, que es un archivo público.
   * Lo crea Supabase con un valor por defecto (paso de base de datos).
   */
  galeria_token?: string | null
}

/** Fila de la tabla robots en Supabase (asignación robot → proyecto) */
export interface RobotAssignment {
  serial: string
  project_id: string | null
  updated_at: string
}
