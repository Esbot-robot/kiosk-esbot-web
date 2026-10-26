import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { eliminarConfigRobot, nombreDesdeUrl, publicarConfigRobot } from '../lib/storage'
import { useArchivosFaltantes } from '../lib/useArchivosFaltantes'
import { AvisoArchivosFaltantes } from '../components/ArchivosFaltantes'
import { avisoError, avisoGuardado } from '../lib/alertas'
import { Modal } from '../components/Modal'
import { botonCatalogoVacio, botonesAdicionalesVacios, botonFotoVacio, botonRegistroVacio, type BotonCatalogo, type BotonRegistro, colorLibreRuleta, PALETA_RULETA, COLORES_OPCIONES_DEFAULT, COLOR_TEXTO_OPCION_DEFAULT, LIMITES, type BotonAdicionalInicial, type BotonFoto, type EventConfig, type Pregunta, type Project, type TextoEstilo } from '../types/config'
import { DialogBoton, DialogColor, DialogColoresOpciones, DialogTexto, DialogTts, DialogTextoSimple } from '../components/editor/DialogTexto'
import { DialogPregunta } from '../components/editor/DialogPregunta'
import { DialogArchivo } from '../components/editor/DialogArchivo'
import { DialogBotonAdicional } from '../components/editor/DialogBotonAdicional'
import { DialogFoto } from '../components/editor/DialogFoto'
import { DialogRegistro } from '../components/editor/DialogRegistro'
import { DialogCatalogo } from '../components/editor/DialogCatalogo'
import { describirError } from '../lib/errores'
import { IconoGuardar, IconoLapiz, IconoMas, IconoOnda, IconoPlay, IconoVolumen } from '../components/iconos'
import { Cargando } from '../components/Cargando'
import { SoloLecturaContext, usePerfil } from '../lib/perfil'
import { Advertencia } from '../components/Advertencia'
import { SelectorDiseno } from '../components/editor/SelectorDiseno'
import { BANNER, colorContraste, DisenoContext, disenoDe, FERIA, FUENTE_FERIA, FUENTE_ROBOT } from '../lib/disenos'
import { TarjetaFeria } from '../components/editor/TarjetaFeria'
import { TextoAjustado } from '../components/editor/TextoAjustado'
import { ANCHO_VISTA_REM, dp } from '../lib/pantallaRobot'

type Pestana = 'inicial' | 'ruleta'

type Dialogo =
  | { tipo: 'titulo' }
  | { tipo: 'subtitulo' }
  | { tipo: 'boton' }
  | { tipo: 'boton-adicional'; index: number }
  | { tipo: 'boton-foto' }
  | { tipo: 'boton-registro' }
  | { tipo: 'boton-catalogo' }
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
  { campo: 'tts_toca_pantalla', label: 'Al tocar la pantalla' },
  { campo: 'tts_llega_stand', label: 'Al llegar al stand' },
  { campo: 'tts_despedida_stand', label: 'Despedida en el stand' },
  { campo: 'tts_reanuda_patrulla', label: 'Al reanudar el patrullaje' },
]

