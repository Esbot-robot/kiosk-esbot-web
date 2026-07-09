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

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function inicioDeMesISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function diasEntre(desde: string, hasta: string): string[] {
  const dias: string[] = []
  const fin = new Date(hasta + 'T00:00:00')
  for (let d = new Date(desde + 'T00:00:00'); d <= fin; d.setDate(d.getDate() + 1)) {
    dias.push(d.toISOString().slice(0, 10))
  }
  return dias
}

function etiquetaDia(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function Analitica() {
  const [desde, setDesde] = useState(inicioDeMesISO())
  const [hasta, setHasta] = useState(hoyISO())
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
        .gte('creado_at', `${desde}T00:00:00`)
        .lte('creado_at', `${hasta}T23:59:59`)
        .order('creado_at')
        .limit(50_000)
      if (robot !== 'todos') q = q.eq('serial', robot)
      const { data, error } = await q
      if (error) throw error
      return data as Evento[]
    },
  })

  const { dias, serieToques, serieJugar, totalToques, totalJugar } = useMemo(() => {
    const dias = diasEntre(desde, hasta)
    const idx = new Map(dias.map((d, i) => [d, i]))
    const serieToques = dias.map(() => 0)
    const serieJugar = dias.map(() => 0)
    for (const e of eventos ?? []) {
      const i = idx.get(e.creado_at.slice(0, 10))
      if (i === undefined) continue
      if (e.tipo === 'toque_pantalla') serieToques[i]++
      else if (e.tipo === 'boton_jugar') serieJugar[i]++
    }
    return {
      dias,
      serieToques,
      serieJugar,
      totalToques: serieToques.reduce((a, b) => a + b, 0),
      totalJugar: serieJugar.reduce((a, b) => a + b, 0),
    }
  }, [eventos, desde, hasta])

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
              type="date"
              value={desde}
              max={hasta}
              onChange={(e) => setDesde(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800"
            />
          </label>
          <label className="text-sm text-slate-600">
            Hasta
            <input
              type="date"
              value={hasta}
              min={desde}
              max={hoyISO()}
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
            <h3 className="font-semibold text-slate-900">Frecuencia de toques por día</h3>
            <p className="text-sm text-slate-500">
              Interacción directa vs. intención de juego
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
          <GraficaLineas dias={dias} series={[serieToques, serieJugar]} />
        )}
      </div>
    </div>
  )
}

/* ───────────── Gráfica de líneas SVG con crosshair + tooltip ───────────── */

const ANCHO = 900
const ALTO = 300
const M = { top: 16, right: 24, bottom: 28, left: 40 }

function GraficaLineas({ dias, series }: { dias: string[]; series: number[][] }) {
  const [hover, setHover] = useState<number | null>(null)
  const colores = [COLOR_TOQUE, COLOR_JUGAR]
  const nombres = ['Toques de pantalla', 'Botón jugar']

  const plotW = ANCHO - M.left - M.right
  const plotH = ALTO - M.top - M.bottom
  const maxY = Math.max(1, ...series.flat())
  const x = (i: number) => M.left + (dias.length === 1 ? plotW / 2 : (i / (dias.length - 1)) * plotW)
  const y = (v: number) => M.top + plotH - (v / maxY) * plotH

  const ticksY = [0, Math.round(maxY / 2), maxY]
  // etiquetas del eje x: máx ~8 para no amontonar
  const paso = Math.max(1, Math.ceil(dias.length / 8))

  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ANCHO
    const i = Math.round(((px - M.left) / plotW) * (dias.length - 1))
    setHover(Math.max(0, Math.min(dias.length - 1, i)))
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
        {dias.map((d, i) =>
          i % paso === 0 ? (
            <text key={d} x={x(i)} y={ALTO - 8} textAnchor="middle" fontSize="11" fill={INK_MUTED}>
              {etiquetaDia(d)}
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

      {/* tooltip como el mockup */}
      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-lg"
          style={{
            left: `${(x(hover) / ANCHO) * 100}%`,
            top: 0,
          }}
        >
          <p className="text-sm font-bold whitespace-nowrap text-slate-900">
            {new Date(dias[hover] + 'T00:00:00').toLocaleDateString('es-CO', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
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
