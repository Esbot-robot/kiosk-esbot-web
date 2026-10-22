import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BotonAgregarRobot, FilaVinculo } from '../components/VinculoRobotPanel'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'
import { avisoCargando, avisoError, avisoGuardado, cerrarAviso } from '../lib/alertas'
import { Modal } from '../components/Modal'
import { Ayuda } from '../components/Ayuda'
import { DialogRuta } from '../components/DialogRuta'
import { DialogDetener, FRASE_QUIETO_SEG_DEFECTO, type ModoQuieto } from '../components/DialogDetener'
import robotBlanco from '../assets/icons/blanco_robot.webp'
import robotNegro from '../assets/icons/negro_robot.webp'
import { Cargando } from '../components/Cargando'
import { Advertencia } from '../components/Advertencia'

/* El latido de la app llega cada 3s; si el último tiene más de 6s
   (2 latidos perdidos), el robot se muestra como "Sin reporte".
   El panel se refresca cada 2s para que el cambio se vea casi al instante. */
const UMBRAL_SIN_REPORTE_MS = 6_000
const REFRESCO_PANEL_MS = 2_000

interface RobotStatus {
  serial: string
  nombre: string | null
  bateria: number | null
  cargando: boolean | null
  updated_at: string
  /** lo que pide el panel: no recorrer ubicaciones */
  quieto?: boolean
  /** lo que el robot tiene aplicado, según su último latido */
  quieto_confirmado?: boolean
  /** quieto sin video: pantalla inicial fija, con una frase cada cierto tiempo */
  quieto_sin_video?: boolean
  quieto_frase?: string | null
  quieto_frase_seg?: number | null
  /** número de la última orden de quieto y de la última que el robot aplicó */
  quieto_orden?: number | null
  quieto_orden_hecha?: number | null
  /** versión de la config que el robot tiene aplicada; null en apps anteriores */
  version_config?: number | null
  /** ubicaciones del mapa del robot; null si su app aún no las envía */
  ubicaciones_mapa?: string[] | null
  /** ruta de patrullaje, guardada aquí o en el admin del robot */
  ruta?: string[] | null
  /** última orden del panel: 'actualizar' | 'reiniciar' */
  comando?: string | null
  /** número de esa orden (milisegundos del servidor) */
  comando_id?: number | null
  /** número de la última orden que el robot ejecutó */
  comando_hecho_id?: number | null
  /** PRUEBA: orden de videollamada a la que responde el robot */
  videollamada_id?: number | null
  /** enlace de la reunión de temi */
  videollamada_url?: string | null
  /** motivo si el robot no pudo crearla */
  videollamada_error?: string | null
}

/** Robots de cuerpo blanco: el resto son negros. Para uno nuevo, agregar su serial. */
const ROBOTS_BLANCOS = new Set(['00122260063'])

/** versión actual del proyecto fijado a cada serial */
type VersionPorSerial = Record<string, number>

/**
 * Compara la versión que reporta el robot con la del proyecto fijado.
 * El robot solo descarga la config al arrancar, así que "pendiente" casi
 * siempre se arregla reiniciando la app; si sigue, es el internet del robot.
 */
function estadoVersion(r: RobotStatus, versionProyecto: number | undefined): {
  texto: string
  /** ok = sincronizado; aviso = falta cargar la última versión */
  tipo: 'ok' | 'neutro' | 'aviso'
} {
  const v = r.version_config
  if (v == null) return { texto: 'Versión de config sin reportar', tipo: 'neutro' }
  if (versionProyecto === undefined) return { texto: `Config v${v} · sin proyecto fijado`, tipo: 'neutro' }
  if (v === versionProyecto) return { texto: `Config v${v}`, tipo: 'ok' }
  return { texto: `Config v${v} · falta cargar la v${versionProyecto}`, tipo: 'aviso' }
}

function edadMs(iso: string, ahora: number): number {
  return ahora - new Date(iso).getTime()
}

function haceCuanto(iso: string, ahora: number): string {
  const seg = Math.max(0, Math.floor(edadMs(iso, ahora) / 1000))
  if (seg < 60) return `hace ${seg} s`
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  return `hace ${Math.floor(horas / 24)} días`
}

function colorBateria(nivel: number): string {
  if (nivel > 50) return '#1baf7a' // verde
  if (nivel > 20) return '#eda100' // ámbar
  return '#e34948' // rojo
}

/**
 * Batería vertical en forma de tanque: se llena desde abajo con el color del
 * nivel. Desconectado: atenuada y con "Última conocida" debajo.
 */
