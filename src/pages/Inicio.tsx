import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { nombreRol, type Rol } from '../lib/perfil'
import { detalleLegible, type DetalleActividad } from '../lib/actividad'
import { porcentajeProgreso, puntosProgreso } from '../lib/progreso'
import { ahoraLocal, curvaSuave, generarBuckets, inicioDeMes, pasoRedondo } from '../lib/graficas'
import type { EventConfig } from '../types/config'
import { IconoCarpeta } from '../components/iconos'
import robotPng from '../assets/icons/robot.png'

/**
 * Inicio (solo super administrador): resumen de todo el panel.
 * Fila 1: proyectos en carrusel. Fila 2: interacciones, últimas llamadas y
 * robots. Fila 3: miembros, actividad de los administradores y uso.
 * No necesita nada nuevo en la base: todo sale de tablas que ya existen.
 */

const PATRON_SERIAL_REAL = '_'.repeat(11)
/** el panel avisa cada 10 s: sin aviso en 20 s, la persona ya no está */
const EN_LINEA_MS = 20_000
/** el robot reporta cada pocos segundos: sin reporte en 6 s está desconectado */
const ROBOT_EN_LINEA_MS = 6_000

/** color de cada tarjeta de proyecto, en orden */
const ACENTOS = ['#F7A325', '#A42BD9', '#26B5A0', '#3B82F6', '#E9467A']
const COLOR_LINEA = '#EF5B5B'
const INK_MUTED = '#a3a3b5'
const GRID = '#f1f1f4'

interface Proyecto {
  id: string
  nombre: string
  config: EventConfig | null
  updated_at: string
}

interface Actividad {
  actor_nombre: string
  texto: string
  objetivo: string | null
  detalle: DetalleActividad | null
  creado_at: string
}

interface Usuario {
  user_id: string
  nombre: string
  rol: Rol
  ultimo_ingreso: string | null
  visto_at: string | null
}

interface EstadoRobot {
  serial: string
  nombre: string | null
  updated_at: string
}

function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  )
}

function haceCuanto(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('es-CO', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`
}

/** Tarjeta blanca base de todo el tablero */
function Tarjeta({
  titulo,
  verTodo,
  accion,
  children,
  className = '',
}: {
  titulo?: string
  verTodo?: string
  accion?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ${className}`}>
      {(titulo || verTodo || accion) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {titulo && <h3 className="text-lg font-bold text-slate-900">{titulo}</h3>}
          {verTodo && (
            <Link to={verTodo} className="text-sm font-semibold text-[#2A4470] hover:underline">
              Ver todo
            </Link>
          )}
          {accion}
        </div>
      )}
      {children}
    </section>
  )
}

/** Círculos con iniciales superpuestos (+N si son más de 4) */
function Avatares({ nombres }: { nombres: string[] }) {
  if (nombres.length === 0) return <span className="text-xs text-slate-400">Sin aportes registrados</span>
  const visibles = nombres.slice(0, 4)
  return (
    <div className="flex items-center">
      {visibles.map((n, i) => (
        <span
          key={n}
          title={n}
          className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[0.625rem] font-semibold text-slate-600 first:ml-0"
          style={{ zIndex: visibles.length - i }}
        >
          {iniciales(n)}
        </span>
      ))}
      {nombres.length > 4 && (
        <span className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[0.625rem] font-semibold text-slate-600">
          +{nombres.length - 4}
        </span>
      )}
    </div>
  )
}

