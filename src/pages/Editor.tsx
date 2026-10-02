import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { eliminarConfigRobot, nombreDesdeUrl, publicarConfigRobot } from '../lib/storage'
import { avisoError, avisoGuardado } from '../lib/alertas'
import { Modal } from '../components/Modal'
import { botonesAdicionalesVacios, botonFotoVacio, colorLibreRuleta, PALETA_RULETA, COLORES_OPCIONES_DEFAULT, COLOR_TEXTO_OPCION_DEFAULT, LIMITES, type BotonAdicionalInicial, type BotonFoto, type EventConfig, type Pregunta, type Project, type TextoEstilo } from '../types/config'
import { DialogBoton, DialogColor, DialogColoresOpciones, DialogTexto, DialogTts, DialogTextoSimple } from '../components/editor/DialogTexto'
import { DialogPregunta } from '../components/editor/DialogPregunta'
import { DialogArchivo } from '../components/editor/DialogArchivo'
import { DialogBotonAdicional } from '../components/editor/DialogBotonAdicional'
import { DialogFoto } from '../components/editor/DialogFoto'
import { describirError } from '../lib/errores'
import { IconoGuardar, IconoLapiz, IconoMas, IconoOnda, IconoPlay, IconoVolumen } from '../components/iconos'
import { Cargando } from '../components/Cargando'

type Pestana = 'inicial' | 'ruleta'

type Dialogo =
  | { tipo: 'titulo' }
  | { tipo: 'subtitulo' }
  | { tipo: 'boton' }
  | { tipo: 'boton-adicional'; index: number }
  | { tipo: 'boton-foto' }
  | { tipo: 'logo' }
  | { tipo: 'tts-inicial'; campo: CampoTtsInicial; titulo: string }
  | { tipo: 'tts-ruleta'; campo: CampoTtsRuleta; titulo: string }
  | { tipo: 'fondo'; pantalla: Pestana }
  | { tipo: 'video' }
  | { tipo: 'color-contador' }
  | { tipo: 'secuencia' }
  | { tipo: 'pregunta'; index: number | null }
  | { tipo: 'colores-opciones' }

type CampoTtsInicial =
  | 'tts_toca_pantalla'
  | 'tts_llega_stand'
  | 'tts_despedida_stand'
  | 'tts_reanuda_patrulla'
  | 'tts_sigueme'
type CampoTtsRuleta = 'tts_acierta' | 'tts_no_acierta' | 'tts_agradecimiento' | 'tts_sin_respuesta'

const TTS_INICIAL: { campo: CampoTtsInicial; label: string }[] = [
  { campo: 'tts_toca_pantalla', label: 'Cuando usuario toca la pantalla' },
  { campo: 'tts_llega_stand', label: 'Cuando robot llega al stand' },
  { campo: 'tts_despedida_stand', label: 'Despedida en el stand' },
  { campo: 'tts_reanuda_patrulla', label: 'Cuando el robot reanuda patrulla' },
]

/** Los TTS de la ruleta a mostrar dependen de los tipos de pregunta del proyecto */
function ttsRuletaVisibles(preguntas: Pregunta[]): { campo: CampoTtsRuleta; label: string }[] {
  const hayCalif = preguntas.some((p) => p.tipo === 'calificacion')
  // "trivia" incluye el caso sin preguntas (comportamiento por defecto)
  const hayTrivia = preguntas.length === 0 || preguntas.some((p) => p.tipo !== 'calificacion')
  const lista: { campo: CampoTtsRuleta; label: string }[] = []
  if (hayTrivia) {
    lista.push({ campo: 'tts_acierta', label: 'Cuando el usuario acierta (trivia)' })
    lista.push({ campo: 'tts_no_acierta', label: 'Cuando el usuario no acierta (trivia)' })
  }
  if (hayCalif) {
    lista.push({ campo: 'tts_agradecimiento', label: 'Agradecimiento (calificación)' })
  }
  lista.push({ campo: 'tts_sin_respuesta', label: 'Cuando no hubo respuesta' })
  return lista
}

function Lapiz({ onClick, title }: { onClick: () => void; title?: string }) {
  return (
    <button
      onClick={onClick}
      title={title ?? 'Editar'}
      className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2f3b52] shadow-md ring-2 ring-slate-400/70 transition-transform hover:scale-110 md:flex"
    >
      <IconoLapiz />
    </button>
  )
}

/** fondo de la ruleta de la vista previa: una sección por pregunta con su color */
function fondoRuleta(preguntas: Pregunta[]): string {
  if (preguntas.length === 0) return '#cbd5e1'
  const paso = 360 / preguntas.length
  const tramos = preguntas.map((p, i) => {
    const color = p.color || PALETA_RULETA[i % PALETA_RULETA.length]
    return `${color} ${i * paso}deg ${(i + 1) * paso}deg`
  })
  return `conic-gradient(${tramos.join(', ')})`
}

/**
 * Ancho del lienzo de la vista previa, en rem: 48rem = 768 px al tamaño base
 * normal (16 px). Va en rem y no en px porque los textos y botones de adentro
 * también van en rem: así guardan la misma proporción aunque el panel cambie
 * su tamaño base (en computador se ve al 80%, ver index.css).
 */
const ANCHO_VISTA_REM = 48

/**
 * La vista previa se dibuja siempre sobre el mismo lienzo (16:10, como la
 * pantalla del temi) y se escala con zoom al espacio disponible, hasta 48rem
 * (max-w-3xl: el mismo ancho del lienzo, así en computador queda a escala 1).
 * Así se ve igual que en el robot en cualquier pantalla: los textos y botones
 * no se amontonan en un teléfono ni quedan pequeños en computador.
 */
function VistaEscalada({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [escala, setEscala] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
      setEscala(el.clientWidth / (ANCHO_VISTA_REM * remPx))
    }
    medir()
    // el ancho del recuadro cambia también cuando cambia el tamaño base
    // (al cruzar el ancho de computador), así que esto cubre los dos casos
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    return () => observador.disconnect()
  }, [])

  return (
    <div ref={ref} className="w-full max-w-3xl">
      <div style={{ width: `${ANCHO_VISTA_REM}rem`, zoom: escala }}>{children}</div>
    </div>
  )
}