/** Batería en una línea, solo en tarjetas angostas (el tanque vertical no cabe al lado del texto) */
function BateriaCompacta({ nivel, enServicio }: { nivel: number | null; enServicio: boolean }) {
  const pct = nivel == null ? 0 : Math.max(0, Math.min(100, nivel))
  const color = nivel == null ? '#c3c2b7' : colorBateria(pct)
  return (
    <p className="flex items-center gap-2 @md:hidden">
      <span className="h-2 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100" style={{ opacity: enServicio ? 1 : 0.5 }}>
        <span className="block h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
        Batería {nivel == null ? '—' : `${pct}%`}
        {!enServicio && nivel != null && ' · última conocida'}
      </span>
    </p>
  )
}

function TanqueBateria({ nivel, cargando, enServicio }: { nivel: number | null; cargando: boolean; enServicio: boolean }) {
  const pct = nivel == null ? 0 : Math.max(0, Math.min(100, nivel))
  const color = nivel == null ? '#c3c2b7' : colorBateria(pct)
  const estado =
    nivel == null
      ? 'Sin dato'
      : !enServicio
        ? 'Última conocida'
        : cargando
          ? 'Cargando'
          : pct > 50
            ? 'Óptima'
            : pct > 20
              ? 'Media'
              : 'Baja'
  // el porcentaje va centrado: en blanco cuando el relleno ya lo cubre
  const textoClaro = pct >= 55
  return (
    // En una tarjeta angosta no cabe al lado del texto: ahí va BateriaCompacta
    <div className="hidden shrink-0 flex-col items-center border-l border-slate-100 pl-4 @md:flex">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-400">Batería</p>
      <div
        className="relative mt-2 h-24 w-12 overflow-hidden rounded-[1.1rem] border border-slate-200 bg-slate-100"
        style={{ opacity: enServicio ? 1 : 0.5 }}
        title={nivel == null ? 'Sin dato de batería' : `${pct}%${cargando ? ' · cargando' : ''}`}
      >
        <div
          className="absolute inset-x-0 bottom-0 transition-all duration-500"
          style={{ height: `${pct}%`, backgroundColor: color }}
        />
        <div
          className={`absolute inset-0 flex flex-col items-center justify-center text-sm font-bold ${
            textoClaro ? 'text-white' : 'text-slate-700'
          }`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {cargando && enServicio && (
            <svg viewBox="0 0 24 24" className="mb-0.5 h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
            </svg>
          )}
          {nivel == null ? '—' : `${pct}%`}
        </div>
      </div>
      <p className="mt-2 text-xs font-medium" style={{ color: enServicio && nivel != null ? color : '#94a3b8' }}>
        {estado}
      </p>
    </div>
  )
}

export function Robots() {
  // "tic" que redibuja cada segundo aunque no lleguen datos nuevos, para que
  // el paso a "Sin reporte" (que depende del tiempo, no de un dato) ocurra solo
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const { data: robots, isLoading } = useQuery({
    queryKey: ['robot-status'],
    queryFn: async (): Promise<RobotStatus[]> => {
      const { data, error } = await supabase
        .from('robot_status')
        .select('*')
        // Orden fijo: por updated_at, los robots en línea se turnaban el
        // primer lugar en cada latido y las tarjetas saltaban de posición
        .order('nombre', { ascending: true, nullsFirst: false })
        .order('serial', { ascending: true })
      if (error) throw error
      return data as RobotStatus[]
    },
    refetchInterval: REFRESCO_PANEL_MS,
  })

  // La versión cambia solo al guardar un proyecto: no hace falta pedirla cada 2 s
  const { data: versiones } = useQuery({
    queryKey: ['versiones-robots'],
    queryFn: async (): Promise<VersionPorSerial> => {
      const [asignados, proyectos] = await Promise.all([
        supabase.from('robots').select('serial, project_id'),
        supabase.from('projects').select('id, version:config->version'),
      ])
      if (asignados.error) throw asignados.error
      if (proyectos.error) throw proyectos.error
      const porProyecto = new Map(
        (proyectos.data as { id: string; version: number | null }[]).map((p) => [p.id, Number(p.version ?? 1)])
      )
      const resultado: VersionPorSerial = {}
      for (const { serial, project_id } of asignados.data as { serial: string; project_id: string | null }[]) {
        const version = project_id ? porProyecto.get(project_id) : undefined
        if (version !== undefined) resultado[serial] = version
      }
      return resultado
    },
    refetchInterval: 10_000,
  })

  // Filtro por conexión (solo en pantalla: no consulta nada nuevo)
  const [filtro, setFiltro] = useState<FiltroEstado>(filtroEstadoGuardado)
  function cambiarFiltro(nuevo: FiltroEstado) {
    setFiltro(nuevo)
    try {
      sessionStorage.setItem(CLAVE_FILTRO_ESTADO, nuevo)
    } catch {
      // sin almacenamiento: el filtro funciona igual, solo que no se recuerda
    }
  }
  const enLinea = (r: RobotStatus) => edadMs(r.updated_at, ahora) <= UMBRAL_SIN_REPORTE_MS
  const visibles = (robots ?? []).filter((r) =>
    filtro === 'todos' ? true : filtro === 'en_linea' ? enLinea(r) : !enLinea(r)
  )

  return (
    // En teléfono menos margen y título más chico; desde md, como siempre
    <div className="px-4 py-6 sm:px-8 md:px-12 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Robots</h2>
          <p className="mt-2 text-slate-600">
            Estado en vivo de cada robot: conexión, batería y versión de la config.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <BotonAgregarRobot />
        {/* "Estado - En línea ▾": select sin borde, como la referencia */}
        <label className="relative flex items-center gap-1.5 text-sm text-slate-500">
          Estado -
          <select
            value={filtro}
            onChange={(e) => cambiarFiltro(e.target.value as FiltroEstado)}
            className="cursor-pointer appearance-none bg-transparent py-1 pr-6 font-semibold text-slate-800 focus:outline-none"
          >
            <option value="todos">Todos</option>
            <option value="en_linea">En línea</option>
            <option value="desconectados">Desconectados</option>
          </select>
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-0 h-4 w-4 text-slate-600" fill="currentColor" aria-hidden="true">
            <path d="M5.5 8h9L10 13z" />
          </svg>
        </label>
        </div>
      </div>

      {isLoading && <Cargando texto="Cargando robots…" />}

      {!isLoading && (robots ?? []).length > 0 && visibles.length === 0 && (
        <p className="mt-10 text-slate-500">
          {filtro === 'en_linea' ? 'Ningún robot está en línea en este momento.' : 'Todos los robots están en línea.'}
        </p>
      )}

      {!isLoading && (robots ?? []).length === 0 && (
        <p className="mt-10 text-slate-500">
          No hay reportes. Los robots aparecen automáticamente al abrir la app Kiosk Esbot.
        </p>
      )}

      {/* Dos por fila con ancho máximo: si sobra pantalla, queda espacio a la derecha */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-[repeat(2,minmax(0,38rem))]">
        {visibles.map((r) => {
          const enServicio = edadMs(r.updated_at, ahora) <= UMBRAL_SIN_REPORTE_MS
          return (
            <div key={r.serial} className="@container flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="flex items-center gap-4 p-5">
                {/* El robot con su sombra (viene en la imagen), sin caja ni giro */}
                <img
                  src={ROBOTS_BLANCOS.has(r.serial) ? robotBlanco : robotNegro}
                  alt=""
                  draggable={false}
                  className={`w-16 shrink-0 select-none @md:w-24 ${enServicio ? '' : 'opacity-40 grayscale'}`}
                />

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-bold text-slate-900" title={r.nombre || 'Robot'}>
                    {r.nombre || 'Robot'}
                  </h3>
                  <p className="mt-0.5 truncate whitespace-nowrap font-mono text-sm text-slate-500"># {r.serial}</p>

                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="flex items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: enServicio ? '#1baf7a' : '#c3c2b7' }}
                      />
                      {enServicio ? (
                        <span className="font-medium text-emerald-700">En línea</span>
                      ) : (
                        <span className="text-slate-500">Desconectado · {haceCuanto(r.updated_at, ahora)}</span>
                      )}
                    </p>
                    {(() => {
                      const version = estadoVersion(r, versiones?.[r.serial])
                      if (version.tipo === 'aviso') {
                        return (
                          <Advertencia>{version.texto}</Advertencia>
                        )
                      }
                      return (
                        <p className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: version.tipo === 'ok' ? '#1baf7a' : '#c3c2b7' }}
                          />
                          <span className={version.tipo === 'ok' ? 'text-slate-700' : 'text-slate-500'}>
                            {version.texto}
                            {version.tipo === 'ok' && <span className="text-emerald-700"> · Sincronizado</span>}
                          </span>
                        </p>
                      )
                    })()}
                    <BateriaCompacta nivel={r.bateria} enServicio={enServicio} />
                    <FilaVinculo serial={r.serial} enServicio={enServicio} />
                  </div>
                </div>

                <TanqueBateria nivel={r.bateria} cargando={!!r.cargando} enServicio={enServicio} />
              </div>

              <ControlRuta robot={r} enServicio={enServicio} />
              <ControlComandos robot={r} enServicio={enServicio} ahora={ahora} versionProyecto={versiones?.[r.serial]} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** el enlace de la videollamada vence a los 30 min (igual que en la app) */
const VALIDEZ_LLAMADA_MS = 30 * 60 * 1000
/** "Enlace ya usado" se muestra unos segundos y desaparece */
const MOSTRAR_USADO_MS = 10_000
/** si el robot no termina en este tiempo, se deja de esperar y se avisa */
const LIMITE_ORDEN_MS = 3 * 60 * 1000

/** "9:05" a partir de milisegundos */
function minutosSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Orden que el panel está esperando que el robot termine */
type FiltroEstado = 'todos' | 'en_linea' | 'desconectados'

/** El filtro de estado se recuerda mientras la pestaña siga abierta (se pierde al cerrarla) */
const CLAVE_FILTRO_ESTADO = 'kiosk.robots.filtroEstado'
function filtroEstadoGuardado(): FiltroEstado {
  try {
    const valor = sessionStorage.getItem(CLAVE_FILTRO_ESTADO)
    if (valor === 'en_linea' || valor === 'desconectados') return valor
  } catch {
    // sin almacenamiento (ventana privada o bloqueado): queda en "todos"
  }
  return 'todos'
}

/** Nombre de la secuencia de la carita que se usó la última vez (por navegador) */
const CLAVE_CARITA = 'kiosk.secuenciaCarita'
function nombreCaritaGuardado(): string {
  try {
    return localStorage.getItem(CLAVE_CARITA) || 'Carita'
  } catch {
    return 'Carita'
  }
}

/** Frases que se le han hecho decir al robot (se recuerdan en este navegador para repetirlas) */
const CLAVE_FRASES = 'kiosk.frasesDecir'
const MAX_FRASE = 300
function frasesGuardadas(): string[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(CLAVE_FRASES) || '[]')
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 6) : []
  } catch {
    return []
  }
}
function recordarFrase(frase: string): string[] {
  const lista = [frase, ...frasesGuardadas().filter((f) => f !== frase)].slice(0, 6)
  try {
    localStorage.setItem(CLAVE_FRASES, JSON.stringify(lista))
  } catch {
    // sin almacenamiento: simplemente no se recuerdan
  }
  return lista
}

/** Cómo se ve el robot al hablar: lo que cada opción activa en la voz de temi */
type ModoHabla = 'voz' | 'anim' | 'animtxt'
const MODOS_HABLA: { id: ModoHabla; nombre: string }[] = [
  { id: 'voz', nombre: 'Solo voz' },
  { id: 'anim', nombre: 'Con animación' },
  { id: 'animtxt', nombre: 'Con animación y texto' },
]
const IDIOMAS_HABLA = [
  { id: 'ES_ES', nombre: 'Español' },
  { id: 'EN_US', nombre: 'Inglés' },
  { id: 'SYSTEM', nombre: 'Idioma del robot' },
]

type TipoOrden = 'actualizar' | 'reiniciar' | 'videollamada' | 'carita' | 'quitar_carita' | 'decir'

interface Seguimiento {
  tipo: TipoOrden
  id: number
  desde: number
}

/**
 * Órdenes al robot por el latido: buscar la config ya, reiniciar la app y
 * videollamada. Las tres muestran un aviso de carga mientras el robot trabaja
 * y un aviso de listo (o del error) al terminar.
 * Solo sirven si la app sigue enviando latidos: si se cerró o se colgó del
 * todo, el robot aparece "Desconectado" y hay que ir hasta él.
 */
function ControlComandos({
  robot,
  enServicio,
  ahora,
  versionProyecto,
}: {
  robot: RobotStatus
  enServicio: boolean
  ahora: number
  versionProyecto: number | undefined
}) {
  const queryClient = useQueryClient()
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  /** enlace de videollamada ya abierto: es de un solo uso, no sirve otra vez */
  const [llamadaUsada, setLlamadaUsada] = useState<number | null>(null)
  /** cuándo se vio por primera vez "enlace usado", para quitarlo a los 10 s */
  const [usadoVisto, setUsadoVisto] = useState<{ id: number; desde: number } | null>(null)
  const [seguimiento, setSeguimiento] = useState<Seguimiento | null>(null)
  const seguimientoRef = useRef<Seguimiento | null>(null)
  seguimientoRef.current = seguimiento

  const pedidoId = robot.comando_id ?? 0
  const hechoId = robot.comando_hecho_id ?? 0
  const pendiente = pedidoId > hechoId
  const llamada = robot.comando === 'videollamada'
  // El robot ya respondió a la última orden de videollamada (con enlace o error)
  const respuestaLlamada = llamada && pedidoId > 0 && robot.videollamada_id === pedidoId
  const restanteLlamada = pedidoId + VALIDEZ_LLAMADA_MS - ahora
  const enlaceVigente = restanteLlamada > 0
  // Usado: lo abrió aquí, o el robot avisó que alguien entró (llega sin enlace ni error)
  const enlaceUsado =
    respuestaLlamada &&
    ((robot.videollamada_url != null && llamadaUsada === pedidoId) ||
      (!robot.videollamada_url && !robot.videollamada_error))

  useEffect(() => {
    if (enlaceUsado && usadoVisto?.id !== pedidoId) setUsadoVisto({ id: pedidoId, desde: Date.now() })
  }, [enlaceUsado, pedidoId, usadoVisto?.id])

  const enviar = useMutation({
    // La carita viaja como 'carita:<nombre de la secuencia>'
    mutationFn: async (comando: string) => {
      const { data, error } = await supabase.rpc('enviar_comando', { p_serial: robot.serial, p_comando: comando })
      if (error) throw error
      const tipo: TipoOrden = comando.startsWith('carita:')
        ? 'carita'
        : comando.startsWith('decir:')
          ? 'decir'
          : (comando as TipoOrden)
      return { comando: tipo, id: Number(data) }
    },
    onSuccess: ({ comando, id }) => {
      // refresca ya, sin esperar los 2 s del intervalo
      void queryClient.invalidateQueries({ queryKey: ['robot-status'] })
      if (!enServicio) {
        void avisoError('El robot no está en línea', 'La orden se hará cuando vuelva a conectarse.')
        return
      }
      setSeguimiento({ tipo: comando, id, desde: Date.now() })
      void avisoCargando(
        comando === 'reiniciar'
          ? 'Reiniciando la app…'
          : comando === 'videollamada'
            ? 'Creando la videollamada…'
            : comando === 'carita'
              ? 'Activando la carita…'
              : comando === 'quitar_carita'
                ? 'Quitando la carita…'
                : comando === 'decir'
                  ? 'Enviando el mensaje…'
                  : 'Buscando actualización…'
      )
    },
    onError: (e) => void avisoError('No se pudo enviar la orden', describirError(e)),
  })

  // Mientras se espera, revisa con cada latido si el robot ya terminó
  useEffect(() => {
    if (!seguimiento) return
    const terminar = () => {
      setSeguimiento(null)
      void cerrarAviso()
    }
    if (Date.now() - seguimiento.desde > LIMITE_ORDEN_MS) {
      terminar()
      void avisoError('El robot no terminó a tiempo', 'Verifique la conexión a internet del robot y el estado de la versión.')
      return
    }
    if (seguimiento.tipo === 'videollamada') {
      // Termina cuando el robot devuelve el enlace (o el motivo del error)
      if (robot.videollamada_id !== seguimiento.id) return
      terminar()
      if (robot.videollamada_url) void avisoGuardado('Videollamada lista')
      else void avisoError('No se pudo crear la videollamada', robot.videollamada_error ?? undefined)
      return
    }
    if (hechoId < seguimiento.id) return // todavía no la recibe
    if (seguimiento.tipo === 'reiniciar') {
      terminar()
      void avisoGuardado('App reiniciada')
      return
    }
    if (seguimiento.tipo === 'decir') {
      terminar()
      void avisoGuardado('Mensaje enviado')
      return
    }
    if (seguimiento.tipo === 'carita' || seguimiento.tipo === 'quitar_carita') {
      terminar()
      void avisoGuardado(seguimiento.tipo === 'carita' ? 'Carita activada' : 'Carita quitada')
      return
    }
    // Actualizar: la recibió; si hay versión nueva, se espera a que la aplique
    const v = robot.version_config
    if (versionProyecto === undefined || v === versionProyecto) {
      terminar()
      void avisoGuardado(v != null ? `Config al día (v${v})` : 'Actualización solicitada')
    } else if (!enServicio) {
      terminar()
      void avisoError('El robot se desconectó', 'Terminará de actualizarse cuando vuelva a conectarse.')
    }
  }, [seguimiento, hechoId, robot.version_config, robot.videollamada_id, robot.videollamada_url, robot.videollamada_error, versionProyecto, enServicio, ahora])

  // Si se sale de la página con un aviso de carga abierto, se cierra
  useEffect(() => () => {
    if (seguimientoRef.current) void cerrarAviso()
  }, [])

  const ocupado = pendiente || enviar.isPending || seguimiento !== null
  // La carita sigue activa mientras la última orden recibida sea "carita:…"
  const caritaActiva = (robot.comando ?? '').startsWith('carita:') && hechoId >= pedidoId
  const [pidiendoCarita, setPidiendoCarita] = useState(false)
  // "Decir algo": la frase, cómo se ve el robot al hablar y el idioma
  const [diciendo, setDiciendo] = useState(false)
  const [frase, setFrase] = useState('')
  const [modoHabla, setModoHabla] = useState<ModoHabla>('anim')
  const [idiomaHabla, setIdiomaHabla] = useState('ES_ES')
  const [recientes, setRecientes] = useState(frasesGuardadas)
  const [nombreCarita, setNombreCarita] = useState(nombreCaritaGuardado)

  const claseBoton =
    'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50'

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
      <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">
        App del robot
        <Ayuda>
          Actualizar config: el robot busca de inmediato la última versión del proyecto, sin reiniciar. Si continúa indicando «falta cargar», reinicie la app. Reiniciar app: la cierra y la vuelve a abrir; arranca con su ruta y su modo quieto. Mostrar carita: el robot deja de patrullar y repite de forma continua la secuencia de la carita de Temi Center, aunque haya personas cerca, hasta que se seleccione «Quitar carita». Decir algo: el robot reproduce el mensaje ingresado con la voz de Temi; puede tardar unos segundos en llegar. Estas órdenes solo funcionan con el robot en línea: si aparece «Desconectado», la app no está recibiendo órdenes.
        </Ayuda>
      </p>
      {/* Tres botones del mismo ancho; en tarjeta angosta, uno debajo del otro */}
      <div className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-3">
        <button type="button" disabled={ocupado} onClick={() => enviar.mutate('actualizar')} className={claseBoton}>
          Actualizar config
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={() => enviar.mutate('videollamada')}
          title="El robot crea un enlace de videollamada de temi (un solo uso, vence en 30 min)"
          className={claseBoton}
        >
          Videollamada
        </button>
        <button type="button" disabled={ocupado} onClick={() => setConfirmarReinicio(true)} className={claseBoton}>
          Reiniciar app
        </button>
        {caritaActiva ? (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => enviar.mutate('quitar_carita')}
            className="rounded-lg bg-[#2A4470] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#223a60] disabled:opacity-50"
          >
            Quitar carita
          </button>
        ) : (
          <button type="button" disabled={ocupado} onClick={() => setPidiendoCarita(true)} className={claseBoton}>
            Mostrar carita
          </button>
        )}
        <button type="button" disabled={ocupado} onClick={() => setDiciendo(true)} className={claseBoton}>
          Decir algo
        </button>
      </div>

      {diciendo && (
        <Modal
          titulo="Decir algo"
          textoAceptar="Decir"
          ancho="max-w-[35rem]"
          aceptarDeshabilitado={!frase.trim()}
          onCancelar={() => setDiciendo(false)}
          onAceptar={() => {
            const texto = frase.trim().slice(0, MAX_FRASE)
            setRecientes(recordarFrase(texto))
            enviar.mutate('decir:' + JSON.stringify({ t: texto, m: modoHabla, i: idiomaHabla }))
            setDiciendo(false)
          }}
        >
          <p className="text-slate-700">
            <span className="font-semibold">{robot.nombre || 'El robot'}</span> leerá esta frase con la voz de Temi.
            Llega en unos segundos.
          </p>
          <textarea
            value={frase}
            maxLength={MAX_FRASE}
            rows={4}
            autoFocus
            onChange={(e) => setFrase(e.target.value.slice(0, MAX_FRASE))}
            placeholder="Ingrese el mensaje que debe reproducir el robot"
            className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {frase.length} / {MAX_FRASE} caracteres
          </p>

          {/* Mismo estilo del filtro de estado: etiqueta, valor en negrita y flecha, sin borde */}
          <div className="mt-3 flex flex-wrap items-center gap-x-8 gap-y-2">
            {(
              [
                { etiqueta: 'Al hablar', valor: modoHabla, opciones: MODOS_HABLA, cambiar: (v: string) => setModoHabla(v as ModoHabla) },
                { etiqueta: 'Idioma', valor: idiomaHabla, opciones: IDIOMAS_HABLA, cambiar: setIdiomaHabla },
              ] as const
            ).map((campo) => (
              <label key={campo.etiqueta} className="relative flex items-center gap-1.5 text-slate-500">
                {campo.etiqueta} -
                <select
                  value={campo.valor}
                  onChange={(e) => campo.cambiar(e.target.value)}
                  className="cursor-pointer appearance-none bg-transparent py-1 pr-6 font-semibold text-slate-800 focus:outline-none"
                >
                  {campo.opciones.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.nombre}
                    </option>
                  ))}
                </select>
                <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-0 h-4 w-4 text-slate-600" fill="currentColor" aria-hidden="true">
                  <path d="M5.5 8h9L10 13z" />
                </svg>
              </label>
            ))}
          </div>

          {recientes.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-800">Recientes</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {recientes.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrase(f)}
                    title={f}
                    className="max-w-full truncate rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    {f.length > 42 ? `${f.slice(0, 42)}…` : f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!enServicio && (
            <Advertencia className="mt-4">
              Este robot no está en línea: lo dirá cuando vuelva a conectarse.
            </Advertencia>
          )}
        </Modal>
      )}

      {pidiendoCarita && (
        <Modal
          titulo="Mostrar carita"
          textoAceptar="Mostrar"
          ancho="max-w-[35rem]"
          aceptarDeshabilitado={!nombreCarita.trim()}
          onCancelar={() => setPidiendoCarita(false)}
          onAceptar={() => {
            const nombre = nombreCarita.trim().slice(0, 80)
            try {
              localStorage.setItem(CLAVE_CARITA, nombre)
            } catch {
              // sin almacenamiento: la próxima vez vuelve a sugerir "Carita"
            }
            enviar.mutate(`carita:${nombre}`)
            setPidiendoCarita(false)
          }}
        >
          <p className="text-slate-700">
            <span className="font-semibold">{robot.nombre || 'El robot'}</span> dejará de patrullar y repetirá la
            carita en loop.
          </p>
          <label className="mt-4 block text-sm font-medium text-slate-800">
            Secuencia de Temi Center
            <input
              value={nombreCarita}
              maxLength={80}
              onChange={(e) => setNombreCarita(e.target.value)}
              placeholder="Nombre exacto de la secuencia"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal focus:border-indigo-500 focus:outline-none"
            />
          </label>
          <p className="mt-1 text-xs text-slate-500">Debe coincidir exactamente con el nombre en Temi Center. Requiere conexión a internet.</p>
          {!enServicio && (
            <Advertencia className="mt-3">
              Este robot no está en línea: la carita se mostrará cuando vuelva a conectarse.
            </Advertencia>
          )}
        </Modal>
      )}

      {enlaceUsado && usadoVisto?.id === pedidoId && ahora - usadoVisto.desde < MOSTRAR_USADO_MS && (
        <p className="mt-3 border-t border-slate-200 pt-3 text-sm text-slate-500">
          Enlace ya usado (es de un solo uso). Para entrar otra vez, toca Videollamada y se crea uno nuevo.
        </p>
      )}
      {respuestaLlamada && enlaceVigente && robot.videollamada_url && llamadaUsada !== pedidoId && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-sm">
          <a
            onClick={() => setLlamadaUsada(pedidoId)}
            href={robot.videollamada_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#2A4470] px-4 py-2 font-semibold text-white transition-colors hover:bg-[#223a60]"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="6" width="12" height="12" rx="2" />
              <path d="m15 10.5 6-3.5v10l-6-3.5" />
            </svg>
            Abrir videollamada
          </a>
          <span className="text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
            Un solo uso · vence en <span className="font-semibold text-slate-800">{minutosSegundos(restanteLlamada)}</span>
          </span>
        </div>
      )}

      {confirmarReinicio && (
        <Modal
          titulo="¿Reiniciar la app del robot?"
          textoAceptar="Sí, reiniciar"
          onCancelar={() => setConfirmarReinicio(false)}
          onAceptar={() => {
            enviar.mutate('reiniciar')
            setConfirmarReinicio(false)
          }}
        >
          <p className="text-slate-700">
            La app de <span className="font-semibold">{robot.nombre || 'el robot'}</span> se cerrará y volverá a abrir en unos segundos. Si está atendiendo a alguien, la interacción se corta. Al abrir, continúa con su ruta (o permanece quieto, si se había detenido).
          </p>
          {!enServicio && (
            <Advertencia className="mt-3">
              Este robot no está en línea: se reiniciará cuando vuelva a conectarse.
            </Advertencia>
          )}
        </Modal>
      )}
    </div>
  )
}