export function Inicio() {
  // ── Datos ──
  const { data: proyectos } = useQuery({
    queryKey: ['projects', 'inicio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nombre, config, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Proyecto[]
    },
  })

  const { data: robotsFijados } = useQuery({
    queryKey: ['robots', 'inicio'],
    queryFn: async () => {
      const { data, error } = await supabase.from('robots').select('serial, project_id')
      if (error) throw error
      return data as { serial: string; project_id: string | null }[]
    },
  })

  const { data: estados } = useQuery({
    queryKey: ['robot-status', 'inicio'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robot_status')
        .select('serial, nombre, updated_at')
        .order('nombre', { ascending: true, nullsFirst: false })
        .order('serial', { ascending: true })
      if (error) throw error
      return data as EstadoRobot[]
    },
    refetchInterval: 5_000,
  })

  // Actividad de proyectos (solo la de administradores: así la guarda la base)
  const { data: actividad } = useQuery({
    queryKey: ['actividad', 'inicio-proyectos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actividad')
        .select('actor_nombre, texto, objetivo, detalle, creado_at')
        .eq('accion', 'proyecto')
        .order('creado_at', { ascending: false })
      if (error) throw error
      return data as Actividad[]
    },
  })

  const { data: llamadas } = useQuery({
    queryKey: ['actividad', 'inicio-llamadas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actividad')
        .select('actor_nombre, texto, objetivo, detalle, creado_at')
        .eq('accion', 'orden')
        .like('texto', 'abrió una videollamada%')
        .order('creado_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data as Actividad[]
    },
  })

  const { data: usuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_usuarios')
      if (error) throw error
      return data as Usuario[]
    },
    refetchInterval: 10_000,
  })

  const { data: registros } = useQuery({
    queryKey: ['contactos', 'inicio-conteos'],
    queryFn: async () => {
      const contar = async (origen: 'registro' | 'foto') => {
        const { count, error } = await supabase
          .from('contactos')
          .select('id', { count: 'exact', head: true })
          .eq('origen', origen)
        if (error) throw error
        return count ?? 0
      }
      const [registro, foto] = await Promise.all([contar('registro'), contar('foto')])
      return { registro, foto }
    },
  })

  // Tamaño de media: cada proyecto guarda sus archivos en su propia carpeta
  const { data: bytesMedia } = useQuery({
    queryKey: ['media', 'tamano'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const listar = async (carpeta: string) => {
        const items: { name: string; id: string | null; metadata: { size?: number } | null }[] = []
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.storage.from('media').list(carpeta, { limit: 1000, offset })
          if (error) throw error
          items.push(...(data ?? []))
          if (!data || data.length < 1000) break
        }
        return items
      }
      let total = 0
      const raiz = await listar('')
      // id null = carpeta; con id = archivo suelto en la raíz
      for (const item of raiz) if (item.id) total += item.metadata?.size ?? 0
      const carpetas = raiz.filter((i) => !i.id).map((i) => i.name)
      const contenidos = await Promise.all(carpetas.map(listar))
      for (const lista of contenidos) for (const f of lista) total += f.metadata?.size ?? 0
      return total
    },
  })

  // ── Derivados ──
  const aportes = useMemo(() => {
    const mapa = new Map<string, Set<string>>()
    for (const a of actividad ?? []) {
      if (!a.objetivo) continue
      if (!mapa.has(a.objetivo)) mapa.set(a.objetivo, new Set())
      mapa.get(a.objetivo)!.add(a.actor_nombre)
    }
    return mapa
  }, [actividad])

  const robotsPorProyecto = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const r of robotsFijados ?? []) {
      if (r.project_id) mapa.set(r.project_id, (mapa.get(r.project_id) ?? 0) + 1)
    }
    return mapa
  }, [robotsFijados])

  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const miembros = useMemo(
    () =>
      [...(usuarios ?? [])]
        .sort((a, b) => (b.visto_at ?? b.ultimo_ingreso ?? '').localeCompare(a.visto_at ?? a.ultimo_ingreso ?? ''))
        .slice(0, 4),
    [usuarios]
  )

  return (
    <div className="px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Inicio</h2>
      <p className="mt-2 text-slate-600">Resumen general</p>

      {/* ── Fila 1: proyectos ── */}
      <CarruselProyectos>
        {(proyectos ?? []).map((p, i) => {
          const color = ACENTOS[i % ACENTOS.length]
          const robots = robotsPorProyecto.get(p.id) ?? 0
          const puntos = puntosProgreso(p.config, robots > 0)
          const porcentaje = porcentajeProgreso(puntos)
          const faltan = puntos.filter((x) => !x.hecho)
          return (
            <section
              key={p.id}
              className="w-[85%] shrink-0 snap-start rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(15,23,42,0.06)] sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
            >
              <div className="flex items-start gap-3">
                {/* Mismo ícono de proyecto (el del menú) para todos; solo cambia el color */}
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: color }}
                >
                  <IconoCarpeta className="h-5 w-5 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-slate-900">{p.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {robots === 0 ? 'Sin robot' : robots === 1 ? '1 robot' : `${robots} robots`}
                  </p>
                </div>
                <Link
                  to={`/editor/${p.id}`}
                  aria-label={`Abrir ${p.nombre}`}
                  title="Abrir proyecto"
                  className="-mr-1 rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
                    <circle cx="5" cy="12" r="1.6" />
                    <circle cx="12" cy="12" r="1.6" />
                    <circle cx="19" cy="12" r="1.6" />
                  </svg>
                </Link>
              </div>

              <div className="mt-4">
                <Avatares nombres={[...(aportes.get(p.nombre) ?? [])]} />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">Progreso</span>
                <span
                  className="font-semibold text-slate-800"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                  title={
                    faltan.length
                      ? 'Falta: ' +
                        faltan.map((x) => (x.usado ? x.nombre : `${x.nombre} (no usado)`)).join(', ')
                      : 'Completo'
                  }
                >
                  {porcentaje}%
                </span>
              </div>
              {/* barra rayada, como la referencia */}
              <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: `${color}26` }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${porcentaje}%`,
                    backgroundImage: `repeating-linear-gradient(-45deg, ${color} 0 6px, ${color}b3 6px 12px)`,
                  }}
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                  {haceCuanto(p.updated_at)}
                </span>
              </div>
            </section>
          )
        })}
      </CarruselProyectos>

      {/* ── Fila 2 ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
        <Interacciones className="md:col-span-2 xl:col-span-5" />

        <Tarjeta titulo="Últimas llamadas" className="xl:col-span-4">
          {(llamadas ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">Aún no hay llamadas de administradores.</p>
          )}
          <div className="space-y-3">
            {(llamadas ?? []).map((l) => {
              const fecha = new Date(l.creado_at)
              return (
                <div key={l.creado_at} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 text-indigo-700" fill="currentColor" aria-hidden="true">
                    <path d="M3 7a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm14 3.5 4-2.5v8l-4-2.5z" />
                  </svg>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{l.objetivo ?? 'Robot'}</p>
                    <p className="truncate text-xs text-slate-500">
                      {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })} ({l.actor_nombre})
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-fuchsia-700">
                    {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Robots" verTodo="/robots" className="xl:col-span-3">
          <div className="space-y-4">
            {(estados ?? []).map((r) => {
              const enLinea = ahora - new Date(r.updated_at).getTime() <= ROBOT_EN_LINEA_MS
              return (
                <div key={r.serial} className="flex items-center gap-3">
                  <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <img src={robotPng} alt="" className={`h-7 w-auto object-contain ${enLinea ? '' : 'opacity-50'}`} />
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white"
                      style={{ backgroundColor: enLinea ? '#1baf7a' : '#c3c2b7' }}
                      title={enLinea ? 'En línea' : 'Desconectado'}
                    />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{r.nombre || 'Robot'}</p>
                    <p className="text-xs text-slate-500" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      # {r.serial}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </Tarjeta>
      </div>

      {/* ── Fila 3 ── */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-12">
        <Tarjeta titulo="Miembros" verTodo="/usuarios" className="xl:col-span-4">
          <div className="space-y-4">
            {miembros.map((u) => {
              const enLinea = u.visto_at !== null && ahora - new Date(u.visto_at).getTime() < EN_LINEA_MS
              return (
                <div key={u.user_id} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                    {iniciales(u.nombre)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{u.nombre}</p>
                    <p className="text-xs text-slate-500">{nombreRol(u.rol)}</p>
                  </div>
                  <span className={`shrink-0 text-xs ${enLinea ? 'font-semibold text-emerald-600' : 'text-slate-400'}`}>
                    {enLinea ? 'En línea' : haceCuanto(u.visto_at ?? u.ultimo_ingreso)}
                  </span>
                </div>
              )
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Actividad de administradores" className="xl:col-span-5">
          {(actividad ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-slate-400">Aún no hay actividad de administradores.</p>
          )}
          <div className="space-y-3">
            {(actividad ?? []).slice(0, 3).map((a, i) => {
              const verbo = a.texto.split(' el proyecto')[0]
              const detalle = detalleLegible(a)
              const color = ['#E9467A', '#3B82F6', '#F7A325'][i]
              return (
                <div key={a.creado_at} className="flex items-center gap-3 rounded-xl border border-slate-100 px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: color }}>
                    <IconoCarpeta className="h-4 w-4 text-white" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{a.objetivo ?? 'Proyecto'}</p>
                    <p className="truncate text-xs text-slate-500" title={detalle ?? undefined}>
                      {verbo.charAt(0).toUpperCase() + verbo.slice(1)}
                      {detalle ? ` · ${detalle}` : ''} · {haceCuanto(a.creado_at)}
                    </p>
                  </div>
                  <span
                    title={a.actor_nombre}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[0.6875rem] font-semibold text-slate-600"
                  >
                    {iniciales(a.actor_nombre)}
                  </span>
                </div>
              )
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Uso" className="xl:col-span-3">
          <div className="space-y-3">
            {[
              { nombre: 'Media', valor: bytesMedia === undefined ? '…' : tamanoLegible(bytesMedia), color: '#3B82F6', icono: 'play' },
              { nombre: 'Proyectos creados', valor: proyectos?.length ?? '…', color: '#A42BD9', icono: 'carpeta' },
              { nombre: 'Registros', valor: registros?.registro ?? '…', color: '#F7A325', icono: 'persona' },
              { nombre: 'Registros con foto', valor: registros?.foto ?? '…', color: '#26B5A0', icono: 'camara' },
            ].map((u) => (
              <div key={u.nombre} className="flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5">
                <IconoUso tipo={u.icono} color={u.color} />
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{u.nombre}</span>
                <span
                  className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                  style={{ backgroundColor: u.color, fontVariantNumeric: 'tabular-nums' }}
                >
                  {typeof u.valor === 'number' ? u.valor.toLocaleString('es-CO') : u.valor}
                </span>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>
    </div>
  )
}

/* ───────────── Carrusel de proyectos con flechas ───────────── */

function CarruselProyectos({ children }: { children: React.ReactNode }) {
  const pista = useRef<HTMLDivElement>(null)
  const [bordes, setBordes] = useState({ inicio: true, fin: true })

  // Solo cambia el estado si de verdad cambió: guardar un objeto nuevo en
  // cada medida redibujaba sin fin y no dejaba cambiar de página
  const medir = useCallback(() => {
    const el = pista.current
    if (!el) return
    const inicio = el.scrollLeft <= 4
    const fin = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
    setBordes((b) => (b.inicio === inicio && b.fin === fin ? b : { inicio, fin }))
  }, [])
  // Se vuelve a medir cuando cambia el tamaño de la pista o de su contenido
  // (al llegar los proyectos o al cambiar el ancho de la ventana)
  useEffect(() => {
    const el = pista.current
    if (!el) return
    const observador = new ResizeObserver(medir)
    observador.observe(el)
    for (const hijo of Array.from(el.children)) observador.observe(hijo)
    medir()
    return () => observador.disconnect()
  }, [medir, children])

  const mover = (dir: 1 | -1) => {
    const el = pista.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  const flecha = (dir: 1 | -1) => (
    <button
      type="button"
      onClick={() => mover(dir)}
      aria-label={dir === 1 ? 'Ver más proyectos' : 'Ver proyectos anteriores'}
      className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-slate-600 shadow-md transition-colors hover:text-slate-900 md:flex ${
        dir === 1 ? '-right-4' : '-left-4'
      }`}
    >
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
        <path d={dir === 1 ? 'M8 5l5 5-5 5' : 'M12 5l-5 5 5 5'} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )

  return (
    <div className="relative mt-6 md:mt-8">
      {!bordes.inicio && flecha(-1)}
      <div
        ref={pista}
        onScroll={medir}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      {!bordes.fin && flecha(1)}
    </div>
  )
}

