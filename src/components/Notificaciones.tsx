import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { IconoCampana } from './iconos'
import { detalleLegible } from '../lib/actividad'

/** Fila de la tabla actividad (ver supabase/roles.sql) */
interface Actividad {
  id: number
  actor_id: string | null
  actor_nombre: string
  accion: string
  texto: string
  objetivo: string | null
  detalle: { secciones?: string[]; ruta?: string[]; nombre_anterior?: string | null }
  creado_at: string
  leida: boolean
  /** quitada del popup con la ✕ (sigue en el historial) */
  oculta: boolean
}

function haceCuanto(iso: string): string {
  const seg = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seg < 60) return 'hace un momento'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  return dias === 1 ? 'ayer' : `hace ${dias} días`
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

/**
 * Campana del super administrador: lo que hacen los administradores, en vivo.
 * Arriba las nuevas (✓ las pasa a previas, ✕ las quita); abajo las previas,
 * ya leídas, con "Limpiar todo".
 */
export function Notificaciones({ oscuro = false }: { oscuro?: boolean }) {
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  /** notificaciones con la línea de cambios desplegada completa */
  const [desplegadas, setDesplegadas] = useState<Set<number>>(() => new Set())
  const caja = useRef<HTMLDivElement>(null)
  // El panel monta una campana en la barra del teléfono y otra en computador:
  // cada una con su propio canal en vivo
  const canalId = useRef(`actividad-admins-${Math.random().toString(36).slice(2)}`)

  const { data: actividad } = useQuery({
    queryKey: ['actividad'],
    queryFn: async (): Promise<Actividad[]> => {
      const { data, error } = await supabase
        .from('actividad')
        .select('*')
        .eq('oculta', false)
        .order('creado_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as Actividad[]
    },
    // Respaldo por si se cae el canal en vivo
    refetchInterval: 60_000,
  })

  // En vivo: cada acción nueva de un admin refresca la lista
  useEffect(() => {
    const canal = supabase
      .channel(canalId.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['actividad'] })
      })
      .subscribe()
    return () => {
      void supabase.removeChannel(canal)
    }
  }, [queryClient])

  // Clic afuera o Esc cierran la lista
  useEffect(() => {
    if (!abierto) return
    const clic = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('mousedown', clic)
    window.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', clic)
      window.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  const lista = useMemo(() => actividad ?? [], [actividad])
  const noLeidas = lista.filter((a) => !a.leida).length
  // Cada acción es una notificación independiente
  const nuevas = useMemo(() => lista.filter((a) => !a.leida), [lista])
  const previas = useMemo(() => lista.filter((a) => a.leida), [lista])

  /** Cambia filas en la base y en pantalla al instante (sin esperar respuesta) */
  async function actualizar(ids: number[], cambios: Partial<Pick<Actividad, 'leida' | 'oculta'>>) {
    if (ids.length === 0) return
    queryClient.setQueryData<Actividad[]>(['actividad'], (actual) =>
      actual
        ?.map((a) => (ids.includes(a.id) ? { ...a, ...cambios } : a))
        .filter((a) => !a.oculta)
    )
    await supabase.from('actividad').update(cambios).in('id', ids)
  }

  /** Una notificación */
  const fila = (principal: Actividad, leida: boolean) => {
    const ids = [principal.id]
    const detalle = detalleLegible(principal)
    return (
      <div
        key={principal.id}
        // Tocar la notificación muestra completa la línea de cambios; otro toque la corta
        onClick={() =>
          detalle &&
          setDesplegadas((actual) => {
            const nuevo = new Set(actual)
            if (nuevo.has(principal.id)) nuevo.delete(principal.id)
            else nuevo.add(principal.id)
            return nuevo
          })
        }
        className={`group flex gap-3 px-4 py-3 transition-colors hover:bg-slate-50 ${detalle ? 'cursor-pointer' : ''}`}
      >
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            leida ? 'bg-amber-300' : 'bg-amber-500'
          }`}
        >
          {iniciales(principal.actor_nombre)}
        </div>
        <div className="min-w-0 flex-1 text-sm">
          <p className={leida ? 'text-slate-500' : 'text-slate-700'}>
            <span className={`font-semibold ${leida ? 'text-slate-600' : 'text-slate-900'}`}>{principal.actor_nombre}</span>{' '}
            {principal.texto}
          </p>
          {detalle && (
            <p className={`mt-0.5 text-xs text-slate-500 ${desplegadas.has(principal.id) ? 'break-words' : 'truncate'}`}>
              {detalle}
            </p>
          )}
          <p className="mt-0.5 text-xs text-slate-400">{haceCuanto(principal.creado_at)}</p>
        </div>
        <div className="flex shrink-0 items-start gap-1">
          {leida ? (
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-white"
              aria-label="Leída"
              title="Leída"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 10l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                void actualizar(ids, { leida: true })
              }}
              aria-label="Marcar como leída"
              title="Marcar como leída"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 text-slate-500 transition-colors hover:border-slate-800 hover:bg-slate-800 hover:text-white"
            >
              <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 10l3.5 3.5L15 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              void actualizar(ids, { oculta: true, leida: true })
            }}
            aria-label="Quitar notificación"
            title="Quitar"
            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label={noLeidas ? `Notificaciones: ${noLeidas} sin leer` : 'Notificaciones'}
        className={`relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
          oscuro ? 'text-slate-200 hover:bg-slate-700' : 'border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
        }`}
      >
        <IconoCampana />
        {noLeidas > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[0.6875rem] font-bold text-white">
            {noLeidas > 99 ? '99+' : noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-12 z-50 flex max-h-[70vh] w-[24rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <p className="text-lg font-medium text-slate-900">Notificaciones</p>
            {noLeidas > 0 && (
              <button
                onClick={() => void actualizar(lista.filter((a) => !a.leida).map((a) => a.id), { leida: true })}
                className="text-xs font-semibold text-[#2A4470] hover:underline"
              >
                Marcar todo como leído
              </button>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {nuevas.length === 0 && (
              <p className={`px-4 text-center text-sm text-slate-400 ${lista.length === 0 ? 'py-10' : 'py-6'}`}>
                No tienes notificaciones nuevas.
              </p>
            )}
            {nuevas.map((g) => fila(g, false))}

            {previas.length > 0 && (
              <>
                {/* Fondo blanco (no gris) solo para que, fija al desplazar, no se transparente */}
                <div className="sticky top-0 flex items-center gap-3 bg-white px-4 py-2">
                  <p className="shrink-0 text-xs font-bold uppercase tracking-wide text-slate-300">Notificaciones previas</p>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <button
                    onClick={() => void actualizar(lista.filter((a) => a.leida).map((a) => a.id), { oculta: true })}
                    className="flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-300 hover:text-slate-600"
                  >
                    <svg viewBox="0 0 20 20" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                    Limpiar todo
                  </button>
                </div>
                {previas.map((g) => fila(g, true))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