/** Los TTS de la ruleta a mostrar dependen de los tipos de pregunta del proyecto */
function ttsRuletaVisibles(preguntas: Pregunta[]): { campo: CampoTtsRuleta; label: string }[] {
  const hayCalif = preguntas.some((p) => p.tipo === 'calificacion')
  // "trivia" incluye el caso sin preguntas (comportamiento por defecto)
  const hayTrivia = preguntas.length === 0 || preguntas.some((p) => p.tipo !== 'calificacion')
  const lista: { campo: CampoTtsRuleta; label: string }[] = []
  if (hayTrivia) {
    lista.push({ campo: 'tts_acierta', label: 'Al acertar (trivia)' })
    lista.push({ campo: 'tts_no_acierta', label: 'Al no acertar (trivia)' })
  }
  if (hayCalif) {
    lista.push({ campo: 'tts_agradecimiento', label: 'Agradecimiento (calificación)' })
  }
  lista.push({ campo: 'tts_sin_respuesta', label: 'Sin respuesta' })
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

/** Cinta del título con muescas semicirculares de 14 dp a los lados, como un boleto (TicketDrawable) */
const MUESCAS_CINTA = `radial-gradient(circle ${dp(14)} at 0 50%, #0000 calc(${dp(14)} - 0.05rem), #000 ${dp(14)}), radial-gradient(circle ${dp(14)} at 100% 50%, #0000 calc(${dp(14)} - 0.05rem), #000 ${dp(14)})`
const ESTILO_CINTA: React.CSSProperties = {
  fontFamily: FUENTE_FERIA,
  maskImage: MUESCAS_CINTA,
  maskComposite: 'intersect',
  WebkitMaskImage: MUESCAS_CINTA,
  WebkitMaskComposite: 'source-in',
}

/**
 * La vista previa se dibuja siempre sobre el mismo lienzo (16:9, como la
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
  alerta = false,
  onClick,
}: {
  icono: React.ReactNode
  label: string
  detalle: string
  /** el detalle se muestra en rojo (por ejemplo, el archivo ya no existe) */
  alerta?: boolean
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
        <span className={`block truncate text-sm ${alerta ? 'text-rose-600' : 'text-slate-500'}`}>{detalle}</span>
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
  // Archivos de la configuración que ya no están en el almacenamiento (borrados a mano en Supabase)
  const { faltantes: archivosFaltantes } = useArchivosFaltantes(config)
  // El cliente lector ve todo el proyecto, pero no puede cambiar ni guardar nada
  const soloLectura = usePerfil().rol === 'lector'

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
        ? {
            ...fotoBase,
            ...fotoGuardada,
            boton: { ...fotoBase.boton, ...fotoGuardada.boton },
            // Antes solo existía el interruptor de WhatsApp
            entrega: fotoGuardada.entrega ?? (fotoGuardada.whatsapp_activo ? 'whatsapp' : 'ninguna'),
            formulario: { ...fotoBase.formulario, ...fotoGuardada.formulario },
          }
        : fotoBase
      // Proyectos anteriores no tenían el botón de registro: se agrega desactivado.
      const registroBase = botonRegistroVacio()
      const registroGuardado = inicialAnterior.boton_registro
      cfg.pantalla_inicial.boton_registro = registroGuardado
        ? {
            ...registroBase,
            ...registroGuardado,
            boton: { ...registroBase.boton, ...registroGuardado.boton },
            formulario: { ...registroBase.formulario, ...registroGuardado.formulario },
          }
        : registroBase
      // Proyectos anteriores no tenían el catálogo: se agrega desactivado y vacío.
      const catalogoBase = botonCatalogoVacio()
      const catalogoGuardado = inicialAnterior.boton_catalogo
      cfg.pantalla_inicial.boton_catalogo = catalogoGuardado
        ? {
            ...catalogoBase,
            ...catalogoGuardado,
            boton: { ...catalogoBase.boton, ...catalogoGuardado.boton },
            productos: catalogoGuardado.productos ?? [],
          }
        : catalogoBase
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
        await publicarConfigRobot(robot.serial, nuevaConfig, proyecto?.registro_token, projectId)
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
        <Advertencia>No se pudo cargar el proyecto. {describirError(errorCarga)}</Advertencia>
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
  const falta = (direccion: string) => !!direccion && archivosFaltantes.some((a) => a.url === direccion)
  const botonesAdicionales = ini.botones_adicionales ?? botonesAdicionalesVacios()
  const botonFoto = ini.boton_foto ?? botonFotoVacio()
  const botonRegistro = ini.boton_registro ?? botonRegistroVacio()
  const botonCatalogo = ini.boton_catalogo ?? botonCatalogoVacio()
  const botonJugarActivo = ini.boton_activo ?? true
  const feria = disenoDe(ini.diseno) === 'feria'
  const banner = disenoDe(ini.diseno) === 'banner'
  const colorPanel = ini.color_panel || BANNER.panel
  const textoPanel = colorContraste(colorPanel)
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
    ...(botonRegistro.activo
      ? [
          {
            id: 'registro',
            estilo: botonRegistro.boton,
            textoDefecto: 'REGÍSTRATE',
            editar: () => setDialogo({ tipo: 'boton-registro' } as const),
          },
        ]
      : []),
    ...(botonCatalogo.activo
      ? [
          {
            id: 'catalogo',
            estilo: botonCatalogo.boton,
            textoDefecto: 'CATÁLOGO',
            editar: () => setDialogo({ tipo: 'boton-catalogo' } as const),
          },
        ]
      : []),
  ]

  // Medidas de la pantalla inicial en dp, las mismas de la app (MainActivity.configureAdditionalButtons)
  const hayTarjeta = botonesVistaPrevia.some((b) => b.estilo.forma === 'tarjeta')
  const variosBotones = botonesVistaPrevia.length > 1
  const altoBase = variosBotones ? 104 : 140
  const textoBoton = ({ 1: 50, 2: 38, 3: 32, 4: 26 } as Record<number, number>)[botonesVistaPrevia.length] ?? 22
  // la tipografía condensada del feria es más angosta: aguanta más tamaño
  const tamanoBoton = feria ? textoBoton * 1.15 : textoBoton
  const margenFila = banner ? 24 : feria ? 36 : variosBotones || hayTarjeta ? 42 : 110
  const lateralFila = banner ? 64 : feria ? 120 : 40

  // Banner: el panel ocupa más alto cuando algún botón es tarjeta (guía al 38% en vez del 55%, igual que en el robot)
  const pctPanel = hayTarjeta ? 62 : 45

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

  function setBotonRegistro(boton_registro: BotonRegistro) {
    setInicial({ boton_registro })
  }

  function setBotonCatalogo(boton_catalogo: BotonCatalogo) {
    setInicial({ boton_catalogo })
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
      setErrorGuardar('Falta el nombre de la secuencia de Temi para «Guiar al stand». Ingréselo antes de guardar.')
      return
    }
    const botonIncompleto = botonesAdicionales.find((boton) =>
      boton.activo &&
      ((boton.accion === 'video' && (!boton.video_url || !boton.tts_despues_video.trim() || !boton.tts_despedida.trim())) ||
        (boton.accion === 'secuencia' &&
          (!boton.secuencia?.trim() || !boton.tts_despues_video.trim() || !boton.tts_despedida.trim())) ||
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
          ? `Complete el video, el mensaje final y la despedida de «${botonIncompleto.boton.texto || 'botón adicional'}».`
          : botonIncompleto.accion === 'secuencia'
            ? `Complete la secuencia, el mensaje final y la despedida de «${botonIncompleto.boton.texto || 'botón adicional'}».`
            : `Complete la ubicación y los mensajes de guía de «${botonIncompleto.boton.texto || 'botón adicional'}».`
      )
      return
    }
    if (botonFoto.activo && (!botonFoto.marco_url || !botonFoto.texto.trim())) {
      setPestana('inicial')
      setErrorGuardar('Complete el marco de la promoción y el texto del botón «Tomar foto».')
      return
    }
    if (botonCatalogo.activo && botonCatalogo.productos.length === 0) {
      setPestana('inicial')
      setErrorGuardar('Cargue el archivo de productos del botón de catálogo.')
      return
    }
    // Sin ningún botón activo, el visitante toca la pantalla y no tiene qué hacer
    const hayAlgunBoton =
      botonJugarActivo ||
      botonFoto.activo ||
      botonRegistro.activo ||
      botonCatalogo.activo ||
      botonesAdicionales.some((boton) => boton.activo)
    if (!hayAlgunBoton) {
      setPestana('inicial')
      setErrorGuardar('Debe permanecer al menos un botón habilitado: Jugar, uno adicional, Tomar foto, registro o catálogo.')
      return
    }
    setErrorGuardar('')
    guardar.mutate()
  }

  // El robot estira el fondo a toda la pantalla sin conservar su proporción: aquí igual.
  // Y escribe con Roboto, no con la letra del panel (más ancha): el lienzo la usa para medir igual.
  const estiloFondo = (url: string): React.CSSProperties => ({
    fontFamily: FUENTE_ROBOT,
    ...(url
      ? { backgroundImage: `url(${url})`, backgroundSize: '100% 100%' }
      : { background: 'linear-gradient(160deg, #1e2a4a 0%, #10173a 100%)' }),
  })

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
    <DisenoContext.Provider value={disenoDe(ini.diseno)}>
    <SoloLecturaContext.Provider value={soloLectura}>
    <div className="flex h-full flex-col">
      {/* Barra superior: nombre + pestañas */}
      <div className="flex flex-col border-b border-slate-200 bg-white md:flex-row md:items-center md:justify-between md:pl-10">
        <div className="px-2 py-2 md:px-0">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            readOnly={soloLectura}
            className="w-full rounded px-2 text-2xl font-bold text-slate-800 focus:bg-slate-50 focus:outline-none md:w-96"
            title={soloLectura ? undefined : 'Nombre del proyecto (haga clic para editar)'}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-sm text-slate-400">
            <span>Versión {config.version}</span>
            {hayCambios && !guardar.isPending && !soloLectura && <Advertencia>Hay cambios sin guardar</Advertencia>}
            <AvisoArchivosFaltantes faltan={archivosFaltantes} />
          </div>
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
              className="relative aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
              style={estiloFondo(ini.fondo_url)}
            >
              {/* Banner: panel de color de la guía hacia abajo, detrás de todo lo demás */}
              {banner && (
                <div className="absolute inset-x-0 bottom-0" style={{ height: `${pctPanel}%`, backgroundColor: colorPanel }} />
              )}
              <div className="absolute right-3 top-3 z-10">
                <Lapiz
                  title="Cambiar imagen de fondo"
                  onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'inicial' })}
                />
              </div>
              <div className="relative flex h-full flex-col items-center">
                {/* Logo (imgLogo en el robot): caja de 650 × 250 dp a 48 dp del borde;
                    la imagen se ajusta adentro sin deformarse */}
                <div className="relative shrink-0" style={{ width: dp(650), height: dp(250), marginTop: dp(48) }}>
                  {/* Oculto: se ve tenue para poder editarlo; en el robot queda el espacio vacío */}
                  <div className={`h-full w-full ${ini.logo_visible ? '' : 'opacity-25'}`}>
                    {ini.logo_url ? (
                      <img src={ini.logo_url} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-lg border-2 border-dashed border-white/50 text-sm text-white/70">
                        Logo de la empresa
                      </div>
                    )}
                  </div>
                  <div className="absolute left-full top-1/2 ml-2 flex -translate-y-1/2 items-center gap-2">
                    {!ini.logo_visible && <EtiquetaOculto />}
                    <Lapiz title="Cambiar logo" onClick={() => setDialogo({ tipo: 'logo' })} />
                  </div>
                </div>

                {/* Banner: título, subtítulo y botones van sobre el panel, 36 dp debajo
                    de la guía y a 64 dp de los bordes */}
                <div
                  className={banner ? 'absolute inset-x-0 flex flex-col' : 'contents'}
                  style={banner ? { top: `calc(${100 - pctPanel}% + ${dp(36)})`, paddingInline: dp(64) } : undefined}
                >
                {/* Título: franja de lado a lado; en feria, cinta con 300 dp de margen a cada lado */}
                <div className="relative w-full shrink-0" style={feria ? { paddingInline: dp(300) } : undefined}>
                  <p
                    className={`w-full font-bold ${banner ? 'text-left' : 'text-center'} ${ini.titulo_visible ? '' : 'opacity-25'}`}
                    style={{
                      fontSize: dp(banner ? 52 : feria ? 56 : 50),
                      padding: feria ? `${dp(18)} ${dp(48)}` : 0,
                      color: ini.titulo.color_texto || (banner ? textoPanel : feria ? FERIA.tituloTexto : '#1e2a4a'),
                      backgroundColor: banner
                        ? 'transparent'
                        : colorConOpacidad(
                            ini.titulo.color_fondo || (feria ? FERIA.tituloFondo : ''),
                            ini.titulo.opacidad_fondo
                          ),
                      textShadow: banner ? undefined : sombraTexto(ini.titulo),
                      ...(feria ? ESTILO_CINTA : {}),
                    }}
                  >
                    {ini.titulo.texto || 'Título (use el lápiz para editar)'}
                  </p>
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {!ini.titulo_visible && <EtiquetaOculto />}
                    <Lapiz title="Editar título" onClick={() => setDialogo({ tipo: 'titulo' })} />
                  </div>
                </div>

                {/* Subtítulo: debajo del título; en feria, barra con 240 dp de margen */}
                <div className="relative w-full shrink-0" style={feria ? { paddingInline: dp(240) } : undefined}>
                  <p
                    className={`w-full font-bold ${banner ? 'text-left' : 'text-center'} ${ini.subtitulo_visible ? '' : 'opacity-25'}`}
                    style={{
                      fontSize: dp(banner ? 32 : feria ? 34 : 50),
                      padding: feria ? `${dp(12)} ${dp(40)} ${dp(14)}` : 0,
                      borderRadius: feria ? `0 0 ${dp(14)} ${dp(14)}` : undefined,
                      color:
                        ini.subtitulo.color_texto ||
                        (banner ? colorContraste(colorPanel, 0.75) : feria ? FERIA.subtituloTexto : '#1e2a4a'),
                      backgroundColor: banner
                        ? 'transparent'
                        : colorConOpacidad(
                            ini.subtitulo.color_fondo || (feria ? FERIA.subtituloFondo : ''),
                            ini.subtitulo.opacidad_fondo
                          ),
                      textShadow: banner ? undefined : sombraTexto(ini.subtitulo),
                      fontFamily: feria ? FUENTE_FERIA : undefined,
                    }}
                  >
                    {ini.subtitulo.texto || 'Subtítulo'}
                  </p>
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
                    {!ini.subtitulo_visible && <EtiquetaOculto />}
                    <Lapiz title="Editar subtítulo" onClick={() => setDialogo({ tipo: 'subtitulo' })} />
                  </div>
                </div>

                {/* Fila de botones: un botón mide 520 dp; varios se reparten el ancho con 12 dp entre ellos */}
                <div
                  className="flex w-full shrink-0 items-start justify-center"
                  style={{ marginTop: dp(margenFila), paddingInline: banner ? 0 : dp(lateralFila) }}
                >
                  {botonesVistaPrevia.map(({ id, estilo, textoDefecto, editar }) => {
                    const esTarjeta = estilo.forma === 'tarjeta'
                    const tieneImagen = esTarjeta && Boolean(estilo.imagen_url)
                    // Feria o banner + tarjeta sin imagen: se dibuja sola (rayas, círculo con ícono y franja)
                    const tarjetaDibujada = (feria || banner) && esTarjeta && !tieneImagen
                    // Las tarjetas miden el triple de alto (en el banner, 250 dp)
                    const alto = esTarjeta ? (banner ? 250 : altoBase * 3) : altoBase
                    const texto = estilo.texto || textoDefecto
                    return (
                      <div
                        key={id}
                        className="relative flex min-w-0"
                        style={{
                          width: variosBotones ? undefined : dp(520),
                          flex: variosBotones ? '1 1 0' : 'none',
                          // en el robot todos menos Jugar llevan 12 dp a la izquierda
                          marginLeft: id === 'jugar' ? 0 : dp(12),
                        }}
                      >
                        {tarjetaDibujada ? (
                          <TarjetaFeria
                            estilo={estilo}
                            texto={texto}
                            alto={alto}
                            tamanoTexto={tamanoBoton}
                            plano={banner}
                            fondoDefecto={banner ? colorPanel : undefined}
                          />
                        ) : (
                          <span
                            className="flex w-full min-w-0 items-center justify-center text-center font-bold"
                            style={{
                              // en feria la sombra dura de 8 dp va dentro del alto del botón
                              height: dp(feria ? alto - 8 : alto),
                              borderRadius: dp(esTarjeta ? 28 : 70),
                              paddingInline: dp(16),
                              color: banner
                                ? esTarjeta
                                  ? '#ffffff' // tarjeta con imagen: texto blanco, como en el robot
                                  : estilo.color_texto || colorContraste(estilo.color_fondo || colorPanel)
                                : estilo.color_texto || (feria ? FERIA.botonTexto : '#ffffff'),
                              backgroundColor: estilo.color_fondo || (banner ? colorPanel : feria ? FERIA.botonFondo : '#031046'),
                              // el robot estira la imagen a la tarjeta, sin conservar su proporción
                              backgroundImage: tieneImagen ? `url(${estilo.imagen_url})` : undefined,
                              backgroundSize: '100% 100%',
                              ...(banner
                                ? {
                                    // Banner: sin contorno si hay color de fondo; si no, contorno del color del texto
                                    border: tieneImagen
                                      ? 'none'
                                      : `${dp(4)} solid ${estilo.color_contorno || estilo.color_fondo || colorContraste(colorPanel)}`,
                                    boxShadow: esTarjeta ? `0 ${dp(10)} ${dp(18)} rgba(100, 116, 139, 0.32)` : undefined,
                                  }
                                : feria
                                ? {
                                    // Feria: borde grueso (también sobre la imagen) y sombra dura hacia abajo
                                    border: `${dp(5)} solid ${estilo.color_contorno || FERIA.contorno}`,
                                    boxShadow: `0 ${dp(8)} 0 ${estilo.color_contorno || FERIA.contorno}`,
                                    fontFamily: FUENTE_FERIA,
                                    textTransform: 'uppercase' as const,
                                  }
                                : {
                                    border: tieneImagen ? 'none' : `${dp(6)} solid ${estilo.color_contorno || '#FFD700'}`,
                                    // Sombra fija del contenedor: da profundidad sin alterar la imagen.
                                    boxShadow: esTarjeta ? `0 ${dp(10)} ${dp(18)} rgba(100, 116, 139, 0.32)` : undefined,
                                  }),
                            }}
                          >
                            <TextoAjustado texto={texto} tamano={tamanoBoton} />
                          </span>
                        )}
                        {/* El lápiz va encima del botón para no quitarle ancho: en el robot no existe */}
                        <span className="absolute -right-2 -top-2 z-10">
                          <Lapiz title="Editar botón" onClick={editar} />
                        </span>
                      </div>
                    )
                  })}
                </div>
                </div>
              </div>
              {banner && (
                <>
                  {/* Contador del banner: barra de 10 dp en el borde del panel y etiqueta sobre la imagen */}
                  <div
                    className="absolute inset-x-0"
                    style={{ bottom: `${pctPanel}%`, height: dp(10), backgroundColor: colorContraste(colorPanel, 0.18) }}
                  >
                    <div className="h-full w-[62%]" style={{ backgroundColor: ini.color_contador || '#FFD700' }} />
                  </div>
                  <span
                    className="absolute font-bold"
                    style={{
                      right: dp(96),
                      bottom: `calc(${pctPanel}% + ${dp(10)})`,
                      padding: `${dp(12)} ${dp(36)}`,
                      fontSize: dp(36),
                      borderRadius: `${dp(22)} ${dp(22)} 0 0`,
                      backgroundColor: colorPanel,
                      color: textoPanel,
                    }}
                  >
                    Continuaré en <span style={{ color: ini.color_contador || '#FFD700' }}>15</span>
                  </span>
                </>
              )}
              {/* Contador al pausar (MainActivity.estilizarContador), por encima de los botones como en el robot.
                  Clásico: texto suelto abajo a la derecha. Feria: píldora oscura abajo al centro, o abajo a la
                  derecha si hay alguna tarjeta (app 1.20) para no taparle el texto */}
              {!banner && (
                <span
                  className="pointer-events-none absolute z-[5] whitespace-nowrap font-bold"
                  style={{
                    bottom: dp(40),
                    fontSize: dp(36),
                    ...(feria && !hayTarjeta
                      ? { left: '50%', transform: 'translateX(-50%)' }
                      : { right: dp(40) }),
                    ...(feria
                      ? {
                          padding: `${dp(12)} ${dp(36)}`,
                          borderRadius: dp(60),
                          backgroundColor: 'rgba(17, 17, 17, 0.9)',
                          color: '#ffffff',
                          fontFamily: FUENTE_FERIA,
                        }
                      : { color: ini.color_contador || '#FFD700' }),
                  }}
                >
                  {feria ? (
                    <>
                      Continuaré en <span style={{ color: ini.color_contador || '#FFD700' }}>15</span>
                    </>
                  ) : (
                    'Continuaré en 15...'
                  )}
                </span>
              )}
            </div>
          ) : (
            <div
              className="relative aspect-[16/9] w-full max-w-3xl overflow-hidden rounded-xl shadow-lg"
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
            {pestana === 'inicial' && (
              <SelectorDiseno
                valor={disenoDe(ini.diseno)}
                onChange={(diseno) => setInicial({ diseno })}
                deshabilitado={soloLectura}
                colorPanel={ini.color_panel ?? ''}
                onColorPanel={(color_panel) => setInicial({ color_panel })}
              />
            )}
            {/* En teléfono no hay lápices en la vista previa: lo que solo se
                editaba con ellos aparece aquí */}
            <div className="mb-5 space-y-1 border-b border-slate-200 pb-5 md:hidden">
              <p className="px-3 pb-1 font-semibold text-slate-800">Pantalla</p>
              {pestana === 'inicial' ? (
                <>
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Imagen de fondo"
                    detalle={falta(ini.fondo_url) ? 'El archivo no existe: súbalo de nuevo' : ini.fondo_url ? nombreDesdeUrl(ini.fondo_url) : 'Vacío'}
                    alerta={falta(ini.fondo_url)}
                    onClick={() => setDialogo({ tipo: 'fondo', pantalla: 'inicial' })}
                  />
                  <ItemPanel
                    icono={<IconoEditar />}
                    label="Logo de la empresa"
                    detalle={
                      falta(ini.logo_url)
                        ? 'El archivo no existe: súbalo de nuevo'
                        : `${ini.logo_url ? nombreDesdeUrl(ini.logo_url) : 'Vacío'}${ini.logo_visible ? '' : ' · Oculto'}`
                    }
                    alerta={falta(ini.logo_url)}
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
                    detalle={falta(rul.fondo_url) ? 'El archivo no existe: súbalo de nuevo' : rul.fondo_url ? nombreDesdeUrl(rul.fondo_url) : 'Vacío'}
                    alerta={falta(rul.fondo_url)}
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
                  detalle={
                    falta(ini.video_patrullaje_url)
                      ? 'El archivo no existe: súbalo de nuevo'
                      : ini.video_patrullaje_url
                        ? 'Video cargado'
                        : 'Vacío'
                  }
                  alerta={falta(ini.video_patrullaje_url)}
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
                          : boton.accion === 'secuencia'
                            ? `Secuencia ${boton.secuencia || 'pendiente'}`
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
                        : 'Falta cargar el marco de la promoción'
                  }
                  onClick={() => setDialogo({ tipo: 'boton-foto' })}
                />
                <ItemPanel
                  icono={<IconoPlay />}
                  label={botonRegistro.boton.texto || 'Botón de registro'}
                  detalle={botonRegistro.activo ? 'Muestra un QR al formulario de registro' : 'Desactivado'}
                  onClick={() => setDialogo({ tipo: 'boton-registro' })}
                />
                <ItemPanel
                  icono={<IconoPlay />}
                  label={botonCatalogo.boton.texto || 'Botón de catálogo'}
                  detalle={
                    !botonCatalogo.activo
                      ? 'Desactivado'
                      : botonCatalogo.productos.length > 0
                        ? `${botonCatalogo.productos.length} productos`
                        : 'Falta cargar el archivo de productos'
                  }
                  onClick={() => setDialogo({ tipo: 'boton-catalogo' })}
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
                        disabled={soloLectura}
                        checked={rul.despues_quiz.modo === opcion.valor}
                        onChange={() =>
                          setRuleta({ despues_quiz: { ...rul.despues_quiz, modo: opcion.valor } })
                        }
                        className="mt-1 accent-[#1d293d]"
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
                      detalle={rul.despues_quiz.secuencia_guia || 'Sin definir: ingrese el nombre de la secuencia de Temi Center'}
                      onClick={() => setDialogo({ tipo: 'secuencia' })}
                    />
                  </div>
                )}

                <hr className="my-5 border-slate-200" />

                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-800">Preguntas</p>
                  <button
                    onClick={() => setDialogo({ tipo: 'pregunta', index: null })}
                    disabled={soloLectura || rul.preguntas.length >= LIMITES.PREGUNTAS_MAX}
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
                  <Advertencia className="mt-2">
                    Agrega al menos {LIMITES.PREGUNTAS_MIN} preguntas para que la ruleta funcione.
                  </Advertencia>
                )}
              </div>
            )}
          </div>

          {/* Computador: al final del panel. En teléfono se cambian por los
              botones flotantes de abajo */}
          {!soloLectura && (
          <div className="hidden border-t border-slate-200 p-6 md:block">
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmarBorrar(true)}
                disabled={guardar.isPending || borrar.isPending}
                title="Eliminar proyecto"
                className="px-5 py-4 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
              >
                Eliminar
              </button>
              <button
                onClick={intentarGuardar}
                disabled={guardar.isPending}
                className="flex flex-1 items-center justify-center gap-3 bg-[#1d293d] py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <IconoGuardar />
                {guardar.isPending ? 'Guardando...' : guardadoOk ? 'Guardado ✓' : 'Guardar'}
              </button>
            </div>
            {errorGuardar && <Advertencia className="mt-2">{errorGuardar}</Advertencia>}
            {guardar.isError && (
              <Advertencia className="mt-2">No se pudo guardar. {describirError(guardar.error)}</Advertencia>
            )}
          </div>
          )}
        </aside>
      </div>

      {/* ─── Teléfono: engranaje flotante abajo a la derecha. Al tocarlo gira y
          despliega hacia arriba Guardar y Eliminar, uno tras otro.
          z-30 queda por debajo del menú lateral (z-40/50) cuando se abre ─── */}
      {!soloLectura && accionesAbiertas && (
        // tocar fuera cierra las acciones
        <div className="fixed inset-0 z-20 md:hidden" onClick={() => setAccionesAbiertas(false)} aria-hidden="true" />
      )}
      <div className={`fixed bottom-6 right-6 z-30 flex-col items-end gap-3 md:hidden ${soloLectura ? 'hidden' : 'flex'}`}>
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
          className="bg-[#1d293d] text-white shadow-[#1d293d]/30 hover:opacity-90"
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
      {(errorGuardar || guardar.isError) && (
        <div className="fixed bottom-6 left-4 right-24 z-30 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-lg md:hidden">
          {errorGuardar ? (
            <Advertencia>{errorGuardar}</Advertencia>
          ) : (
            <Advertencia>No se pudo guardar. {describirError(guardar.error)}</Advertencia>
          )}
        </div>
      )}

      {/* ─── Salir con cambios sin guardar ─── */}
      {salida.state === 'blocked' && (
        <Modal
          titulo="Hay cambios sin guardar"
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
              <p className="font-semibold">Este proyecto está asignado a los siguientes robots:</p>
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
            <Advertencia className="mt-3">No se pudo eliminar. {describirError(borrar.error)}</Advertencia>
          )}
        </Modal>
      )}

      {/* ─── Diálogos ─── */}
      {dialogo?.tipo === 'titulo' && (
        <DialogTexto
          titulo="Editar título"
          valor={ini.titulo}
          maxCaracteres={LIMITES.TITULO_MAX}
          visible={ini.titulo_visible}
          onGuardar={(titulo, titulo_visible) => setInicial({ titulo, titulo_visible })}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'subtitulo' && (
        <DialogTexto
          titulo="Editar subtítulo"
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
      {dialogo?.tipo === 'boton-registro' && (
        <DialogRegistro
          valor={botonRegistro}
          projectId={projectId!}
          onGuardar={setBotonRegistro}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'boton-catalogo' && (
        <DialogCatalogo
          valor={botonCatalogo}
          projectId={projectId!}
          onGuardar={setBotonCatalogo}
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
          nota="El robot lo muestra en un espacio de 731 × 281 px sin deformarlo. PNG con fondo transparente."
          mostrar={{
            etiqueta: 'Logo visible',
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
          etiqueta="Ingrese el nombre de la secuencia creada en Temi Center"
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
    </SoloLecturaContext.Provider>
    </DisenoContext.Provider>
  )
}
