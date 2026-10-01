import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'
import { Modal } from '../components/Modal'
import { Ayuda } from '../components/Ayuda'
import { DialogRuta } from '../components/DialogRuta'
import robotPng from '../assets/icons/robot.png'
import cargandoPng from '../assets/icons/charging_icon.png'

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
}

/** versión actual del proyecto fijado a cada serial */
type VersionPorSerial = Record<string, number>

/**
 * Compara la versión que reporta el robot con la del proyecto fijado.
 * El robot solo descarga la config al arrancar, así que "pendiente" casi
 * siempre se arregla reiniciando la app; si sigue, es el internet del robot.
 */
function estadoVersion(r: RobotStatus, versionProyecto: number | undefined) {
  const v = r.version_config
  if (v == null) return { texto: 'Versión de config sin reportar', color: 'text-slate-400' }
  if (versionProyecto === undefined) return { texto: `Config v${v} · sin proyecto fijado`, color: 'text-slate-500' }
  if (v === versionProyecto) return { texto: `Config v${v} · Sincronizado`, color: 'text-emerald-700' }
  return {
    texto: `Config v${v} · falta cargar la v${versionProyecto} (reinicia la app)`,
    color: 'text-amber-700',
  }
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
        .order('updated_at', { ascending: false })
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

  return (
    // En teléfono menos margen y título más chico; desde md, como siempre
    <div className="px-4 py-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Robots</h2>
      <p className="mt-2 text-slate-600">
        Estado en vivo de cada robot: en servicio, batería y última señal de la app.
      </p>

      {isLoading && <p className="mt-10 text-slate-500">Cargando robots...</p>}

      {!isLoading && (robots ?? []).length === 0 && (
        <p className="mt-10 text-slate-500">
          Aún no hay reportes. Los robots aparecen aquí automáticamente al abrir la app Kiosk
          Esbot.
        </p>
      )}

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {(robots ?? []).map((r) => {
          const enServicio = edadMs(r.updated_at, ahora) <= UMBRAL_SIN_REPORTE_MS
          return (
            <div
              key={r.serial}
              className={`rounded-xl border bg-white p-6 shadow-sm ${
                enServicio ? 'border-emerald-300' : 'border-slate-200'
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Mismo icono del robot que las cards de proyectos sin fondo */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                  <img
                    src={robotPng}
                    alt=""
                    className={`h-16 w-auto object-contain ${enServicio ? 'opacity-90' : 'opacity-40'}`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-bold text-slate-900">
                    {r.nombre || 'Robot'}
                  </h3>
                  <p className="text-sm text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    # {r.serial}
                  </p>

                  <p className="mt-2 flex items-center gap-2 text-sm font-medium">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: enServicio ? '#1baf7a' : '#c3c2b7' }}
                    />
                    {enServicio ? (
                      <span className="text-emerald-700">En línea</span>
                    ) : (
                      <span className="text-slate-500">Desconectado · {haceCuanto(r.updated_at, ahora)}</span>
                    )}
                  </p>
                  {(() => {
                    const version = estadoVersion(r, versiones?.[r.serial])
                    return <p className={`mt-1 text-sm font-medium ${version.color}`}>{version.texto}</p>
                  })()}
                </div>
              </div>

              {/* Batería */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Batería{!enServicio && r.bateria != null ? ' (última conocida)' : ''}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 font-semibold text-slate-800"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    {r.bateria != null ? `${r.bateria}%` : '—'}
                    {r.cargando && (
                      <img
                        src={cargandoPng}
                        alt="Cargando"
                        title="Cargando"
                        className="h-4 w-4"
                        draggable={false}
                      />
                    )}
                  </span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  {r.bateria != null && (
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(2, Math.min(100, r.bateria))}%`,
                        backgroundColor: colorBateria(r.bateria),
                        opacity: enServicio ? 1 : 0.45,
                      }}
                    />
                  )}
                </div>
              </div>

              <ControlRuta robot={r} enServicio={enServicio} />
              <ControlComandos robot={r} enServicio={enServicio} ahora={ahora} />
              <ControlRecorrido robot={r} enServicio={enServicio} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

/** tiempo que se muestra "✓ hecho" después de que el robot confirma */
const MOSTRAR_HECHO_MS = 60_000

/**
 * Órdenes al robot por el latido: buscar la config ya y reiniciar la app.
 * Mientras el robot no confirma, se muestra "Actualizando…" / "Reiniciando…".
 * Reiniciar solo sirve si la app sigue enviando latidos: si se cerró o se
 * colgó del todo, el robot aparece "Desconectado" y hay que ir hasta él.
 */
function ControlComandos({ robot, enServicio, ahora }: { robot: RobotStatus; enServicio: boolean; ahora: number }) {
  const queryClient = useQueryClient()
  const [confirmarReinicio, setConfirmarReinicio] = useState(false)
  const pedidoId = robot.comando_id ?? 0
  const hechoId = robot.comando_hecho_id ?? 0
  const pendiente = pedidoId > hechoId
  const reinicio = robot.comando === 'reiniciar'

  const enviar = useMutation({
    mutationFn: async (comando: 'actualizar' | 'reiniciar') => {
      const { error } = await supabase.rpc('enviar_comando', { p_serial: robot.serial, p_comando: comando })
      if (error) throw error
    },
    // refresca ya, sin esperar los 2 s del intervalo
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['robot-status'] }),
  })

  let estado: { texto: string; color: string } | null = null
  if (pendiente) {
    estado = enServicio
      ? { texto: reinicio ? 'Reiniciando la app…' : 'Buscando actualización…', color: 'text-amber-700' }
      : { texto: 'Se hará cuando el robot vuelva a conectarse', color: 'text-slate-500' }
  } else if (pedidoId > 0 && pedidoId === hechoId && ahora - pedidoId < MOSTRAR_HECHO_MS) {
    estado = { texto: reinicio ? '✓ App reiniciada' : '✓ Actualización solicitada', color: 'text-emerald-700' }
  }

  const ocupado = pendiente || enviar.isPending

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-500">
          App del robot
          <Ayuda>
            Actualizar config: el robot busca ya la última versión del proyecto, sin reiniciar. Reiniciar app: la cierra y la vuelve a abrir; arranca con su ruta y su modo quieto. Solo funcionan si el robot está en línea: si aparece Desconectado, la app no está escuchando órdenes.
          </Ayuda>
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={ocupado}
            onClick={() => enviar.mutate('actualizar')}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Actualizar config
          </button>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setConfirmarReinicio(true)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Reiniciar app
          </button>
        </div>
      </div>

      {estado && <p className={`mt-2 text-sm font-medium ${estado.color}`}>{estado.texto}</p>}
      {enviar.error && (
        <p className="mt-2 text-sm font-medium text-rose-600">No se pudo enviar la orden. {describirError(enviar.error)}</p>
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
            La app de <span className="font-semibold">{robot.nombre || 'el robot'}</span> se cerrará y volverá a abrir en unos segundos. Si está atendiendo a alguien, la interacción se corta. Al abrir sigue con su ruta (o quieto, si lo detuviste).
          </p>
          {!enServicio && (
            <p className="mt-3 text-sm text-amber-700">
              Este robot no está en línea: se reiniciará cuando vuelva a conectarse.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}

/** Ruta de patrullaje del robot: resumen en la tarjeta y botón para editarla */
function ControlRuta({ robot, enServicio }: { robot: RobotStatus; enServicio: boolean }) {
  const [editando, setEditando] = useState(false)
  const ruta = robot.ruta ?? []

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-500">
          Ruta
          <Ayuda>
            Ubicaciones que el robot recorre en orden. Se puede cambiar aquí o en el admin del robot, y los dos lados ven el último cambio guardado. El robot la guarda en su memoria: sin internet sigue patrullando con la última que recibió.
          </Ayuda>
        </span>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          {ruta.length ? 'Editar ruta' : 'Configurar ruta'}
        </button>
      </div>
      <p className={`mt-2 text-sm ${ruta.length ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
        {ruta.length ? ruta.join(' → ') : 'Sin ruta guardada'}
      </p>

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
    </div>
  )
}

/**
 * Botón de modo quieto de cada robot.
 *
 * Se muestran dos datos distintos porque la orden viaja por el latido y puede
 * tardar (o no llegar, si el robot no tiene internet):
 *   quieto            -> lo que se pidió desde aquí
 *   quieto_confirmado -> lo que el robot tiene aplicado de verdad
 * Mientras no coinciden se ve "Deteniendo..." / "Reanudando...", para no dar
 * por hecho algo que el robot todavía no ha recibido.
 */
function ControlRecorrido({ robot, enServicio }: { robot: RobotStatus; enServicio: boolean }) {
  const queryClient = useQueryClient()
  const [confirmando, setConfirmando] = useState(false)
  const pedido = robot.quieto ?? false
  const aplicado = robot.quieto_confirmado ?? false

  const cambiar = useMutation({
    mutationFn: async (quieto: boolean) => {
      const { error } = await supabase.rpc('fijar_quieto', { p_serial: robot.serial, p_quieto: quieto })
      if (error) throw error
    },
    // refresca ya, sin esperar los 2 s del intervalo
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['robot-status'] }),
  })

  let estado: { texto: string; color: string } | null = null
  if (pedido && aplicado) estado = { texto: 'Recorrido en pausa', color: 'text-amber-700' }
  else if (pedido && !aplicado)
    estado = enServicio
      ? { texto: 'Deteniendo…', color: 'text-amber-700' }
      : { texto: 'Se detendrá cuando vuelva a reportar', color: 'text-slate-500' }
  else if (!pedido && aplicado)
    estado = enServicio
      ? { texto: 'Reanudando…', color: 'text-emerald-700' }
      : { texto: 'Reanudará cuando vuelva a reportar', color: 'text-slate-500' }

  return (
    <div className="mt-5 border-t border-slate-100 pt-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm text-slate-500">
          Recorrido
          <Ayuda>
            El robot está detenido en su ubicación actual. Las funciones multimedia y táctiles siguen activas. Puedes reanudar la ruta o cargar nuevas ubicaciones desde el panel de administración.
          </Ayuda>
        </span>

        {pedido ? (
          <button
            type="button"
            disabled={cambiar.isPending}
            onClick={() => cambiar.mutate(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Reanudar recorrido
          </button>
        ) : (
          <button
            type="button"
            disabled={cambiar.isPending}
            onClick={() => setConfirmando(true)}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
          >
            Detener recorrido
          </button>
        )}
      </div>

      {estado && <p className={`mt-2 text-sm font-medium ${estado.color}`}>{estado.texto}</p>}
      {cambiar.error && (
        <p className="mt-2 text-sm font-medium text-rose-600">
          No se pudo cambiar. {describirError(cambiar.error)}
        </p>
      )}

      {confirmando && (
        <Modal
          titulo="¿Detener el recorrido?"
          textoAceptar="Sí, detener"
          onCancelar={() => setConfirmando(false)}
          onAceptar={() => {
            cambiar.mutate(true)
            setConfirmando(false)
          }}
        >
          <p className="text-slate-700">
            <span className="font-semibold">{robot.nombre || 'El robot'}</span> dejará de desplazarse y permanecerá en su lugar actual. Todo lo demás seguirá funcionando con normalidad.
          </p>
          {!enServicio && (
            <p className="mt-3 text-sm text-amber-700">
              Este robot no está en línea: la orden se aplicará cuando vuelva a conectarse.
            </p>
          )}
        </Modal>
      )}
    </div>
  )
}
