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

export type DestinoBotonInicial = 'quiz' | 'agente' | 'ambos'

export interface Pregunta {
  texto: string
  /** mínimo 2, máximo 3 (limitación de layout en el robot) */
  opciones: string[]
  /** índice de la respuesta correcta (0-based); ignorado en 'calificacion' */
  correcta: number
  /** 'trivia' = tiene respuesta correcta · 'calificacion' = opinión, sin correcta */
  tipo: 'trivia' | 'calificacion'
}

export interface PantallaInicial {
  fondo_url: string
  /** logo de la empresa, arriba centrado (imgLogo en el robot) */
  logo_url: string
  titulo: TextoEstilo
  subtitulo: TextoEstilo
  boton: BotonEstilo
  destino_boton: DestinoBotonInicial
  boton_agente: BotonEstilo
  tts_toca_pantalla: string
  tts_llega_stand: string
  tts_despedida_stand: string
  tts_reanuda_patrulla: string
  tts_sigueme: string
  video_patrullaje_url: string
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

export type TipoRespuestaAgente = 'texto' | 'opciones' | 'tarjetas'
export type ModoEscuchaAgente = 'automatico' | 'por_boton' | 'finalizar'
export type AccionIntentosAgotados = 'volver_inicio' | 'finalizar'

export interface OpcionAgente {
  id: string
  texto: string
  accion: 'mostrar_respuesta' | 'ir_ubicacion' | 'iniciar_recorrido' | 'respuesta_libre'
  destino: string
  /** Texto mostrado a pantalla completa mientras Temi se desplaza. */
  texto_movimiento: string
  /** Respuesta configurada que se abre al llegar; vacio = permanecer en destino. */
  respuesta_al_llegar: string
}

export interface TarjetaAgente {
  id: string
  titulo: string
  subtitulo: string
  etiqueta: string
  precio: string
}

export interface RespuestaAgente {
  id: string
  nombre: string
  tipo: TipoRespuestaAgente
  mensaje: string
  modo_escucha: ModoEscuchaAgente
  texto_boton_escucha: string
  mensaje_despedida: string
  opciones: OpcionAgente[]
  tarjetas: TarjetaAgente[]
}

export interface AparienciaAgente {
  color_texto_inicio: string
  color_texto_fin: string
  color_contorno_inicio: string
  color_contorno_fin: string
}

export interface ParadaRecorridoAgente {
  id: string
  ubicacion: string
  texto_movimiento: string
  mensaje_llegada: string
}

export interface RecorridoAgente {
  id: string
  nombre: string
  paradas: ParadaRecorridoAgente[]
  /** Respuesta mostrada despues de la ultima parada; vacio = reanudar la ruta base. */
  respuesta_final_id: string
  mensaje_reanudacion: string
}

export interface ReintentosAgente {
  tiempo_respuesta_seg: number
  max_reintentos: number
  mensaje_sin_respuesta: string
  mensaje_no_entendido: string
  mensaje_intentos_agotados: string
  accion_al_agotar: AccionIntentosAgotados
}

export interface AgenteConfig {
  activo: boolean
  prompt: string
  mensaje_inicial: string
  texto_escucha: string
  modo_escucha_inicial: ModoEscuchaAgente
  texto_boton_escucha_inicial: string
  mensaje_despedida_inicial: string
  opciones_iniciales: OpcionAgente[]
  respuestas: RespuestaAgente[]
  recorridos: RecorridoAgente[]
  reintentos: ReintentosAgente
  apariencia: AparienciaAgente
}

export interface EventConfig {
  /** se incrementa en cada guardado; la app recarga cuando cambia */
  version: number
  empresa: string
  pantalla_inicial: PantallaInicial
  pantalla_ruleta: PantallaRuleta
  /** Configuracion del asistente; la app antigua ignora este campo adicional. */
  agente_ia: AgenteConfig
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
/** Configuracion inicial del asistente basada en las pantallas de referencia. */
export function configAgenteVacia(): AgenteConfig {
  return {
    activo: true,
    prompt:
      'Eres el asistente de la empresa. Responde de forma clara, breve y amable usando solamente la informacion suministrada.',
    mensaje_inicial: 'Hola, soy tu asistente, ¿que quieres saber?',
    texto_escucha: 'Puedes hablar....',
    modo_escucha_inicial: 'automatico',
    texto_boton_escucha_inicial: 'Preguntar otra cosa',
    mensaje_despedida_inicial: '',
    opciones_iniciales: [],
    respuestas: [],
    recorridos: [],
    reintentos: {
      tiempo_respuesta_seg: 10,
      max_reintentos: 2,
      mensaje_sin_respuesta: 'No te escuché. Intentemos de nuevo.',
      mensaje_no_entendido: 'No te entendí bien. Intentemos de nuevo.',
      mensaje_intentos_agotados: 'No pude obtener una respuesta. Volvamos al inicio.',
      accion_al_agotar: 'volver_inicio',
    },
    apariencia: {
      color_texto_inicio: '#160B15',
      color_texto_fin: '#E95DC3',
      color_contorno_inicio: '#111111',
      color_contorno_fin: '#FF5ED2',
    },
  }
}

/** Completa configuraciones antiguas o parciales sin sobrescribir sus valores. */
export function normalizarConfigAgente(valor?: Partial<AgenteConfig>): AgenteConfig {
  const base = configAgenteVacia()
  const idsRespuestasDemo = new Set(['planes', 'planes-internet', 'cobertura'])
  const idsOpcionesDemo = new Set([
    'inicio-planes',
    'inicio-cobertura',
    'inicio-stand',
    'planes-internet',
    'planes-television',
    'planes-stand',
  ])
  const normalizarOpcion = (opcion: OpcionAgente): OpcionAgente => ({
    ...opcion,
    destino:
      opcion.accion === 'mostrar_respuesta' && idsRespuestasDemo.has(opcion.destino)
        ? ''
        : opcion.destino,
    texto_movimiento: opcion.texto_movimiento ?? '',
    respuesta_al_llegar: opcion.respuesta_al_llegar ?? '',
  })
  const normalizarRespuesta = (respuesta: RespuestaAgente): RespuestaAgente => {
    const anterior = respuesta as RespuestaAgente & { continuar_escuchando?: boolean }
    const { continuar_escuchando, ...sinCampoAnterior } = anterior
    return {
      ...sinCampoAnterior,
      modo_escucha:
        respuesta.modo_escucha ??
        (continuar_escuchando === false ? 'finalizar' : 'automatico'),
      texto_boton_escucha: respuesta.texto_boton_escucha ?? 'Preguntar otra cosa',
      mensaje_despedida: respuesta.mensaje_despedida ?? '',
      opciones: (respuesta.opciones ?? [])
        .filter((opcion) => !idsOpcionesDemo.has(opcion.id))
        .map(normalizarOpcion),
    }
  }
  return {
    ...base,
    ...valor,
    modo_escucha_inicial: valor?.modo_escucha_inicial ?? base.modo_escucha_inicial,
    texto_boton_escucha_inicial:
      valor?.texto_boton_escucha_inicial ?? base.texto_boton_escucha_inicial,
    mensaje_despedida_inicial:
      valor?.mensaje_despedida_inicial ?? base.mensaje_despedida_inicial,
    opciones_iniciales: (valor?.opciones_iniciales ?? base.opciones_iniciales)
      .filter((opcion) => !idsOpcionesDemo.has(opcion.id))
      .map(normalizarOpcion),
    respuestas: (valor?.respuestas ?? base.respuestas)
      .filter((respuesta) => !idsRespuestasDemo.has(respuesta.id))
      .map(normalizarRespuesta),
    recorridos: (valor?.recorridos ?? base.recorridos).map((recorrido) => ({
      ...recorrido,
      respuesta_final_id: recorrido.respuesta_final_id ?? '',
      mensaje_reanudacion:
        recorrido.mensaje_reanudacion ??
        'Gracias por acompañarme. Continuemos nuestro recorrido.',
      paradas: recorrido.paradas ?? [],
    })),
    reintentos: {
      ...base.reintentos,
      ...valor?.reintentos,
      accion_al_agotar:
        valor?.reintentos?.accion_al_agotar === 'finalizar'
          ? 'finalizar'
          : 'volver_inicio',
    },
    apariencia: {
      ...base.apariencia,
      ...valor?.apariencia,
    },
  }
}

export function configVacia(): EventConfig {
  return {
    version: 1,
    empresa: '',
    pantalla_inicial: {
      fondo_url: '',
      logo_url: '',
      titulo: { texto: '', color_texto: '', color_fondo: '' },
      subtitulo: { texto: '', color_texto: '', color_fondo: '' },
      boton: { texto: '', color_texto: '', color_fondo: '', color_contorno: '' },
      destino_boton: 'quiz',
      boton_agente: {
        texto: 'HABLAR CON TEMI',
        color_texto: '',
        color_fondo: '',
        color_contorno: '',
      },
      tts_toca_pantalla: '',
      tts_llega_stand: '',
      tts_despedida_stand: '',
      tts_reanuda_patrulla: '',
      tts_sigueme: '¡Sígueme!',
      video_patrullaje_url: '',
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
    agente_ia: configAgenteVacia(),
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