/**
 * Acción del engranaje flotante (teléfono). Sube desde el engranaje y aparece;
 * "orden" escalona la animación: la más cercana al engranaje sale primero.
 */
function AccionFlotante({
  visible,
  orden,
  etiqueta,
  onClick,
  disabled,
  className,
  children,
}: {
  visible: boolean
  orden: number
  etiqueta: string
  onClick: () => void
  disabled?: boolean
  className: string
  children: React.ReactNode
}) {
  return (
    <div
      className={`flex items-center gap-3 transition-all duration-200 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-6 opacity-0'
      }`}
      style={{ transitionDelay: visible ? `${orden * 60}ms` : '0ms' }}
      aria-hidden={!visible}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        tabIndex={visible ? 0 : -1}
        aria-label={etiqueta}
        className={`mr-1 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-colors active:scale-95 disabled:opacity-50 ${className}`}
      >
        {children}
      </button>
    </div>
  )
}

/** Ítem del panel que en computador se edita con el lápiz de la vista previa */
function IconoEditar() {
  return (
    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f3b52]">
      <IconoLapiz className="h-3 w-3" />
    </span>
  )
}

/** Marca un elemento apagado en la vista previa: el robot no lo muestra */
function EtiquetaOculto() {
  return (
    <span className="shrink-0 rounded-full bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-white">
      Oculto
    </span>
  )
}

function ItemPanel({
  icono,
  label,
  detalle,
  onClick,
}: {
  icono: React.ReactNode
  label: string
  detalle: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-indigo-50"
    >
      <span className="mt-0.5 shrink-0 text-blue-700">{icono}</span>
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-800">{label}</span>
        <span className="block truncate text-sm text-slate-500">{detalle}</span>
      </span>
    </button>
  )
}

