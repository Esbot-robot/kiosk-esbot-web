import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/* Paleta validada (dataviz): 2 series, CVD-safe */
const COLOR_TOQUE = '#2a78d6' // azul — toques de pantalla
const COLOR_JUGAR = '#1baf7a' // aqua — botón jugar
const INK_MUTED = '#898781'
const GRID = '#e1e0d9'

interface Evento {
  id: number
  serial: string
  tipo: string
  video_seg: number | null
  creado_at: string
}

/* Fechas manejadas como texto plano (sin zonas horarias):
   los eventos se guardan tal cual y se comparan/agrupan por string. */

function ahoraLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

function inicioDeMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00`
}

type Granularidad = 'hora' | 'dia'

/** claves de agrupación entre desde y hasta (ambos "YYYY-MM-DDTHH:mm") */
function generarBuckets(desde: string, hasta: string, gran: Granularidad): string[] {
  const p = (n: number) => String(n).padStart(2, '0')
  const claves: string[] = []
  const d = new Date(desde)
  const fin = new Date(hasta)
  if (gran === 'hora') {
    d.setMinutes(0, 0, 0)
    while (d <= fin) {
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}`)
      d.setHours(d.getHours() + 1)
    }
  } else {
    d.setHours(0, 0, 0, 0)
    while (d <= fin) {
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
      d.setDate(d.getDate() + 1)
    }
  }
  return claves
}

