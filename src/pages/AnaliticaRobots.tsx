import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { haceCuanto } from '../lib/tiempo'
import { Cargando } from '../components/Cargando'
import robotPng from '../assets/icons/robot.png'

/** el robot reporta cada pocos segundos: sin reporte en 6 s está desconectado */
const ROBOT_EN_LINEA_MS = 6_000

interface EstadoRobot {
  serial: string
  nombre: string | null
  bateria: number | null
  cargando: boolean | null
  updated_at: string
}

function Avatar({ enLinea, grande = false }: { enLinea: boolean; grande?: boolean }) {
  return (
    <span className={`relative flex shrink-0 items-center justify-center rounded-full bg-slate-100 ${grande ? 'h-16 w-16' : 'h-12 w-12'}`}>
      <img src={robotPng} alt="" className={`w-auto object-contain ${grande ? 'h-11' : 'h-8'} ${enLinea ? '' : 'opacity-50'}`} />
      <span
        className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white"
        style={{ backgroundColor: enLinea ? '#1baf7a' : '#c3c2b7' }}
        title={enLinea ? 'En línea' : 'Desconectado'}
      />
    </span>
  )
}

function Estado({ enLinea }: { enLinea: boolean }) {
  return (
    <span className={`flex shrink-0 items-center gap-1.5 text-xs font-medium ${enLinea ? 'text-emerald-600' : 'text-slate-400'}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: enLinea ? '#1baf7a' : '#c3c2b7' }} />
      {enLinea ? 'Conectado' : 'Desconectado'}
    </span>
  )
}

/** Analítica › Robots: lista de robots y la ficha del elegido */
export function AnaliticaRobots() {
  const { data: estados, isLoading } = useQuery({
    queryKey: ['robot-status', 'analitica'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_status')
        .select('serial, nombre, bateria, cargando, updated_at')
        .order('nombre', { ascending: true, nullsFirst: false })
        .order('serial', { ascending: true })
      if (error) throw error
      // solo robots reales (11 caracteres), sin los de demo/prueba
      return (data as EstadoRobot[]).filter((r) => r.serial.length === 11)
    },
    refetchInterval: 2_000,
  })

  const { data: fijados } = useQuery({
    queryKey: ['robots', 'analitica-fijados'],
    queryFn: async () => {
      const { data, error } = await supabase.from('robots').select('serial, project_id')
      if (error) throw error
      return data as { serial: string; project_id: string | null }[]
    },
  })

  const { data: proyectos } = useQuery({
    queryKey: ['proyectos-nombres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, nombre').order('nombre')
      if (error) throw error
      return data as { id: string; nombre: string }[]
    },
  })

  const [elegido, setElegido] = useState<string | null>(null)
  const actual = estados?.find((r) => r.serial === elegido) ?? estados?.[0]

  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const enLinea = (r: EstadoRobot) => ahora - new Date(r.updated_at).getTime() <= ROBOT_EN_LINEA_MS

  // Total de interacciones del robot elegido
  const { data: totalInteracciones } = useQuery({
    queryKey: ['robot-total-interacciones', actual?.serial],
    enabled: !!actual,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('serial', actual!.serial)
      if (error) throw error
      return count ?? 0
    },
  })

  const idProyecto = actual ? fijados?.find((r) => r.serial === actual.serial)?.project_id : null
  const proyecto = idProyecto ? (proyectos?.find((p) => p.id === idProyecto)?.nombre ?? 'Proyecto eliminado') : 'Sin proyecto'

  return (
    <div className="px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Robots</h2>
      <p className="mt-2 text-slate-600">Seleccione un robot para consultar su actividad y el proyecto asociado.</p>

      {isLoading ? (
        <Cargando texto="Cargando robots…" className="py-16" />
      ) : (estados ?? []).length === 0 ? (
        <p className="mt-6 rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-400">Todavía no hay robots registrados.</p>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            {(estados ?? []).map((r) => {
              const activo = r.serial === actual?.serial
              return (
                <button
                  key={r.serial}
                  type="button"
                  onClick={() => setElegido(r.serial)}
                  className={`flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left shadow-sm transition-colors ${
                    activo ? 'border-[#1d293d] ring-1 ring-[#1d293d]' : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <Avatar enLinea={enLinea(r)} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{r.nombre || 'Robot'}</p>
                    <p className="text-xs text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}># {r.serial}</p>
                  </div>
                  <Estado enLinea={enLinea(r)} />
                </button>
              )
            })}
          </div>

          {actual && (
            <div className="self-start rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <Avatar enLinea={enLinea(actual)} grande />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-slate-900">{actual.nombre || 'Robot'}</p>
                  <p className="text-sm text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}># {actual.serial}</p>
                </div>
                <Estado enLinea={enLinea(actual)} />
              </div>

              <dl className="mt-6 grid gap-x-8 gap-y-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-slate-500">Proyecto asociado</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{proyecto}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Interacciones registradas</dt>
                  <dd className="mt-1 font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {totalInteracciones !== undefined ? totalInteracciones.toLocaleString('es-CO') : '…'}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Última vez en línea</dt>
                  <dd className="mt-1 font-semibold text-slate-800">{enLinea(actual) ? 'En línea ahora' : haceCuanto(actual.updated_at)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Estado de la batería</dt>
                  <dd className="mt-1 font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {actual.bateria === null ? 'Sin dato' : `${actual.bateria}%`}
                    {actual.bateria !== null && actual.cargando ? ' · Cargando' : ''}
                    {actual.bateria !== null && !enLinea(actual) ? ' · última conocida' : ''}
                  </dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