export function Editor() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pestana, setPestana] = useState<Pestana>('inicial')
  const [dialogo, setDialogo] = useState<Dialogo | null>(null)
  const [nombre, setNombre] = useState('')
  const [config, setConfig] = useState<EventConfig | null>(null)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState('')
  const [confirmarBorrar, setConfirmarBorrar] = useState(false)
  /** teléfono: el engranaje despliega Guardar y Eliminar */
  const [accionesAbiertas, setAccionesAbiertas] = useState(false)
  /** nombre + config tal como están en Supabase, para saber si hay cambios sin guardar */
  const [guardadoJson, setGuardadoJson] = useState('')
  const eliminado = useRef(false)

  const { data: proyecto, isLoading, error: errorCarga, refetch } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async (): Promise<Project> => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single()
      if (error) throw error
      return data as Project
    },
    enabled: !!projectId,
  })

  useEffect(() => {
    if (proyecto) {
      setNombre(proyecto.nombre)
      // Migración: proyectos guardados antes de existir "despues_quiz"
      const cfg = structuredClone(proyecto.config)
      if (!cfg.pantalla_ruleta.despues_quiz) {
        cfg.pantalla_ruleta.despues_quiz = {
          modo: 'guiar_al_stand',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          secuencia_guia: (cfg.pantalla_inicial as any).secuencia_guia ?? '',
        }
      }
      if (!cfg.pantalla_ruleta.colores_opciones) {
        cfg.pantalla_ruleta.colores_opciones = ['', '', '']
      }
      if (!cfg.pantalla_ruleta.colores_texto_opciones) {
        cfg.pantalla_ruleta.colores_texto_opciones = ['', '', '']
      }
      // Preguntas viejas sin tipo → trivia por defecto
      cfg.pantalla_ruleta.preguntas.forEach((preg, i) => {
        if (!preg.tipo) preg.tipo = 'trivia'
        // Antes la rueda tenía 3 colores fijos: cada pregunta recibe el de su
        // posición, así los proyectos de 3 preguntas se ven igual que antes
        if (!preg.color) preg.color = PALETA_RULETA[i % PALETA_RULETA.length]
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((cfg.pantalla_ruleta as any).tts_agradecimiento === undefined) {
        cfg.pantalla_ruleta.tts_agradecimiento = '¡Gracias por tu opinión!'
      }
      // Los botones antiguos no tenían formato ni imagen configurables.
      cfg.pantalla_inicial.boton = {
        ...cfg.pantalla_inicial.boton,
        forma: cfg.pantalla_inicial.boton.forma ?? 'pildora',
        imagen_url: cfg.pantalla_inicial.boton.imagen_url ?? '',
      }
      const textosIniciales = [cfg.pantalla_inicial.titulo, cfg.pantalla_inicial.subtitulo]
      textosIniciales.forEach((texto) => {
        texto.opacidad_fondo ??= 100
        texto.sombra_activa ??= false
        texto.color_sombra ??= '#000000'
        texto.intensidad_sombra ??= 'leve'
      })
      cfg.pantalla_inicial.color_contador = cfg.pantalla_inicial.color_contador ?? '#FFD700'
      // Proyectos anteriores solo tenían el botón Jugar. Se agregan dos espacios
      // desactivados para que no cambien la pantalla ni el comportamiento existente.
      const inicialAnterior = cfg.pantalla_inicial as Partial<EventConfig['pantalla_inicial']>
      const adicionalesGuardados = inicialAnterior.botones_adicionales ?? []
      cfg.pantalla_inicial.botones_adicionales = botonesAdicionalesVacios().map((base, index) => {
        const guardado = adicionalesGuardados[index]
        return guardado
          ? { ...base, ...guardado, boton: { ...base.boton, ...guardado.boton } }
          : base
      })
      // Antes el botón Jugar no se podía apagar: los proyectos viejos lo mantienen encendido.
      cfg.pantalla_inicial.boton_activo = inicialAnterior.boton_activo ?? true
      // Antes el logo y los textos no se podían ocultar: los proyectos viejos los muestran.
      cfg.pantalla_inicial.logo_visible = inicialAnterior.logo_visible ?? true
      cfg.pantalla_inicial.titulo_visible = inicialAnterior.titulo_visible ?? true
      cfg.pantalla_inicial.subtitulo_visible = inicialAnterior.subtitulo_visible ?? true
      // Proyectos anteriores no tenían el botón de foto: se agrega desactivado.
      const fotoBase = botonFotoVacio()
      const fotoGuardada = inicialAnterior.boton_foto
      cfg.pantalla_inicial.boton_foto = fotoGuardada
        ? { ...fotoBase, ...fotoGuardada, boton: { ...fotoBase.boton, ...fotoGuardada.boton } }
        : fotoBase
      setConfig(cfg)
      setGuardadoJson(JSON.stringify({ nombre: proyecto.nombre, config: cfg }))
    }
  }, [proyecto])

  const guardar = useMutation({
    mutationFn: async () => {
      if (!config || !projectId) return
      const nuevaConfig: EventConfig = { ...config, version: config.version + 1 }
      const { error } = await supabase
        .from('projects')
        .update({ nombre, config: nuevaConfig })
        .eq('id', projectId)
      if (error) throw error
      setConfig(nuevaConfig)
      setGuardadoJson(JSON.stringify({ nombre, config: nuevaConfig }))

      // Republicar el JSON de los robots que tengan este proyecto fijado
      const { data: robots } = await supabase
        .from('robots')
        .select('serial')
        .eq('project_id', projectId)
      for (const robot of robots ?? []) {
        await publicarConfigRobot(robot.serial, nuevaConfig)
      }
    },
    onError: (e) => void avisoError('No se pudo guardar', describirError(e)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setGuardadoOk(true)
      setTimeout(() => setGuardadoOk(false), 2500)
      void avisoGuardado()
    },
  })

  // Robots fijados a este proyecto (para advertir al eliminar)
  const { data: robotsFijados } = useQuery({
    queryKey: ['robots-proyecto', projectId],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('robots')
        .select('serial')
        .eq('project_id', projectId)
        .order('serial')
      if (error) throw error
      return (data as { serial: string }[]).map((r) => r.serial)
    },
    enabled: !!projectId,
  })

  const borrar = useMutation({
    mutationFn: async () => {
      if (!projectId) return
      // 1. desfijar robots + borrar su config publicada
      const seriales = robotsFijados ?? []
      for (const s of seriales) await eliminarConfigRobot(s)
      await supabase.from('robots').delete().eq('project_id', projectId)
      // 2. borrar el proyecto
      const { error } = await supabase.from('projects').delete().eq('id', projectId)
      if (error) throw error
      // 3. borrar sus archivos (fondos/logo/video) — best effort. Solo los que
      //    ningún otro proyecto usa: una copia duplicada comparte los del original
      try {
        const { data: otros } = await supabase.from('projects').select('config')
        const enUso = JSON.stringify((otros ?? []).map((p) => p.config))
        const archivos: string[] = []
        for (let offset = 0; ; offset += 100) {
          const { data: pagina } = await supabase.storage.from('media').list(projectId, { limit: 100, offset })
          archivos.push(...(pagina ?? []).map((f) => `${projectId}/${f.name}`))
          if (!pagina || pagina.length < 100) break
        }
        const libres = archivos.filter((ruta) => !enUso.includes(ruta))
        for (let i = 0; i < libres.length; i += 100) {
          await supabase.storage.from('media').remove(libres.slice(i, i + 100))
        }
      } catch {
        // si falla la limpieza de media no se bloquea el borrado del proyecto
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['robots'] })
      // el proyecto ya no existe: sus cambios sin guardar no deben frenar la salida
      eliminado.current = true
      navigate('/proyectos')
    },
  })

  // Sin esto, un fallo de red dejaba "Cargando proyecto..." para siempre
  const hayCambios = config !== null && guardadoJson !== '' && JSON.stringify({ nombre, config }) !== guardadoJson

  // Cerrar o recargar la pestaña con cambios sin guardar los perdería: el
  // navegador pide confirmación (el texto del aviso lo pone el navegador)
  useEffect(() => {
    if (!hayCambios) return
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [hayCambios])

  // Ir a otra sección del panel (Analítica, Robots, atrás del navegador) no
  // recarga la página, así que beforeunload no se entera: lo frena el router
  const salida = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hayCambios && !eliminado.current && currentLocation.pathname !== nextLocation.pathname
  )

  if (errorCarga && !config) {
    return (
      <div className="p-12">
        <p className="font-medium text-red-600">No se pudo cargar el proyecto. {describirError(errorCarga)}</p>
        <button
          onClick={() => void refetch()}
          className="mt-4 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          Reintentar
        </button>
      </div>
    )
  }
  if (isLoading || !config) {
    return <Cargando texto="Cargando proyecto…" className="py-24" />
  }

  const ini = config.pantalla_inicial
  const rul = config.pantalla_ruleta
  const botonesAdicionales = ini.botones_adicionales ?? botonesAdicionalesVacios()
  const botonFoto = ini.boton_foto ?? botonFotoVacio()
  const botonJugarActivo = ini.boton_activo ?? true
  const botonesVistaPrevia = [
    ...(botonJugarActivo
      ? [
          {
            id: 'jugar',
            estilo: ini.boton,
            textoDefecto: 'JUGAR AHORA',
            editar: () => setDialogo({ tipo: 'boton' } as const),
          },
        ]
      : []),
    ...botonesAdicionales
      .map((boton, index) => ({ boton, index }))
      .filter(({ boton }) => boton.activo)
      .map(({ boton, index }) => ({
        id: boton.id,
        estilo: boton.boton,
        textoDefecto: `BOTÓN ${index + 1}`,
        editar: () => setDialogo({ tipo: 'boton-adicional', index } as const),
      })),
    ...(botonFoto.activo
      ? [
          {
            id: 'foto',
            estilo: botonFoto.boton,
            textoDefecto: 'TOMAR FOTO',
            editar: () => setDialogo({ tipo: 'boton-foto' } as const),
          },
        ]
      : []),
  ]

  function setInicial(cambios: Partial<EventConfig['pantalla_inicial']>) {
    setConfig((c) => c && { ...c, pantalla_inicial: { ...c.pantalla_inicial, ...cambios } })
  }
  function setRuleta(cambios: Partial<EventConfig['pantalla_ruleta']>) {
    setConfig((c) => c && { ...c, pantalla_ruleta: { ...c.pantalla_ruleta, ...cambios } })
  }
  function setBotonAdicional(index: number, boton: BotonAdicionalInicial) {
    const nuevos = [...botonesAdicionales]
    nuevos[index] = boton
    setInicial({ botones_adicionales: nuevos })
  }

  function setBotonFoto(boton_foto: BotonFoto) {
    setInicial({ boton_foto })
  }

  function guardarPregunta(index: number | null, pregunta: Pregunta) {
    const preguntas = [...rul.preguntas]
    if (index === null) preguntas.push(pregunta)
    else preguntas[index] = pregunta
    setRuleta({ preguntas })
  }

  function eliminarPregunta(index: number) {
    setRuleta({ preguntas: rul.preguntas.filter((_, i) => i !== index) })
  }

  /** Valida y guarda; bloquea si "guiar al stand" no tiene secuencia (rompería el robot) */
  function intentarGuardar() {
    if (rul.despues_quiz.modo === 'guiar_al_stand' && !rul.despues_quiz.secuencia_guia.trim()) {
      setPestana('ruleta')
      setErrorGuardar('Falta el nombre de la secuencia de Temi para "Guiar al stand". Escríbelo antes de guardar.')
      return
    }
    const botonIncompleto = botonesAdicionales.find((boton) =>
      boton.activo &&
      ((boton.accion === 'video' && (!boton.video_url || !boton.tts_despues_video.trim() || !boton.tts_despedida.trim())) ||
        (boton.accion === 'ir_ubicacion' &&
          (!boton.ubicacion.trim() ||
            !boton.tts_antes_de_ir.trim() ||
            !boton.tts_al_llegar.trim() ||
            !boton.tts_despedida.trim())))
    )
    if (botonIncompleto) {
      setPestana('inicial')
      setErrorGuardar(
        botonIncompleto.accion === 'video'
          ? `Completa el video, el texto final y la despedida de "${botonIncompleto.boton.texto || 'botón adicional'}".`
          : `Completa la ubicación y los textos de guía de "${botonIncompleto.boton.texto || 'botón adicional'}".`
      )
      return
    }
    if (botonFoto.activo && (!botonFoto.marco_url || !botonFoto.texto.trim())) {
      setPestana('inicial')
      setErrorGuardar('Completa el marco de la promo y el texto del botón "Tomar foto".')
      return
    }
    // Sin ningún botón activo, el visitante toca la pantalla y no tiene qué hacer
    const hayAlgunBoton =
      botonJugarActivo || botonFoto.activo || botonesAdicionales.some((boton) => boton.activo)
    if (!hayAlgunBoton) {
      setPestana('inicial')
      setErrorGuardar('Deja al menos un botón activo: Jugar, uno adicional o el de tomar foto.')
      return
    }
    setErrorGuardar('')
    guardar.mutate()
  }

  const estiloFondo = (url: string) =>
    url
      ? { backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
      : { background: 'linear-gradient(160deg, #1e2a4a 0%, #10173a 100%)' }

  const colorConOpacidad = (color: string, opacidad: number | undefined) => {
    const hex = (color || '#ffffff').replace('#', '')
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return color || '#ffffff'
    const numero = Number.parseInt(hex, 16)
    const rojo = (numero >> 16) & 255
    const verde = (numero >> 8) & 255
    const azul = numero & 255
    return `rgba(${rojo}, ${verde}, ${azul}, ${(opacidad ?? 100) / 100})`
  }

  const sombraTexto = (estilo: TextoEstilo) => {
    if (!estilo.sombra_activa) return 'none'
    const intensidad = estilo.intensidad_sombra ?? 'leve'
    const medidas = {
      leve: '0 1px 3px',
      media: '0 2px 5px',
      fuerte: '0 3px 8px',
    }[intensidad]
    return `${medidas} ${estilo.color_sombra || '#000000'}`
  }

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior: nombre + pestañas */}
      <div className="flex flex-col border-b border-slate-200 bg-white md:flex-row md:items-center md:justify-between md:pl-10">
        <div className="px-2 py-2 md:px-0">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded px-2 text-2xl font-bold text-slate-800 focus:bg-slate-50 focus:outline-none md:w-96"
            title="Nombre del proyecto (clic para editar)"
          />
          <p className="px-2 text-sm text-slate-400">Versión {config.version}</p>
        </div>
        <div className="flex">
          {(['inicial', 'ruleta'] as Pestana[]).map((p) => (
            <button
              key={p}
              onClick={() => setPestana(p)}
              className={`flex-1 px-4 py-4 font-medium transition-colors md:flex-none md:px-8 md:py-5 ${
                pestana === p
                  ? 'border-b-2 border-indigo-600 bg-slate-50 text-indigo-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {p === 'inicial' ? 'Pantalla inicial' : 'Pantalla Ruleta'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        {/* ─── Preview (columna izquierda; en teléfono va arriba) ─── */}
        <div className="flex shrink-0 items-center justify-center p-4 md:flex-1 md:shrink md:overflow-y-auto md:p-10">
          <VistaEscalada>
          {pestana === 'inicial' ? (
            <div
              className="relative aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
              style={estiloFondo(ini.fondo_url)}
            >
              <div className="absolute right-3 top-3">
                <Lapiz
                  title="Cambiar imagen de fondo"
                  onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'inicial' })}
                />
              </div>
              <div className="flex h-full flex-col items-center pt-8">
                {/* Logo de la empresa (imgLogo en el robot) */}
                <div className="flex items-center gap-2">
                  {/* Oculto: se ve tenue para poder editarlo; en el robot queda el espacio vacío */}
                  <div className={ini.logo_visible ? '' : 'opacity-25'}>
                    {ini.logo_url ? (
                      <img src={ini.logo_url} alt="" className="h-20 max-w-72 object-contain" />
                    ) : (
                      <div className="flex h-20 w-56 items-center justify-center rounded-lg border-2 border-dashed border-white/50 text-sm text-white/70">
                        Logo de la empresa
                      </div>
                    )}
                  </div>
                  {!ini.logo_visible && <EtiquetaOculto />}
                  <Lapiz title="Cambiar logo" onClick={() => setDialogo({ tipo: 'logo' })} />
                </div>

                {/* Título y subtítulo: franjas de lado a lado, como en el robot */}
                <div className="relative mt-6 w-full">
                  <p
                    className={`w-full px-16 py-2 text-center text-2xl font-bold ${ini.titulo_visible ? '' : 'opacity-25'}`}
                    style={{
                      color: ini.titulo.color_texto || '#1e2a4a',
                      backgroundColor: colorConOpacidad(ini.titulo.color_fondo, ini.titulo.opacidad_fondo),
                      textShadow: sombraTexto(ini.titulo),
                    }}
                  >
                    {ini.titulo.texto || 'Título (clic en el lápiz)'}
                  </p>
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {!ini.titulo_visible && <EtiquetaOculto />}
                    <Lapiz title="Editar título" onClick={() => setDialogo({ tipo: 'titulo' })} />
                  </div>
                </div>

                <div className="relative w-full">
                  <p
                    className={`w-full px-16 py-2 text-center text-xl font-semibold ${ini.subtitulo_visible ? '' : 'opacity-25'}`}
                    style={{
                      color: ini.subtitulo.color_texto || '#1e2a4a',
                      backgroundColor: colorConOpacidad(ini.subtitulo.color_fondo, ini.subtitulo.opacidad_fondo),
                      textShadow: sombraTexto(ini.subtitulo),
                    }}
                  >
                    {ini.subtitulo.texto || 'Subtítulo'}
                  </p>
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {!ini.subtitulo_visible && <EtiquetaOculto />}
                    <Lapiz title="Editar subtítulo" onClick={() => setDialogo({ tipo: 'subtitulo' })} />
                  </div>
                </div>

                <div
                  className={`mt-8 flex w-full flex-nowrap items-center justify-center gap-3 px-5 ${
                    botonesVistaPrevia.length === 1 ? 'max-w-xl' : ''
                  }`}
                >
                  {botonesVistaPrevia.map(({ id, estilo, textoDefecto, editar }) => {
                    const esTarjeta = estilo.forma === 'tarjeta'
                    const tieneImagen = esTarjeta && Boolean(estilo.imagen_url)
                    return (
                      <div key={id} className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span
                          className={`flex min-w-0 flex-1 items-center justify-center truncate text-center font-bold ${
                            esTarjeta
                              ? 'h-42 rounded-[28px] px-4 text-base leading-tight'
                              : `rounded-full py-3 ${botonesVistaPrevia.length === 3 ? 'px-4 text-base' : 'px-6 text-lg'}`
                          }`}
                          style={{
                            color: estilo.color_texto || '#ffffff',
                            backgroundColor: estilo.color_fondo || '#031046',
                            backgroundImage: tieneImagen ? `url(${estilo.imagen_url})` : undefined,
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: 'cover',
                            border: tieneImagen ? 'none' : `4px solid ${estilo.color_contorno || '#FFD700'}`,
                            // Sombra fija del contenedor: da profundidad sin alterar la imagen.
                            boxShadow: esTarjeta ? '0 10px 18px rgba(100, 116, 139, 0.32)' : undefined,
                          }}
                        >
                          {estilo.texto || textoDefecto}
                        </span>
                        <span className="shrink-0">
                          <Lapiz title="Editar botón" onClick={editar} />
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div
              className="relative aspect-[16/10] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
              style={estiloFondo(rul.fondo_url)}
            >
              <div className="absolute right-3 top-3">
                <Lapiz
                  title="Cambiar imagen de fondo"
                  onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'ruleta' })}
                />
              </div>
              <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
                {/* Ruleta: una sección por pregunta con su color, en el mismo orden
                    que en el robot (la 1 empieza arriba, sentido horario). La
                    flecha del marco del robot está abajo */}
                <div className="relative">
                  <div
                    className="h-44 w-44 rounded-full border-8 border-yellow-500 shadow-xl"
                    style={{ background: fondoRuleta(rul.preguntas) }}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-3 left-1/2 h-0 w-0 -translate-x-1/2 border-x-[10px] border-b-[16px] border-x-transparent border-b-red-600"
                  />
                </div>
                <p className="px-10 text-center text-xl font-bold text-white">
                  {rul.preguntas[0]?.texto || 'Aquí aparecerá la pregunta'}
                </p>

                {/* Botones como en el robot: 2 arriba, el 3ro centrado abajo */}
                {(() => {
                  const opciones = rul.preguntas[0]?.opciones ?? ['Opción 1', 'Opción 2', 'Opción 3']
                  const colorDe = (i: number) =>
                    rul.colores_opciones?.[i] || COLORES_OPCIONES_DEFAULT[i]
                  const colorTextoDe = (i: number) =>
                    rul.colores_texto_opciones?.[i] || COLOR_TEXTO_OPCION_DEFAULT
                  const botonClase =
                    'rounded-full px-4 py-3 text-center font-bold shadow-md text-sm'
                  return (
                    <div className="relative w-full max-w-xl">
                      <div className="flex w-full gap-2">
                        {opciones.slice(0, 2).map((op, i) => (
                          <span
                            key={i}
                            className={`${botonClase} flex-1`}
                            style={{ backgroundColor: colorDe(i), color: colorTextoDe(i) }}
                          >
                            {op}
                          </span>
                        ))}
                      </div>
                      {opciones[2] !== undefined && (
                        <div className="mt-2 flex justify-center">
                          <span
                            className={`${botonClase} w-[calc(50%-4px)]`}
                            style={{ backgroundColor: colorDe(2), color: colorTextoDe(2) }}
                          >
                            {opciones[2]}
                          </span>
                        </div>
                      )}
                      <div className="absolute -right-12 top-1/2 -translate-y-1/2">
                        <Lapiz
                          title="Colores de las opciones"
                          onClick={() => setDialogo({ tipo: 'colores-opciones' })}
                        />
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
          </VistaEscalada>
        </div>

        {/* ─── Panel derecho (en teléfono va debajo de la vista previa) ─── */}
        <aside className="flex w-full flex-col border-t border-slate-200 bg-white md:w-96 md:border-l md:border-t-0">
          <div className="p-4 pb-44 md:flex-1 md:overflow-y-auto md:p-6">
            {/* En teléfono no hay lápices en la vista previa: lo que solo se
                editaba con ellos aparece aquí */}
            <div className="mb-5 space-y-1 border-b border-slate-200 pb-5 md:hidden">
              <p className="px-3 pb-1 font-semibold text-slate-800">Pantalla</p>
              {pestana === 'inicial' ? (
                <>
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Imagen de fondo"
                    detalle={ini.fondo_url ? nombreDesdeUrl(ini.fondo_url) : 'Vacío'}
                    onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'inicial' })}
                  />
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Logo de la empresa"
                    detalle={`${ini.logo_url ? nombreDesdeUrl(ini.logo_url) : 'Vacío'}${ini.logo_visible ? '' : ' · Oculto'}`}
                    onClick={() => setDialogo({ tipo: 'logo' })}
                  />
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Título"
                    detalle={`${ini.titulo.texto || 'Vacío'}${ini.titulo_visible ? '' : ' · Oculto'}`}
                    onClick={() => setDialogo({ tipo: 'titulo' })}
                  />
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Subtítulo"
                    detalle={`${ini.subtitulo.texto || 'Vacío'}${ini.subtitulo_visible ? '' : ' · Oculto'}`}
                    onClick={() => setDialogo({ tipo: 'subtitulo' })}
                  />
                </>
              ) : (
                <>
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Imagen de fondo"
                    detalle={rul.fondo_url ? nombreDesdeUrl(rul.fondo_url) : 'Vacío'}
                    onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'ruleta' })}
                  />
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Colores de las opciones"
                    detalle="Fondo y texto de los botones de respuesta"
                    onClick={() => setDialogo({ tipo: 'colores-opciones' })}
                  />
                </>
              )}
            </div>

            <h3 className="flex items-center gap-3 text-xl font-bold text-slate-900">
              <IconoOnda /> Configuración de voces (TTS)
            </h3>

            <div className="mt-4 space-y-1">
              {pestana === 'inicial'
                ? TTS_INICIAL.map(({ campo, label }) => (
                    <ItemPanel
                      key={campo}
                      icono={<IconoVolumen />}
                      label={label}
                      detalle={ini[campo] ? `Trigger: ${ini[campo]}` : 'Vacío'}
                      onClick={() => setDialogo({ tipo: 'tts-inicial', campo, titulo: `Tts: ${label.toLowerCase()}` })}
                    />
                  ))
                : ttsRuletaVisibles(rul.preguntas).map(({ campo, label }) => (
                    <ItemPanel
                      key={campo}
                      icono={<IconoVolumen />}
                      label={label}
                      detalle={rul[campo] ? `Trigger: ${rul[campo]}` : 'Vacío'}
                      onClick={() => setDialogo({ tipo: 'tts-ruleta', campo, titulo: `Tts: ${label.toLowerCase()}` })}
                    />
                  ))}
            </div>

            <hr className="my-5 border-slate-200" />

            {pestana === 'inicial' ? (
              <div className="space-y-1">
                <ItemPanel
                  icono={<IconoPlay />}
                  label="Video para patrullaje"
                  detalle={ini.video_patrullaje_url ? 'Video cargado' : 'Vacío'}
                  onClick={() => setDialogo({ tipo: 'video' })}
                />
                <ItemPanel
                  icono={
                    <span
                      aria-hidden="true"
                      className="mt-1 block h-5 w-5 rounded border border-slate-300"
                      style={{ backgroundColor: ini.color_contador || '#FFD700' }}
                    />
                  }
                  label="Color del contador"
                  detalle={ini.color_contador || '#FFD700'}
                  onClick={() => setDialogo({ tipo: 'color-contador' })}
                />
                <hr className="my-5 border-slate-200" />
                <p className="px-3 pb-2 font-semibold text-slate-800">Botones de la pantalla</p>
                <ItemPanel
                  icono={<IconoPlay />}
                  label={ini.boton.texto || 'Botón Jugar (quiz)'}
                  detalle={botonJugarActivo ? 'Abre la ruleta de preguntas' : 'Desactivado'}
                  onClick={() => setDialogo({ tipo: 'boton' })}
                />
                {botonesAdicionales.map((boton, index) => (
                  <ItemPanel
                    key={boton.id}
                    icono={<IconoPlay />}
                    label={boton.boton.texto || `Botón adicional ${index + 1}`}
                    detalle={
                      !boton.activo
                        ? 'Desactivado'
                        : boton.accion === 'video'
                          ? 'Reproduce un video'
                          : `Va a ${boton.ubicacion || 'ubicación pendiente'}`
                    }
                    onClick={() => setDialogo({ tipo: 'boton-adicional', index })}
                  />
                ))}
                <ItemPanel
                  icono={<IconoPlay />}
                  label={botonFoto.boton.texto || 'Botón tomar foto'}
                  detalle={
                    !botonFoto.activo
                      ? 'Desactivado'
                      : botonFoto.marco_url
                        ? 'Toma foto, la enmarca y entrega un número'
                        : 'Falta cargar el marco de la promo'
                  }
                  onClick={() => setDialogo({ tipo: 'boton-foto' })}
                />
              </div>
            ) : (
              <div>
                {/* Qué hace el robot al terminar el quiz */}
                <p className="font-semibold text-slate-800">Después del quiz</p>
                <div className="mt-2 space-y-2">
                  {(
                    [
                      { valor: 'guiar_al_stand', label: 'Guiar al stand', detalle: 'Reproduce la secuencia de Temi' },
                      { valor: 'seguir_patrulla', label: 'Continuar patrullaje', detalle: 'Solo responde y retoma su ruta' },
                    ] as const
                  ).map((opcion) => (
                    <label
                      key={opcion.valor}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                        rul.despues_quiz.modo === opcion.valor
                          ? 'border-indigo-500 bg-indigo-50'
                          : 'border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="despues_quiz"
                        checked={rul.despues_quiz.modo === opcion.valor}
                        onChange={() =>
                          setRuleta({ despues_quiz: { ...rul.despues_quiz, modo: opcion.valor } })
                        }
                        className="mt-1 accent-indigo-600"
                      />
                      <span>
                        <span className="block font-medium text-slate-800">{opcion.label}</span>
                        <span className="block text-sm text-slate-500">{opcion.detalle}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {rul.despues_quiz.modo === 'guiar_al_stand' && (
                  <div className="mt-1">
                    <ItemPanel
                      icono={<IconoPlay />}
                      label="Secuencia para guía"
                      detalle={rul.despues_quiz.secuencia_guia || 'Vacío — escribe el nombre de Temi Center'}
                      onClick={() => setDialogo({ tipo: 'secuencia' })}
                    />
                  </div>
                )}

                <hr className="my-5 border-slate-200" />

                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">Preguntas</p>
                  <button
                    onClick={() => setDialogo({ tipo: 'pregunta', index: null })}
                    disabled={rul.preguntas.length >= LIMITES.PREGUNTAS_MAX}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-indigo-50 disabled:opacity-30"
                    title={
                      rul.preguntas.length >= LIMITES.PREGUNTAS_MAX
                        ? `Máximo ${LIMITES.PREGUNTAS_MAX} preguntas (una sección de la ruleta por pregunta)`
                        : 'Agregar pregunta'
                    }
                  >
                    <IconoMas />
                  </button>
                </div>
                <div className="mt-2 space-y-1">
                  {rul.preguntas.map((pregunta, i) => (
                    <ItemPanel
                      key={i}
                      icono={
                        <span
                          aria-hidden="true"
                          className="mt-1 block h-4 w-4 rounded-full border border-white shadow"
                          style={{ backgroundColor: pregunta.color || PALETA_RULETA[i % PALETA_RULETA.length] }}
                        />
                      }
                      label={`${i + 1} pregunta`}
                      detalle={`Preg: ${pregunta.texto}`}
                      onClick={() => setDialogo({ tipo: 'pregunta', index: i })}
                    />
                  ))}
                </div>
                <p className="mt-2 text-right text-sm text-slate-400">
                  Min. {LIMITES.PREGUNTAS_MIN}
                </p>
                {rul.preguntas.length < LIMITES.PREGUNTAS_MIN && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    Agrega al menos {LIMITES.PREGUNTAS_MIN} preguntas para que la ruleta funcione.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Computador: al final del panel. En teléfono se cambian por los
              botones flotantes de abajo */}
          <div className="hidden border-t border-slate-200 p-6 md:block">
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarBorrar(true)}
                disabled={guardar.isPending || borrar.isPending}
                title="Eliminar proyecto"
                className="rounded-lg border border-red-300 px-5 py-4 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
              <button
                onClick={intentarGuardar}
                disabled={guardar.isPending}
                className="flex flex-1 items-center justify-center gap-3 rounded-lg bg-indigo-600 py-4 text-lg font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <IconoGuardar />
                {guardar.isPending ? 'Guardando...' : guardadoOk ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
            {hayCambios && !guardar.isPending && (
              <p className="mt-2 text-sm font-medium text-amber-700">Tienes cambios sin guardar</p>
            )}
            {errorGuardar && <p className="mt-2 text-sm text-red-600">{errorGuardar}</p>}
            {guardar.isError && (
              <p className="mt-2 text-sm text-red-600">No se pudo guardar. {describirError(guardar.error)}</p>
            )}
          </div>
        </aside>
      </div>

      {/* ─── Teléfono: engranaje flotante abajo a la derecha. Al tocarlo gira y
          despliega hacia arriba Guardar y Eliminar, uno tras otro.
          z-30 queda por debajo del menú lateral (z-40/50) cuando se abre ─── */}
      {accionesAbiertas && (
        // tocar fuera cierra las acciones
        <div className="fixed inset-0 z-20 md:hidden" onClick={() => setAccionesAbiertas(false)} aria-hidden="true" />
      )}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 md:hidden">
        <AccionFlotante
          visible={accionesAbiertas}
          orden={1}
          etiqueta="Eliminar"
          onClick={() => {
            setAccionesAbiertas(false)
            setConfirmarBorrar(true)
          }}
          disabled={guardar.isPending || borrar.isPending}
          className="border border-red-200 bg-white text-red-600 hover:bg-red-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
          </svg>
        </AccionFlotante>
        <AccionFlotante
          visible={accionesAbiertas}
          orden={0}
          etiqueta={guardar.isPending ? 'Guardando…' : 'Guardar'}
          onClick={() => {
            setAccionesAbiertas(false)
            intentarGuardar()
          }}
          disabled={guardar.isPending}
          className="bg-indigo-600 text-white shadow-indigo-600/30 hover:bg-indigo-700"
        >
          <IconoGuardar className="h-5 w-5" />
        </AccionFlotante>

        <button
          onClick={() => setAccionesAbiertas((abiertas) => !abiertas)}
          aria-label={accionesAbiertas ? 'Cerrar acciones' : 'Guardar o eliminar'}
          aria-expanded={accionesAbiertas}
          className={`relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-white shadow-lg transition-colors hover:bg-slate-700 active:scale-95 ${
            guardar.isPending ? 'animate-pulse' : ''
          }`}
        >
          {guardadoOk ? (
            <span className="text-2xl font-bold">✓</span>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className={`h-7 w-7 transition-transform duration-300 ${accionesAbiertas ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          )}
          {/* punto ámbar: hay cambios sin guardar */}
          {hayCambios && !guardar.isPending && (
            <span className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-amber-400" />
          )}
        </button>
      </div>

      {/* Avisos del guardado en teléfono: flotan a la izquierda de los botones */}
      {(errorGuardar || guardar.isError || (hayCambios && !guardar.isPending)) && (
        <div className="fixed bottom-6 left-4 right-24 z-30 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg md:hidden">
          {errorGuardar ? (
            <p className="text-red-600">{errorGuardar}</p>
          ) : guardar.isError ? (
            <p className="text-red-600">No se pudo guardar. {describirError(guardar.error)}</p>
          ) : (
            <p className="font-medium text-amber-700">Tienes cambios sin guardar</p>
          )}
        </div>
      )}

      {/* ─── Salir con cambios sin guardar ─── */}
      {salida.state === 'blocked' && (
        <Modal
          titulo="Tienes cambios sin guardar"
          textoAceptar="Salir sin guardar"
          onCancelar={() => salida.reset()}
          onAceptar={() => salida.proceed()}
        >
          <p className="text-slate-700">
            Si sales ahora, se perderán los cambios que hiciste en este proyecto. Para conservarlos,
            cancela y dale <span className="font-semibold">Guardar</span>.
          </p>
        </Modal>
      )}

      {/* ─── Confirmar eliminación ─── */}
      {confirmarBorrar && (
        <Modal
          titulo="Eliminar proyecto"
          textoAceptar={borrar.isPending ? 'Eliminando...' : 'Sí, eliminar'}
          aceptarDeshabilitado={borrar.isPending}
          onCancelar={() => setConfirmarBorrar(false)}
          onAceptar={() => borrar.mutate()}
        >
          <p className="text-slate-700">
            Vas a eliminar el proyecto <span className="font-semibold">"{nombre}"</span>. Esta acción
            no se puede deshacer y se borrarán también sus imágenes y videos (excepto los que use otro proyecto, como una copia duplicada).
          </p>

          {(robotsFijados?.length ?? 0) > 0 ? (
            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold">⚠️ Este proyecto está fijado a estos robots:</p>
              <ul className="mt-1 list-disc pl-5">
                {robotsFijados!.map((s) => (
                  <li key={s} className="font-mono">
                    {s}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Al eliminarlo, esos robots quedarán <span className="font-semibold">sin proyecto</span>{' '}
                y volverán a su configuración por defecto en el próximo reinicio.
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">
              Este proyecto no está fijado a ningún robot.
            </p>
          )}

          {borrar.isError && (
            <p className="mt-3 text-sm text-red-600">No se pudo eliminar. {describirError(borrar.error)}</p>
          )}
        </Modal>
      )}

      {/* ─── Diálogos ─── */}
      {dialogo?.tipo === 'titulo' && (
        <DialogTexto
          titulo="Editar titulo"
          valor={ini.titulo}
          maxCaracteres={LIMITES.TITULO_MAX}
          visible={ini.titulo_visible}
          onGuardar={(titulo, titulo_visible) => setInicial({ titulo, titulo_visible })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'subtitulo' && (
        <DialogTexto
          titulo="Editar subtitulo"
          valor={ini.subtitulo}
          maxCaracteres={LIMITES.SUBTITULO_MAX}
          visible={ini.subtitulo_visible}
          onGuardar={(subtitulo, subtitulo_visible) => setInicial({ subtitulo, subtitulo_visible })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'boton' && (
        <DialogBoton
          valor={ini.boton}
          projectId={projectId!}
          maxCaracteres={LIMITES.BOTON_MAX}
          activo={botonJugarActivo}
          onGuardar={(boton, activo) => setInicial({ boton, boton_activo: activo })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'boton-adicional' && (
        <DialogBotonAdicional
          indice={dialogo.index}
          valor={botonesAdicionales[dialogo.index]}
          projectId={projectId!}
          onGuardar={(boton) => setBotonAdicional(dialogo.index, boton)}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'boton-foto' && (
        <DialogFoto
          valor={botonFoto}
          projectId={projectId!}
          galeriaToken={proyecto?.galeria_token}
          onGuardar={setBotonFoto}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'tts-inicial' && (
        <DialogTts
          titulo={dialogo.titulo}
          valor={ini[dialogo.campo]}
          maxCaracteres={LIMITES.TTS_MAX}
          onGuardar={(texto) => setInicial({ [dialogo.campo]: texto })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'tts-ruleta' && (
        <DialogTts
          titulo={dialogo.titulo}
          valor={rul[dialogo.campo]}
          maxCaracteres={LIMITES.TTS_MAX}
          onGuardar={(texto) => setRuleta({ [dialogo.campo]: texto })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'logo' && (
        <DialogArchivo
          titulo="Cambiar logo de la empresa"
          tipo="imagen"
          projectId={projectId!}
          urlActual={ini.logo_url}
          nota="Resolución recomendada: 512 × 512 px, PNG con fondo transparente"
          mostrar={{
            etiqueta: 'Mostrar el logo',
            ayuda: 'Apagado, el robot lo oculta pero deja su espacio vacío: el resto de la pantalla no se mueve.',
            valor: ini.logo_visible,
            onGuardar: (logo_visible) => setInicial({ logo_visible }),
          }}
          onSubido={(url) => setInicial({ logo_url: url })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'fondo' && (
        <DialogArchivo
          titulo="Cambiar imagen de fondo"
          tipo="imagen"
          projectId={projectId!}
          urlActual={dialogo.pantalla === 'inicial' ? ini.fondo_url : rul.fondo_url}
          onSubido={(url) =>
            dialogo.pantalla === 'inicial' ? setInicial({ fondo_url: url }) : setRuleta({ fondo_url: url })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'video' && (
        <DialogArchivo
          titulo="Cargar video para patrullaje"
          tipo="video"
          projectId={projectId!}
          urlActual={ini.video_patrullaje_url}
          onSubido={(url) => setInicial({ video_patrullaje_url: url })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'color-contador' && (
        <DialogColor
          titulo="Color del contador"
          etiqueta="Color de texto"
          valor={ini.color_contador || '#FFD700'}
          textoAyuda="Se muestra en la esquina inferior derecha cuando el robot va a retomar su patrullaje."
          onGuardar={(color_contador) => setInicial({ color_contador })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'secuencia' && (
        <DialogTextoSimple
          titulo="Secuencia para guía"
          etiqueta="Escribe el nombre de la secuencia creada en Temi center"
          valor={rul.despues_quiz.secuencia_guia}
          onGuardar={(secuencia_guia) =>
            setRuleta({ despues_quiz: { ...rul.despues_quiz, secuencia_guia } })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'colores-opciones' && (
        <DialogColoresOpciones
          valoresFondo={rul.colores_opciones ?? ['', '', '']}
          valoresTexto={rul.colores_texto_opciones ?? ['', '', '']}
          onGuardar={(colores_opciones, colores_texto_opciones) =>
            setRuleta({ colores_opciones, colores_texto_opciones })
          }
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'pregunta' && (
        <DialogPregunta
          titulo={
            dialogo.index === null
              ? 'Configuración - nueva pregunta'
              : `Configuración - ${dialogo.index + 1} pregunta`
          }
          valor={dialogo.index === null ? null : rul.preguntas[dialogo.index]}
          colorSugerido={colorLibreRuleta(rul.preguntas.map((p) => p.color))}
          puedeEliminar={dialogo.index !== null && rul.preguntas.length > LIMITES.PREGUNTAS_MIN}
          onGuardar={(pregunta) => guardarPregunta(dialogo.index, pregunta)}
          onEliminar={() => dialogo.index !== null && eliminarPregunta(dialogo.index)}
          onCerrar={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
