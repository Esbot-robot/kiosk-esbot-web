import { useEffect, useId, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { generarReportePdf, type GrupoDist, type PreguntaDist } from '../lib/reportePdf'
import { Cargando } from '../components/Cargando'
import { esAdmin, usePerfil } from '../lib/perfil'
import { neutralizarFormula } from '../lib/csv'
import {
  ahoraLocal,
  curvaSuave,
  etiquetaBucket,
  etiquetaLarga,
  generarBuckets,
  inicioDeMes,
  pasoRedondo,
  type Granularidad,
} from '../lib/graficas'

const FILAS_POR_PAGINA = 100

// Un robot real de Temi tiene 11 caracteres; patrón LIKE de 11 comodines "_"
// para excluir seriales de demo/prueba (ej. el "0016004060" del emulador).
const PATRON_SERIAL_REAL = '_'.repeat(11)

/* Paleta validada (dataviz): acciones directas y acciones configurables */
const COLOR_TOQUE = '#2a78d6' // azul — toques de pantalla
const COLOR_JUGAR = '#1baf7a' // aqua — botón jugar
const COLOR_VIDEO = '#8b5cf6' // violeta — video configurado
const COLOR_UBICACION = '#e57a28' // naranja — guía a ubicación
const COLOR_FOTO = '#d6336c' // rosa — tomar foto
const COLOR_SECUENCIA = '#0891b2' // cian — secuencia de temi
const COLOR_REGISTRO = '#ca8a04' // ámbar — botón de registro
const COLOR_CATALOGO = '#475569' // pizarra — botón de catálogo
const INK_MUTED = '#a3a3b5'
const GRID = '#f1f1f4'

interface EventoLigero {
  serial: string
  tipo: string
  project_id: string | null
  creado_at: string
}

interface FilaRespuesta {
  pregunta: string | null
  respuesta: string | null
  serial: string
  project_id: string | null
}

/** Cuenta las respuestas por pregunta, de la más respondida a la menos */
function contarPreguntas(filas: FilaRespuesta[]): PreguntaDist[] {
  const mapa = new Map<string, Map<string, number>>()
  for (const f of filas) {
    const p = (f.pregunta ?? '').trim()
    if (!p) continue
    const r = (f.respuesta ?? '').trim() || 'Sin respuesta'
    if (!mapa.has(p)) mapa.set(p, new Map())
    const m = mapa.get(p)!
    m.set(r, (m.get(r) ?? 0) + 1)
  }
  return [...mapa.entries()]
    .map(([pregunta, m]) => {
      const respuestas = [...m.entries()]
        .map(([texto, conteo]) => ({ texto, conteo }))
        .sort((a, b) => b.conteo - a.conteo)
      return { pregunta, total: respuestas.reduce((a, b) => a + b.conteo, 0), respuestas }
    })
    .sort((a, b) => b.total - a.total)
}

interface Evento {
  id: number
  serial: string
  project_id: string | null
  tipo: string
  video_seg: number | null
  pregunta: string | null
  respuesta: string | null
  creado_at: string
}

const TIPOS_EVENTO = [
  { tipo: 'toque_pantalla', nombre: 'Toque pantalla', color: COLOR_TOQUE, ayuda: 'Veces que alguien tocó la pantalla del robot.' },
  { tipo: 'boton_jugar', nombre: 'Botón jugar', color: COLOR_JUGAR, ayuda: 'Veces que se tocó el botón para jugar el quiz.' },
  { tipo: 'boton_video', nombre: 'Botón video', color: COLOR_VIDEO, ayuda: 'Veces que se abrió un video configurado.' },
  { tipo: 'boton_ubicacion', nombre: 'Botón ubicación', color: COLOR_UBICACION, ayuda: 'Veces que el robot guió a alguien a una ubicación.' },
  { tipo: 'boton_foto', nombre: 'Botón foto', color: COLOR_FOTO, ayuda: 'Veces que se tocó el botón para tomarse una foto.' },
  { tipo: 'boton_secuencia', nombre: 'Botón secuencia', color: COLOR_SECUENCIA, ayuda: 'Veces que se tocó un botón que reproduce una secuencia de Temi.' },
  { tipo: 'boton_registro', nombre: 'Botón registro', color: COLOR_REGISTRO, ayuda: 'Veces que se tocó el botón de registro.' },
  { tipo: 'boton_catalogo', nombre: 'Botón catálogo', color: COLOR_CATALOGO, ayuda: 'Veces que se abrió el catálogo.' },
] as const

const NOMBRE_TIPO: Record<string, string> = Object.fromEntries(
  TIPOS_EVENTO.map(({ tipo, nombre }) => [tipo, nombre])
)

export function Analitica() {
  // El cliente lector ve solo los datos de sus proyectos: nada de robots (ni nombres ni desglose)
  const verRobots = esAdmin(usePerfil())
  const [desde, setDesde] = useState(inicioDeMes())
  const [hasta, setHasta] = useState(ahoraLocal())
  const [robot, setRobot] = useState('todos')
  // 'todos' | 'sin' (eventos anteriores, sin proyecto) | id del proyecto
  const [proyecto, setProyecto] = useState('todos')

  const { data: robots } = useQuery({
    queryKey: ['robots-nombres'],
    enabled: verRobots,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_status')
        .select('serial, nombre')
        .order('nombre', { ascending: true, nullsFirst: false })
        .order('serial', { ascending: true })
      if (error) throw error
      // solo robots reales (11 caracteres), sin los de demo/prueba
      return (data as { serial: string; nombre: string | null }[]).filter((r) => r.serial.length === 11)
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

  const nombreRobot = (serial: string) => robots?.find((r) => r.serial === serial)?.nombre || serial
  const nombreProyecto = (id: string | null) =>
    id ? (proyectos?.find((p) => p.id === id)?.nombre ?? 'Proyecto eliminado') : 'Sin proyecto'

  // ≤ 48 horas de rango → agrupar por hora; más → por día
  const granularidad: Granularidad =
    new Date(hasta).getTime() - new Date(desde).getTime() <= 48 * 3600_000 ? 'hora' : 'dia'

  // Líneas ocultas con la casilla de su cuadro
  const [ocultas, setOcultas] = useState<Set<string>>(new Set())
  function alternarSerie(tipo: string) {
    setOcultas((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(tipo)) nuevo.delete(tipo)
      else nuevo.add(tipo)
      return nuevo
    })
  }

  // Gráfica y barras: se leen los eventos del rango en tandas de 1.000 y se
  // agrupan en el navegador (volumen bajo: pocos robots).
  const { data: eventosRango, isLoading } = useQuery({
    queryKey: ['events-rango', desde, hasta, robot, proyecto],
    queryFn: async () => {
      const filas: EventoLigero[] = []
      for (let offset = 0; ; offset += 1000) {
        let q = supabase
          .from('events')
          .select('serial,tipo,project_id,creado_at')
          .gte('creado_at', `${desde}:00`)
          .lte('creado_at', `${hasta}:59`)
          .order('id', { ascending: true })
          .range(offset, offset + 999)
        if (robot !== 'todos') q = q.eq('serial', robot)
        else q = q.like('serial', PATRON_SERIAL_REAL)
        if (proyecto === 'sin') q = q.is('project_id', null)
        else if (proyecto !== 'todos') q = q.eq('project_id', proyecto)
        const { data, error } = await q
        if (error) throw error
        filas.push(...(data as EventoLigero[]))
        if (!data || data.length < 1000) break
      }
      return filas
    },
  })

  // Tabla de detalle: paginada — el navegador recibe 100 filas por página.
  const [pagina, setPagina] = useState(0)
  const [exportando, setExportando] = useState(false)
  useEffect(() => setPagina(0), [desde, hasta, robot, proyecto])

  /** Descarga TODOS los eventos del rango filtrado como CSV (en tandas de 1000) */
  async function exportarCsv(total: number) {
    if (total === 0 || exportando) return
    setExportando(true)
    try {
      const filas: Evento[] = []
      for (let offset = 0; offset < total; offset += 1000) {
        let q = supabase
          .from('events')
          .select('*')
          .gte('creado_at', `${desde}:00`)
          .lte('creado_at', `${hasta}:59`)
          .order('creado_at', { ascending: false })
          .range(offset, Math.min(offset + 999, total - 1))
        if (robot !== 'todos') q = q.eq('serial', robot)
        else q = q.like('serial', PATRON_SERIAL_REAL)
        if (proyecto === 'sin') q = q.is('project_id', null)
        else if (proyecto !== 'todos') q = q.eq('project_id', proyecto)
        const { data, error } = await q
        if (error) throw error
        filas.push(...(data as Evento[]))
        if (!data || data.length < 1000) break
      }

      const limpiar = (t: string | null) => neutralizarFormula((t ?? '').replace(/;/g, ',').replace(/\r?\n/g, ' '))
      const lineas = [`Evento;${verRobots ? 'Robot;' : ''}Proyecto;Fecha;Hora;Seg. del video;Pregunta;Respuesta`]
      for (const e of filas) {
        lineas.push(
          [
            NOMBRE_TIPO[e.tipo] ?? e.tipo,
            ...(verRobots ? [limpiar(nombreRobot(e.serial))] : []),
            limpiar(nombreProyecto(e.project_id)),
            e.creado_at.slice(0, 10),
            e.creado_at.slice(11, 19),
            e.video_seg != null ? e.video_seg : '',
            limpiar(e.pregunta),
            limpiar(e.respuesta),
          ].join(';')
        )
      }

      // BOM para que Excel abra las tildes bien; ";" como separador (Excel ES)
      const blob = new Blob(['﻿' + lineas.join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      })
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      enlace.download = `Interacciones_kioskEsbot_${desde.slice(0, 10)}_a_${hasta.slice(0, 10)}.csv`
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    } catch (e) {
      console.error('Error al exportar el CSV', e)
      alert('No fue posible exportar el CSV. Intente nuevamente.')
    } finally {
      setExportando(false)
    }
  }

  const { data: detalle } = useQuery({
    queryKey: ['events-detalle', desde, hasta, robot, proyecto, pagina],
    queryFn: async () => {
      let q = supabase
        .from('events')
        .select('*', { count: 'exact' })
        .gte('creado_at', `${desde}:00`)
        .lte('creado_at', `${hasta}:59`)
        .order('creado_at', { ascending: false })
        .range(pagina * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA + FILAS_POR_PAGINA - 1)
      if (robot !== 'todos') q = q.eq('serial', robot)
      else q = q.like('serial', PATRON_SERIAL_REAL)
      if (proyecto === 'sin') q = q.is('project_id', null)
      else if (proyecto !== 'todos') q = q.eq('project_id', proyecto)
      const { data, count, error } = await q
      if (error) throw error
      return { eventos: data as Evento[], total: count ?? 0 }
    },
  })

  // Respuestas del quiz del rango (filas sueltas; se agrupan al generar el PDF)
  const { data: respuestasQuiz } = useQuery({
    queryKey: ['distribucion', desde, hasta, robot, proyecto],
    queryFn: async () => {
      const filas: FilaRespuesta[] = []
      for (let offset = 0; ; offset += 1000) {
        let q = supabase
          .from('events')
          .select('pregunta,respuesta,serial,project_id')
          .eq('tipo', 'boton_jugar')
          .not('pregunta', 'is', null)
          .gte('creado_at', `${desde}:00`)
          .lte('creado_at', `${hasta}:59`)
          .order('id', { ascending: true })
          .range(offset, offset + 999)
        if (robot !== 'todos') q = q.eq('serial', robot)
        else q = q.like('serial', PATRON_SERIAL_REAL)
        if (proyecto === 'sin') q = q.is('project_id', null)
        else if (proyecto !== 'todos') q = q.eq('project_id', proyecto)
        const { data, error } = await q
        if (error) throw error
        filas.push(...(data as FilaRespuesta[]))
        if (!data || data.length < 1000) break
      }
      return filas
    },
  })

  const { buckets, series, totales, totalInteracciones, porRobot, porProyecto } = useMemo(() => {
    const buckets = generarBuckets(desde, hasta, granularidad)
    const idx = new Map(buckets.map((b, i) => [b, i]))
    const series = TIPOS_EVENTO.map(() => buckets.map(() => 0))
    const totales = TIPOS_EVENTO.map(() => 0)
    const robotsCont = new Map<string, number>()
    const proyectosCont = new Map<string, number>()
    for (const fila of eventosRango ?? []) {
      const serieIndex = TIPOS_EVENTO.findIndex((tipo) => tipo.tipo === fila.tipo)
      if (serieIndex < 0) continue
      totales[serieIndex] += 1
      const i = idx.get(fila.creado_at.slice(0, granularidad === 'hora' ? 13 : 10))
      if (i !== undefined) series[serieIndex][i] += 1
      robotsCont.set(fila.serial, (robotsCont.get(fila.serial) ?? 0) + 1)
      const clave = fila.project_id ?? 'sin'
      proyectosCont.set(clave, (proyectosCont.get(clave) ?? 0) + 1)
    }
    const ordenar = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
    return {
      buckets,
      series,
      totales,
      totalInteracciones: totales.reduce((total, cantidad) => total + cantidad, 0),
      porRobot: ordenar(robotsCont),
      porProyecto: ordenar(proyectosCont),
    }
  }, [eventosRango, desde, hasta, granularidad])

  /** El reporte se desglosa en un solo nivel, según lo que esté en "Todos" */
  function armarGrupos(): GrupoDist[] {
    const filas = respuestasQuiz ?? []
    if (robot !== 'todos' && proyecto !== 'todos') return [{ titulo: '', preguntas: contarPreguntas(filas) }]
    if (!verRobots && proyecto !== 'todos') return [{ titulo: '', preguntas: contarPreguntas(filas) }]
    if (proyecto !== 'todos') {
      // un proyecto, todos los robots: un bloque por robot
      return porRobot.map(([serial, total]) => ({
        titulo: nombreRobot(serial),
        detalle: `${total.toLocaleString('es-CO')} interacciones`,
        preguntas: contarPreguntas(filas.filter((f) => f.serial === serial)),
      }))
    }
    // todos los proyectos (con un robot o con todos): un bloque por proyecto
    return porProyecto.map(([id, total]) => ({
      titulo: nombreProyecto(id === 'sin' ? null : id),
      detalle: `${total.toLocaleString('es-CO')} interacciones`,
      preguntas: contarPreguntas(filas.filter((f) => (f.project_id ?? 'sin') === id)),
    }))
  }

  function descargarReporte() {
    void generarReportePdf({
      robotLabel: robot === 'todos' ? robot : nombreRobot(robot),
      ocultarRobot: !verRobots,
      proyectoLabel: proyecto === 'todos' ? proyecto : nombreProyecto(proyecto === 'sin' ? null : proyecto),
      tablaRobots:
        verRobots && robot === 'todos' && proyecto === 'todos'
          ? porRobot.map(([serial, total]) => ({ nombre: nombreRobot(serial), total }))
          : undefined,
      desde,
      hasta,
      granularidad,
      tipos: TIPOS_EVENTO.map((t, i) => ({ nombre: t.nombre, color: t.color, valor: totales[i], serie: series[i] })),
      buckets,
      etiquetaBucket: (b) => etiquetaBucket(b, granularidad),
      grupos: armarGrupos(),
    })
  }

  return (
    // Mismos márgenes que Robots y Proyectos.
    // overflow-x-hidden: si algo llegara a ser más ancho que la pantalla, la
    // página no se desliza de lado (la gráfica y la tabla tienen su propio scroll)
    <div className="overflow-x-hidden px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Interacciones</h2>
      <p className="mt-2 text-slate-600">
        Análisis del volumen de interacciones por fecha, robot y proyecto.
      </p>

      {/* Filtros en tarjetas: Período (hora de inicio y de fin), Proyecto y Robot */}
      <div className={`mt-6 grid gap-3 md:mt-8 ${verRobots ? 'lg:grid-cols-[1.7fr_1fr_1fr]' : 'lg:grid-cols-[1.7fr_1fr]'}`}>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">Período</p>
          <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500">
              Inicio
              <input
                type="datetime-local"
                value={desde}
                max={hasta}
                onChange={(e) => setDesde(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-slate-800 focus:outline-none max-sm:appearance-none"
              />
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-500">
              Fin
              <input
                type="datetime-local"
                value={hasta}
                min={desde}
                onChange={(e) => setHasta(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-slate-800 focus:outline-none max-sm:appearance-none"
              />
            </label>
          </div>
        </div>
        <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">Proyecto</span>
          <select
            value={proyecto}
            onChange={(e) => setProyecto(e.target.value)}
            className="mt-1 block w-full bg-transparent text-slate-800 focus:outline-none"
          >
            <option value="todos">Todos los proyectos</option>
            {(proyectos ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
            <option value="sin">Sin proyecto</option>
          </select>
        </label>
        {verRobots && (
        <label className="block rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <span className="text-[0.6875rem] font-semibold uppercase tracking-wide text-slate-400">Robot</span>
          <select
            value={robot}
            onChange={(e) => setRobot(e.target.value)}
            className="mt-1 block w-full bg-transparent text-slate-800 focus:outline-none"
          >
            <option value="todos">Todos los robots</option>
            {(robots ?? []).map((r) => (
              <option key={r.serial} value={r.serial}>
                {r.nombre || r.serial}
              </option>
            ))}
          </select>
        </label>
        )}
      </div>

      {/* Gráfica: cuadros de colores pegados a la esquina (estilo Search Console);
          la casilla de cada cuadro muestra u oculta su línea */}
      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:mt-8">
        <div className="flex flex-wrap">
          {TIPOS_EVENTO.map((tipo, index) => {
            const visible = !ocultas.has(tipo.tipo)
            return (
              <button
                key={tipo.tipo}
                type="button"
                onClick={() => alternarSerie(tipo.tipo)}
                aria-pressed={visible}
                className={`relative flex basis-1/2 flex-col items-start px-4 pb-3 pt-3 text-left transition-colors sm:w-48 sm:basis-auto ${
                  visible ? 'text-white' : 'border-b border-r border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                style={visible ? { backgroundColor: tipo.color } : undefined}
              >
                <span className="flex w-full min-w-0 items-center gap-2 text-sm">
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[2px] border-[1.5px] ${
                      visible ? 'border-white' : 'border-slate-400'
                    }`}
                  >
                    {visible && (
                      <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className="truncate">{tipo.nombre}</span>
                </span>
                <span
                  className={`mt-1 text-3xl ${visible ? '' : 'text-slate-800'}`}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {isLoading ? '—' : (totales[index] ?? 0).toLocaleString('es-CO')}
                </span>
                {/* Ayuda: aparece al instante al pasar el cursor sobre el ícono (no sobre todo el cuadro).
                    Se ancla al cuadro, no al ícono: en los de la orilla izquierda abre hacia
                    la derecha para que la tarjeta no la corte. */}
                <span
                  className={`peer/ayuda absolute bottom-2.5 right-3 ${visible ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-label={tipo.ayuda}>
                    <circle cx="10" cy="10" r="7.5" />
                    <path d="M8 8a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.2v.5" strokeLinecap="round" />
                    <circle cx="10" cy="14" r="0.5" fill="currentColor" />
                  </svg>
                </span>
                <span
                  role="tooltip"
                  className={`pointer-events-none invisible absolute top-full z-20 mt-1 w-44 rounded-lg bg-slate-800 px-3 py-2 text-xs font-normal leading-snug text-white opacity-0 shadow-lg transition-opacity peer-hover/ayuda:visible peer-hover/ayuda:opacity-100 sm:w-56 ${
                    index === 0 ? 'left-2' : index % 2 === 0 ? 'left-2 sm:left-auto sm:right-2' : 'right-2'
                  }`}
                >
                  {tipo.ayuda}
                </span>
              </button>
            )
          })}
        </div>

        <div className="px-4 pb-4 md:px-6">
          {isLoading ? (
            <Cargando texto="Cargando eventos…" className="py-16" />
          ) : totalInteracciones === 0 ? (
            <p className="py-16 text-center text-slate-400">
              Sin eventos en este rango. Los robots registran toques automáticamente.
            </p>
          ) : (
            <GraficaLineas
              buckets={buckets}
              granularidad={granularidad}
              series={TIPOS_EVENTO.flatMap((tipo, index) =>
                ocultas.has(tipo.tipo)
                  ? []
                  : [{ valores: series[index], color: tipo.color, nombre: tipo.nombre }]
              )}
            />
          )}

          {/* Reporte PDF con la gráfica, los totales y las respuestas del rango */}
          <div className="mt-4 flex justify-end">
            <button
              onClick={descargarReporte}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Exportar PDF
            </button>
          </div>
        </div>
      </div>

      {/* Por robot / Por proyecto: cada bloque se muestra solo mientras su filtro está en "Todos" */}
      {!isLoading && totalInteracciones > 0 && ((verRobots && robot === 'todos') || proyecto === 'todos') && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {verRobots && robot === 'todos' && (
            <TarjetaBarras
              titulo="Por robot"
              color="#9333ea"
              filas={porRobot.map(([serial, total]) => ({ clave: serial, nombre: nombreRobot(serial), total }))}
            />
          )}
          {proyecto === 'todos' && (
            <TarjetaBarras
              titulo="Por proyecto"
              color="#f4846b"
              filas={porProyecto.map(([id, total]) => ({
                clave: id,
                nombre: nombreProyecto(id === 'sin' ? null : id),
                total,
              }))}
            />
          )}
        </div>
      )}

      {/* Detalle de cada evento individual */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <h3 className="font-semibold text-slate-900">
          Detalle de interacciones{' '}
          <span className="font-normal text-slate-400">
            ({(detalle?.total ?? 0).toLocaleString('es-CO')})
          </span>
        </h3>
        <p className="text-sm text-slate-500">Cada toque individual con su fecha y hora exacta.</p>

        {/* 7 columnas no caben en un teléfono: la tabla se desliza de lado */}
        <div className="mt-4 max-h-96 overflow-auto rounded-lg border border-slate-100">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Evento</th>
                {verRobots && <th className="px-4 py-2 font-medium">Robot</th>}
                <th className="px-4 py-2 font-medium">Proyecto</th>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Hora</th>
                <th className="px-4 py-2 font-medium">Seg. del video</th>
                <th className="px-4 py-2 font-medium">Pregunta</th>
                <th className="px-4 py-2 font-medium">Respuesta</th>
              </tr>
            </thead>
            <tbody>
              {(detalle?.eventos ?? []).map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-indigo-50/40">
                  <td className="flex items-center gap-2 px-4 py-2 text-slate-800">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          TIPOS_EVENTO.find((tipo) => tipo.tipo === e.tipo)?.color ?? COLOR_TOQUE,
                      }}
                    />
                    {NOMBRE_TIPO[e.tipo] ?? e.tipo}
                  </td>
                  {verRobots && <td className="px-4 py-2 text-slate-600">{nombreRobot(e.serial)}</td>}
                  <td className="px-4 py-2 text-slate-600">{nombreProyecto(e.project_id)}</td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.creado_at.slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.creado_at.slice(11, 19)}
                  </td>
                  <td className="px-4 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {e.video_seg != null ? `${e.video_seg.toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-700">{e.pregunta || '—'}</td>
                  <td className="px-4 py-2 font-medium text-slate-800">{e.respuesta || '—'}</td>
                </tr>
              ))}
              {(detalle?.eventos ?? []).length === 0 && (
                <tr>
                  <td colSpan={verRobots ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                    Sin eventos en este rango.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación: 100 filas por página, cargadas del servidor */}
        {(detalle?.total ?? 0) > FILAS_POR_PAGINA && (
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando {(pagina * FILAS_POR_PAGINA + 1).toLocaleString('es-CO')}–
              {Math.min((pagina + 1) * FILAS_POR_PAGINA, detalle!.total).toLocaleString('es-CO')} de{' '}
              {detalle!.total.toLocaleString('es-CO')}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => p - 1)}
                disabled={pagina === 0}
                className="rounded-lg border border-slate-300 px-4 py-2 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina((p) => p + 1)}
                disabled={(pagina + 1) * FILAS_POR_PAGINA >= detalle!.total}
                className="rounded-lg border border-slate-300 px-4 py-2 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}

        {/* Exportar todo el rango filtrado como CSV */}
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => exportarCsv(detalle?.total ?? 0)}
            disabled={exportando || (detalle?.total ?? 0) === 0}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-indigo-600 transition-colors hover:bg-indigo-50 disabled:opacity-40"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exportando
              ? 'Exportando...'
              : `Exportar CSV (${(detalle?.total ?? 0).toLocaleString('es-CO')})`}
          </button>
        </div>
      </div>

    </div>
  )
}

/* ───────────── Barras horizontales por robot / proyecto ───────────── */

function TarjetaBarras({
  titulo,
  color,
  filas,
}: {
  titulo: string
  color: string
  filas: { clave: string; nombre: string; total: number }[]
}) {
  const maximo = Math.max(1, ...filas.map((f) => f.total))
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
      <h3 className="font-semibold text-slate-900">{titulo}</h3>
      <div className="mt-4 max-h-72 space-y-4 overflow-y-auto pr-1">
        {filas.map((f) => (
          <div key={f.clave}>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-slate-600">{f.nombre}</span>
              <span className="font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {f.total.toLocaleString('es-CO')}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full" style={{ width: `${(f.total / maximo) * 100}%`, backgroundColor: color }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────── Gráfica de líneas suaves con brillo + franja y tooltip ───────────── */

const ANCHO = 900
const ALTO = 320
const M = { top: 24, right: 24, bottom: 36, left: 44 }

function GraficaLineas({
  buckets,
  granularidad,
  series,
}: {
  buckets: string[]
  granularidad: Granularidad
  series: { valores: number[]; color: string; nombre: string }[]
}) {
  const [hover, setHover] = useState<number | null>(null)
  const idBase = useId().replace(/:/g, '')

  const plotW = ANCHO - M.left - M.right
  const plotH = ALTO - M.top - M.bottom
  const maxDatos = Math.max(1, ...series.flatMap((serie) => serie.valores))
  const paso = pasoRedondo(maxDatos / 5)
  const maxY = Math.ceil(maxDatos / paso) * paso
  const ticksY = Array.from({ length: maxY / paso + 1 }, (_, i) => i * paso)
  const x = (i: number) =>
    M.left + (buckets.length === 1 ? plotW / 2 : (i / (buckets.length - 1)) * plotW)
  const y = (v: number) => M.top + plotH - (v / maxY) * plotH
  const pasoX = Math.max(1, Math.ceil(buckets.length / 12))

  // Franja del punto señalado: el ancho de una columna, sin pasar de 56px
  const anchoColumna = buckets.length > 1 ? plotW / (buckets.length - 1) : plotW
  const anchoFranja = Math.max(10, Math.min(56, anchoColumna * 0.9))
  const colorFranja = series[0]?.color ?? INK_MUTED

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ANCHO
    const i = Math.round(((px - M.left) / plotW) * (buckets.length - 1))
    setHover(Math.max(0, Math.min(buckets.length - 1, i)))
  }

  // Tooltip sobre el punto más alto; si queda muy arriba, va debajo
  const yTooltip = hover === null ? 0 : y(Math.max(0, ...series.map((serie) => serie.valores[hover])))
  const tooltipAbajo = yTooltip < ALTO * 0.45

  return (
    // En teléfono la gráfica mantiene un ancho mínimo legible y se desliza de
    // lado; el detalle aparece al tocar un punto (y se queda hasta tocar otro)
    <div className="mt-4 overflow-x-auto">
      <div className="relative min-w-[640px]">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="w-full touch-pan-x"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={(e) => {
            if (e.pointerType === 'mouse') setHover(null)
          }}
        >
          <defs>
            {/* brillo suave del mismo color debajo de cada línea */}
            {series.map((serie, i) => (
              <filter key={serie.nombre} id={`${idBase}-brillo-${i}`} x="-10%" y="-30%" width="120%" height="160%">
                <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={serie.color} floodOpacity="0.35" />
              </filter>
            ))}
            {/* franja del punto señalado: color abajo, se desvanece hacia arriba */}
            <linearGradient id={`${idBase}-franja`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor={colorFranja} stopOpacity="0.18" />
              <stop offset="100%" stopColor={colorFranja} stopOpacity="0" />
            </linearGradient>
            <filter id={`${idBase}-punto`} x="-100%" y="-100%" width="300%" height="300%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#0f172a" floodOpacity="0.25" />
            </filter>
          </defs>

          {/* líneas verticales muy tenues en cada etiqueta del eje x */}
          {buckets.map((b, i) =>
            i % pasoX === 0 ? (
              <line key={b} x1={x(i)} x2={x(i)} y1={M.top} y2={M.top + plotH} stroke={GRID} strokeWidth="1" />
            ) : null
          )}

          {/* franja del punto señalado */}
          {hover !== null && (
            <rect
              x={x(hover) - anchoFranja / 2}
              y={M.top - 8}
              width={anchoFranja}
              height={plotH + 8}
              rx={Math.min(14, anchoFranja / 2)}
              fill={`url(#${idBase}-franja)`}
            />
          )}

          {/* eje Y */}
          {ticksY.map((t) => (
            <text key={t} x={M.left - 14} y={y(t) + 4} textAnchor="end" fontSize="12" fill={INK_MUTED}>
              {t.toLocaleString('es-CO')}
            </text>
          ))}

          {/* eje X */}
          {buckets.map((b, i) =>
            i % pasoX === 0 ? (
              <text key={b} x={x(i)} y={ALTO - 10} textAnchor="middle" fontSize="12" fill={INK_MUTED}>
                {etiquetaBucket(b, granularidad)}
              </text>
            ) : null
          )}

          {/* líneas: gruesas, suaves y con brillo */}
          {series.map((serie, i) => (
            <path
              key={serie.nombre}
              d={curvaSuave(serie.valores.map((v, j) => [x(j), y(v)]))}
              fill="none"
              stroke={serie.color}
              strokeWidth="1"
              strokeLinejoin="round"
              strokeLinecap="round"
              filter={`url(#${idBase}-brillo-${i})`}
            />
          ))}

          {/* puntos en la posición señalada */}
          {hover !== null &&
            series.map((serie) => (
              <circle
                key={serie.nombre}
                cx={x(hover)}
                cy={y(serie.valores[hover])}
                r="7"
                fill={serie.color}
                stroke="#ffffff"
                strokeWidth="3"
                filter={`url(#${idBase}-punto)`}
              />
            ))}
        </svg>

        {/* tooltip: tarjeta pequeña blanca sobre el punto */}
        {hover !== null && series.length > 0 && (
          <div
            className="pointer-events-none absolute z-10 rounded-xl bg-white px-3 py-2 shadow-[0_6px_20px_rgba(15,23,42,0.12)]"
            style={{
              left: `${(x(hover) / ANCHO) * 100}%`,
              top: `${(yTooltip / ALTO) * 100}%`,
              transform: tooltipAbajo ? 'translate(-50%, 18px)' : 'translate(-50%, calc(-100% - 18px))',
            }}
          >
            <p className="whitespace-nowrap text-[0.6875rem] text-slate-400">
              {etiquetaLarga(buckets[hover], granularidad)}
            </p>
            {series.map((serie) => (
              <p key={serie.nombre} className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-500">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: serie.color }} />
                {serie.nombre}
                <span className="ml-auto pl-2 font-bold text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {serie.valores[hover].toLocaleString('es-CO')}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