function etiquetaBucket(clave: string, gran: Granularidad): string {
  if (gran === 'hora') {
    const [fecha, hora] = clave.split('T')
    const d = new Date(fecha + 'T00:00:00')
    return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${hora}h`
  }
  const d = new Date(clave + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

function etiquetaLarga(clave: string, gran: Granularidad): string {
  if (gran === 'hora') {
    const [fecha, hora] = clave.split('T')
    const d = new Date(fecha + 'T00:00:00')
    const dia = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    return `${dia} · ${hora}:00 – ${hora}:59`
  }
  const d = new Date(clave + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

const NOMBRE_TIPO: Record<string, string> = {
  toque_pantalla: 'Toque pantalla',
  boton_jugar: 'Botón jugar',
}

export function Analitica() {
  const [desde, setDesde] = useState(inicioDeMes())
  const [hasta, setHasta] = useState(ahoraLocal())
  const [robot, setRobot] = useState('todos')

  const { data: robots } = useQuery({
    queryKey: ['robots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('robots').select('serial')
      if (error) throw error
      return data as { serial: string }[]
    },
  })

  const { data: eventos, isLoading } = useQuery({
    queryKey: ['events', desde, hasta, robot],
    queryFn: async (): Promise<Evento[]> => {
      let q = supabase
        .from('events')
        .select('*')
        .gte('creado_at', `${desde}:00`)
        .lte('creado_at', `${hasta}:59`)
        .order('creado_at', { ascending: false })
        .limit(50_000)
      if (robot !== 'todos') q = q.eq('serial', robot)
      const { data, error } = await q
      if (error) throw error
      return data as Evento[]
    },
  })

  // ≤ 48 horas de rango → agrupar por hora; más → por día
  const granularidad: Granularidad =
    new Date(hasta).getTime() - new Date(desde).getTime() <= 48 * 3600_000 ? 'hora' : 'dia'

  const { buckets, serieToques, serieJugar, totalToques, totalJugar } = useMemo(() => {
    const buckets = generarBuckets(desde, hasta, granularidad)
    const idx = new Map(buckets.map((b, i) => [b, i]))
    const corte = granularidad === 'hora' ? 13 : 10
    const serieToques = buckets.map(() => 0)
    const serieJugar = buckets.map(() => 0)
    let totalToques = 0
    let totalJugar = 0
    for (const e of eventos ?? []) {
      if (e.tipo === 'toque_pantalla') totalToques++
      else if (e.tipo === 'boton_jugar') totalJugar++
      const i = idx.get(e.creado_at.slice(0, corte))
      if (i === undefined) continue
      if (e.tipo === 'toque_pantalla') serieToques[i]++
      else if (e.tipo === 'boton_jugar') serieJugar[i]++
    }
    return { buckets, serieToques, serieJugar, totalToques, totalJugar }
  }, [eventos, desde, hasta, granularidad])

  return (
    <div className="px-12 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-bold text-slate-900">Analítica</h2>
          <p className="mt-2 text-slate-600">
            Interacción de los visitantes con el robot en el evento.
          </p>
        </div>

        {/* Filtros: una sola fila, arriba de las gráficas */}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm text-slate-600">
            ID del Robot
            <select
              value={robot}
              onChange={(e) => setRobot(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
            >
              <option value="todos">Todos los robots</option>
              {(robots ?? []).map((r) => (
                <option key={r.serial} value={r.serial}>
                  {r.serial}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-slate-600">
            Desde
            <input
              type="datetime-local"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
            />
          </label>
          <label className="text-sm text-slate-600">
            Hasta
            <input
              type="datetime-local"
              value={hasta}
              min={desde}
              onChange={(e) => setHasta(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
            />
          </label>
        </div>
      </div>

      {/* Tarjetas de totales */}
      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_TOQUE }} />
            Total toques de pantalla
          </p>
          <p className="mt-2 text-4xl font-bold text-slate-900">
            {isLoading ? '—' : totalToques.toLocaleString('es-CO')}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_JUGAR }} />
            Total toques botón jugar
          </p>
          <p className="mt-2 text-4xl font-bold text-slate-900">
            {isLoading ? '—' : totalJugar.toLocaleString('es-CO')}
          </p>
        </div>
      </div>

      {/* Gráfica */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-900">
              Frecuencia de toques por {granularidad === 'hora' ? 'hora' : 'día'}
            </h3>
            <p className="text-sm text-slate-500">
              Interacción directa vs. intención de juego
              {granularidad === 'hora' && ' — rango corto: agrupado por hora'}
            </p>
          </div>
          <div className="flex items-center gap-5 text-sm text-slate-600">
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_TOQUE }} />
              Toques de pantalla
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_JUGAR }} />
              Botón jugar
            </span>
          </div>
        </div>

        {isLoading ? (
          <p className="py-16 text-center text-slate-400">Cargando eventos...</p>
        ) : totalToques + totalJugar === 0 ? (
          <p className="py-16 text-center text-slate-400">
            Sin eventos en este rango. Los robots registran toques automáticamente.
          </p>
        ) : (
          <GraficaLineas
            buckets={buckets}
            granularidad={granularidad}
            series={[serieToques, serieJugar]}
          />
        )}
      </div>

      {/* Detalle de cada evento individual */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="font-semibold text-slate-900">
          Detalle de eventos{' '}
          <span className="font-normal text-slate-400">
            ({(eventos ?? []).length.toLocaleString('es-CO')})
          </span>
        </h3>
        <p className="text-sm text-slate-500">Cada toque individual con su fecha y hora exacta.</p>

        <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-slate-100">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Evento</th>
                <th className="px-4 py-2 font-medium">Robot</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Hora</th>
                <th className="px-4 py-2 font-medium">Seg. del video</th>
              </tr>
            </thead>
            <tbody>
              {(eventos ?? []).map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-indigo-50/40">
                  <td className="flex items-center gap-2 px-4 py-2 text-slate-800">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: e.tipo === 'toque_pantalla' ? COLOR_TOQUE : COLOR_JUGAR,
                      }}
                    />
                    {NOMBRE_TIPO[e.tipo] ?? e.tipo}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{e.serial}</td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.creado_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.creado_at.slice(11, 19)}
                  </td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.video_seg != null ? `${e.video_seg.toFixed(1)}s` : '—'}
                  </td>
                </tr>
              ))}
              {(eventos ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                    Sin eventos en este rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* ───────────── Gráfica de líneas SVG con crosshair + tooltip ───────────── */

const ANCHO = 900
const ALTO = 300
const M = { top: 16, right: 24, bottom: 28, left: 40 }

function GraficaLineas({
  buckets,
  granularidad,
  series,
}: {
  buckets: string[]
  granularidad: Granularidad
  series: number[][]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const colores = [COLOR_TOQUE, COLOR_JUGAR]
  const nombres = ['Toques de pantalla', 'Botón jugar']

  const plotW = ANCHO - M.left - M.right
  const plotH = ALTO - M.top - M.bottom
  const maxY = Math.max(1, ...series.flat())
  const x = (i: number) =>
    M.left + (buckets.length === 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW)
  const y = (v: number) => M.top + plotH - (v / maxY) * plotH

  const ticksY = [0, Math.round(maxY / 2), maxY]
  const paso = Math.max(1, Math.ceil(buckets.length / 8))

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ANCHO
    const i = Math.round(((px - M.left) / plotW) * (buckets.length - 1))
    setHover(Math.max(0, Math.min(buckets.length - 1, i)))
  }

  return (
    <div className="relative mt-4">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {/* grid horizontal recesivo */}
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={ANCHO - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={INK_MUTED}>
              {t.toLocaleString('es-CO')}
            </text>
          </g>
        ))}

        {/* etiquetas eje x */}
        {buckets.map((b, i) =>
          i % paso === 0 ? (
            <text key={b} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="11" fill={INK_MUTED}>
              {etiquetaBucket(b, granularidad)}
            </text>
          ) : null
        )}

        {/* crosshair */}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={M.top}
            y2={M.top + plotH}
            stroke={INK_MUTED}
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* líneas de las series (2px) */}
        {series.map((serie, s) => (
          <polyline
            key={s}
            points={serie.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
            fill="none"
            stroke={colores[s]}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {/* marcadores en el punto bajo el cursor (≥8px) */}
        {hover !== null &&
          series.map((serie, s) => (
            <circle
              key={s}
              cx={x(hover)}
              cy={y(serie[hover])}
              r="5"
              fill={colores[s]}
              stroke="#ffffff"
              strokeWidth="2"
            />
          ))}
      </svg>

      {/* tooltip */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg"
          style={{
            left: `${(x(hover) / ANCHO) * 100}%`,
            top: 0,
          }}
        >
          <p className="text-sm font-bold whitespace-nowrap text-slate-900">
            {etiquetaLarga(buckets[hover], granularidad)}
          </p>
          {series.map((serie, s) => (
            <p key={s} className="mt-1 flex items-center gap-2 text-sm whitespace-nowrap text-slate-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colores[s] }} />
              {nombres[s]}: <span className="font-semibold text-slate-900">{serie[hover]}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