/**
 * Ruta de patrullaje y botón de detener/reanudar el recorrido, en la misma fila.
 *
 * El recorrido usa dos datos porque la orden viaja por el latido y puede
 * tardar (o no llegar, si el robot no tiene internet):
 *   quieto            -> lo que se pidió desde aquí
 *   quieto_confirmado -> lo que el robot tiene aplicado de verdad
 * Mientras no coinciden, el botón dice "Deteniendo…" / "Reanudando…".
 */
function ControlRuta({ robot, enServicio }: { robot: RobotStatus; enServicio: boolean }) {
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const [editandoFrase, setEditandoFrase] = useState(false)
  const ruta = robot.ruta ?? []
  const pedido = robot.quieto ?? false
  const aplicado = robot.quieto_confirmado ?? false
  const enCamino = enServicio && pedido !== aplicado
  const sinVideo = pedido && (robot.quieto_sin_video ?? false)
  const frase = robot.quieto_frase ?? ''
  const fraseSeg = robot.quieto_frase_seg ?? FRASE_QUIETO_SEG_DEFECTO
  // El robot aplica los cambios de frase y tiempo en su siguiente latido
  const aplicandoCambios = enServicio && pedido && (robot.quieto_orden ?? 0) !== (robot.quieto_orden_hecha ?? 0)

  const cambiar = useMutation({
    mutationFn: async (modo: { quieto: boolean } & Partial<ModoQuieto>) => {
      const { error } = await supabase.rpc('fijar_quieto_modo', {
        p_serial: robot.serial,
        p_quieto: modo.quieto,
        p_sin_video: modo.sinVideo ?? false,
        p_frase: modo.frase ?? '',
        p_seg: modo.segundos ?? FRASE_QUIETO_SEG_DEFECTO,
      })
      if (error) throw error
    },
    // refresca ya, sin esperar los 2 s del intervalo
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['robot-status'] }),
    onError: (e) => void avisoError('No se pudo cambiar el recorrido', describirError(e)),
  })

  return (
    <div className="border-t border-slate-100 px-5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* "Ruta: A → B → C" en la misma fila que los botones */}
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <span className="shrink-0 font-semibold text-slate-900">Ruta:</span>
            <span
              className={`truncate ${ruta.length ? 'text-slate-700' : 'text-slate-400'}`}
              title={ruta.length ? ruta.join(' → ') : undefined}
            >
              {ruta.length ? ruta.join(' → ') : 'Sin ruta guardada'}
            </span>
            <Ayuda>
              Ubicaciones que el robot recorre en orden. Se puede cambiar aquí o en el admin del robot, y los dos lados ven el último cambio guardado. El robot la guarda en su memoria: sin internet sigue patrullando con la última que recibió. Detener recorrido lo deja quieto en su lugar; con "Sin video" queda en la pantalla inicial fija y puede decir una frase cada cierto tiempo.
            </Ayuda>
          </p>
        </div>
        {/* En tarjeta angosta los dos botones ocupan la fila, mitad y mitad */}
        <div
          className={`grid w-full shrink-0 items-center gap-2 @lg:flex @lg:w-auto ${
            pedido ? 'grid-cols-[1fr_1fr_auto]' : 'grid-cols-2'
          }`}
        >
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            {ruta.length ? 'Editar ruta' : 'Configurar ruta'}
          </button>
          {pedido ? (
            <button
              type="button"
              disabled={cambiar.isPending || enCamino}
              onClick={() => cambiar.mutate({ quieto: false })}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {enCamino ? 'Deteniendo…' : 'Reanudar recorrido'}
            </button>
          ) : (
            <button
              type="button"
              disabled={cambiar.isPending || enCamino}
              onClick={() => setConfirmando(true)}
              className="rounded-lg bg-[#2A4470] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#223a60] disabled:opacity-50"
            >
              {enCamino ? 'Reanudando…' : 'Detener recorrido'}
            </button>
          )}
          {/* El lápiz está siempre que el robot esté quieto: desde ahí se enciende o apaga "Sin video" */}
          {pedido && (
            <button
              type="button"
              onClick={() => setEditandoFrase(true)}
              title={aplicandoCambios ? 'Editar el modo quieto (aplicando cambios…)' : 'Editar el modo quieto (con o sin video)'}
              aria-label="Editar el modo quieto"
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1d293d] text-white shadow-sm transition-opacity hover:opacity-85 ${
                aplicandoCambios ? 'animate-pulse' : ''
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {editando && (
        <DialogRuta
          serial={robot.serial}
          nombre={robot.nombre || 'Robot'}
          ubicacionesMapa={robot.ubicaciones_mapa ?? null}
          rutaActual={ruta}
          enServicio={enServicio}
          onCerrar={() => setEditando(false)}
        />
      )}

      {confirmando && (
        <DialogDetener
          nombreRobot={robot.nombre || 'El robot'}
          enServicio={enServicio}
          editando={false}
          inicial={{ sinVideo: false, frase: '', segundos: FRASE_QUIETO_SEG_DEFECTO }}
          onCerrar={() => setConfirmando(false)}
          onAceptar={(modo) => {
            cambiar.mutate({ quieto: true, ...modo })
            setConfirmando(false)
          }}
        />
      )}

      {editandoFrase && (
        <DialogDetener
          nombreRobot={robot.nombre || 'El robot'}
          enServicio={enServicio}
          editando
          inicial={{ sinVideo, frase, segundos: fraseSeg }}
          onCerrar={() => setEditandoFrase(false)}
          onAceptar={(modo) => {
            cambiar.mutate({ quieto: true, ...modo })
            setEditandoFrase(false)
          }}
        />
      )}
    </div>
  )
}
