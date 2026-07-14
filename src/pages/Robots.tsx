import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import robotPng from '../assets/icons/robot.png'

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
}

function edadMs(iso: string): number {
  return Date.now() - new Date(iso).getTime()
}

function haceCuanto(iso: string): string {
  const seg = Math.max(0, Math.floor(edadMs(iso) / 1000))
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

  return (
    <div className="px-12 py-10">
      <h2 className="text-4xl font-bold text-slate-900">Robots</h2>
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
          const enServicio = edadMs(r.updated_at) <= UMBRAL_SIN_REPORTE_MS
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
                      <span className="text-emerald-700">En servicio</span>
                    ) : (
                      <span className="text-slate-500">Sin reporte · {haceCuanto(r.updated_at)}</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Batería */}
              <div className="mt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Batería{!enServicio && r.bateria != null ? ' (última conocida)' : ''}
                  </span>
                  <span className="font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {r.bateria != null ? `${r.bateria}%` : '—'}
                    {r.cargando ? ' ⚡' : ''}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