/* ───────────── Iconos pequeños ───────────── */

function IconoUso({ tipo, color }: { tipo: string; color: string }) {
  const props = { viewBox: '0 0 24 24', className: 'h-4 w-4 shrink-0', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }
  if (tipo === 'play') return <svg {...props}><circle cx="12" cy="12" r="9" /><path d="M10 8.5v7l5.5-3.5z" fill={color} /></svg>
  if (tipo === 'carpeta') return <svg {...props}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
  if (tipo === 'persona') return <svg {...props}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  return <svg {...props}><path d="M3 8a2 2 0 0 1 2-2h2l2-2h6l2 2h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.5" /></svg>
}

/* ───────────── Interacciones de todos los robots ───────────── */

type Rango = 'semana' | 'mes' | 'anio' | 'todo'
const NOMBRE_RANGO: Record<Rango, string> = { semana: 'Esta semana', mes: 'Este mes', anio: 'Este año', todo: 'Todo' }

function inicioDeSemana(): string {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T00:00`
}

function Interacciones({ className = '' }: { className?: string }) {
  const [rango, setRango] = useState<Rango>('mes')
  const hasta = useMemo(() => ahoraLocal(), [])

  // "Todo" empieza en el primer evento registrado de un robot real
  const { data: primerEvento } = useQuery({
    queryKey: ['events', 'primero'],
    enabled: rango === 'todo',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('creado_at')
        .like('serial', PATRON_SERIAL_REAL)
        .order('creado_at', { ascending: true })
        .limit(1)
      if (error) throw error
      return (data?.[0]?.creado_at as string | undefined)?.slice(0, 10)
    },
  })

  const desde =
    rango === 'semana'
      ? inicioDeSemana()
      : rango === 'mes'
        ? inicioDeMes()
        : rango === 'anio'
          ? `${hasta.slice(0, 4)}-01-01T00:00`
          : `${primerEvento ?? hasta.slice(0, 10)}T00:00`
  // semana y mes: un punto por día; año y todo: un punto por mes
  const porMes = rango === 'anio' || rango === 'todo'

  const { data: filas, isLoading } = useQuery({
    queryKey: ['events-agg', desde, hasta, 'todos', 'dia'],
    enabled: rango !== 'todo' || primerEvento !== undefined,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('eventos_agrupados', {
        p_desde: `${desde}:00`,
        p_hasta: `${hasta}:59`,
        p_serial: null,
        p_gran: 'dia',
      })
      if (error) throw error
      return data as { bucket: string; tipo: string; total: number }[]
    },
  })

  const { claves, valores, total } = useMemo(() => {
    const dias = generarBuckets(desde, hasta, 'dia')
    const claves = porMes ? [...new Set(dias.map((d) => d.slice(0, 7)))] : dias
    const idx = new Map(claves.map((c, i) => [c, i]))
    const valores = claves.map(() => 0)
    let total = 0
    for (const f of filas ?? []) {
      const i = idx.get(porMes ? f.bucket.slice(0, 7) : f.bucket)
      if (i !== undefined) valores[i] += f.total
      total += f.total
    }
    return { claves, valores, total }
  }, [filas, desde, hasta, porMes])

  return (
    <Tarjeta
      className={className}
      titulo="Interacciones"
      accion={
        <div className="relative ml-auto">
          <select
            value={rango}
            onChange={(e) => setRango(e.target.value as Rango)}
            aria-label="Rango de la gráfica"
            className="appearance-none rounded-lg border border-[#A42BD9]/40 bg-white py-1.5 pl-3 pr-8 text-sm text-slate-700"
          >
            {(Object.keys(NOMBRE_RANGO) as Rango[]).map((r) => (
              <option key={r} value={r}>
                {NOMBRE_RANGO[r]}
              </option>
            ))}
          </select>
          <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" fill="currentColor" aria-hidden="true">
            <path d="M5.5 8h9L10 13z" />
          </svg>
        </div>
      }
    >
      <p className="-mt-3 mb-1 text-sm text-slate-500">
        Todos los robots ·{' '}
        <span className="font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {isLoading ? '—' : total.toLocaleString('es-CO')}
        </span>{' '}
        en total
      </p>
      {isLoading ? (
        <p className="py-16 text-center text-sm text-slate-400">Cargando…</p>
      ) : (
        <GraficaArea claves={claves} valores={valores} porMes={porMes} />
      )}
    </Tarjeta>
  )
}

const ANCHO = 560
const ALTO = 240
const M = { top: 20, right: 12, bottom: 28, left: 32 }

function etiquetaCorta(clave: string, porMes: boolean, variosAnios: boolean): string {
  if (porMes) {
    const d = new Date(clave + '-01T00:00:00')
    const mes = d.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '')
    return variosAnios ? `${mes} ${String(d.getFullYear()).slice(2)}` : mes
  }
  return new Date(clave + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '')
}

function etiquetaTooltip(clave: string, porMes: boolean): string {
  if (porMes) return new Date(clave + '-01T00:00:00').toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })
  return new Date(clave + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Una sola línea suave con área degradada, franja y tooltip oscuro (estilo de la referencia) */
function GraficaArea({ claves, valores, porMes }: { claves: string[]; valores: number[]; porMes: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const id = useId().replace(/:/g, '')

  const plotW = ANCHO - M.left - M.right
  const plotH = ALTO - M.top - M.bottom
  const maxDatos = Math.max(1, ...valores)
  const paso = pasoRedondo(maxDatos / 5)
  const maxY = Math.ceil(maxDatos / paso) * paso
  const ticksY = Array.from({ length: maxY / paso + 1 }, (_, i) => i * paso)
  const x = (i: number) => M.left + (claves.length === 1 ? plotW / 2 : (i / (claves.length - 1)) * plotW)
  const y = (v: number) => M.top + plotH - (v / maxY) * plotH
  const pasoX = Math.max(1, Math.ceil(claves.length / 7))
  const variosAnios = porMes && claves.length > 0 && claves[0].slice(0, 4) !== claves[claves.length - 1].slice(0, 4)

  const linea = curvaSuave(valores.map((v, i) => [x(i), y(v)]))
  const area = claves.length > 1 ? `${linea} L${x(claves.length - 1)},${M.top + plotH} L${x(0)},${M.top + plotH} Z` : ''
  const anchoColumna = claves.length > 1 ? plotW / (claves.length - 1) : plotW
  const anchoFranja = Math.max(8, Math.min(26, anchoColumna * 0.8))

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * ANCHO
    const i = Math.round(((px - M.left) / plotW) * (claves.length - 1))
    setHover(Math.max(0, Math.min(claves.length - 1, i)))
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${ANCHO} ${ALTO}`}
        className="w-full touch-pan-y"
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHover(null)
        }}
      >
        <defs>
          <linearGradient id={`${id}-area`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_LINEA} stopOpacity="0.22" />
            <stop offset="100%" stopColor={COLOR_LINEA} stopOpacity="0" />
          </linearGradient>
          <linearGradient id={`${id}-franja`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor={COLOR_LINEA} stopOpacity="0.35" />
            <stop offset="100%" stopColor={COLOR_LINEA} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticksY.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={ANCHO - M.right} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth="1" />
            <text x={M.left - 8} y={y(t) + 4} textAnchor="end" fontSize="10" fill={INK_MUTED}>
              {t.toLocaleString('es-CO')}
            </text>
          </g>
        ))}

        {claves.map((c, i) =>
          i % pasoX === 0 ? (
            <text
              key={c}
              x={x(i)}
              y={ALTO - 8}
              textAnchor="middle"
              fontSize="10"
              fill={hover === i ? '#0f172a' : INK_MUTED}
              fontWeight={hover === i ? 700 : 400}
            >
              {etiquetaCorta(c, porMes, variosAnios)}
            </text>
          ) : null
        )}

        {hover !== null && (
          <rect
            x={x(hover) - anchoFranja / 2}
            y={y(valores[hover])}
            width={anchoFranja}
            height={M.top + plotH - y(valores[hover])}
            rx={Math.min(8, anchoFranja / 2)}
            fill={`url(#${id}-franja)`}
          />
        )}

        {area && <path d={area} fill={`url(#${id}-area)`} />}
        <path d={linea} fill="none" stroke={COLOR_LINEA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hover !== null && (
          <circle cx={x(hover)} cy={y(valores[hover])} r="6" fill="#ffffff" stroke={COLOR_LINEA} strokeWidth="3.5" />
        )}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-md bg-slate-800 px-2.5 py-1.5 text-center shadow-lg"
          style={{
            left: `${(x(hover) / ANCHO) * 100}%`,
            top: `${(y(valores[hover]) / ALTO) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 12px))',
          }}
        >
          <p className="whitespace-nowrap text-xs font-semibold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {valores[hover].toLocaleString('es-CO')} interacciones
          </p>
          <p className="whitespace-nowrap text-[0.625rem] text-slate-300">{etiquetaTooltip(claves[hover], porMes)}</p>
        </div>
      )}
    </div>
  )
}
