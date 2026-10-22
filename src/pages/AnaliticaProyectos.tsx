import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { porcentajeProgreso, puntosProgreso } from '../lib/progreso'
import { haceCuanto } from '../lib/tiempo'
import { IconoCarpeta } from '../components/iconos'
import { Cargando } from '../components/Cargando'
import type { EventConfig } from '../types/config'

const FILAS_POR_PAGINA = 15

/** color de cada proyecto, en orden */
const ACENTOS = ['#F7A325', '#A42BD9', '#26B5A0', '#3B82F6', '#E9467A']

interface Proyecto {
  id: string
  nombre: string
  config: EventConfig | null
  updated_at: string
}

/** Analítica › Proyectos: avance y última actividad de cada proyecto */
export function AnaliticaProyectos() {
  const { data: proyectos, isLoading } = useQuery({
    queryKey: ['projects', 'analitica'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nombre, config, updated_at')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as Proyecto[]
    },
  })

  // Robots fijados por proyecto. Si el rol no puede leerlos, el avance se calcula sin ellos.
  const { data: fijados } = useQuery({
    queryKey: ['robots', 'analitica-fijados'],
    queryFn: async () => {
      const { data, error } = await supabase.from('robots').select('serial, project_id')
      if (error) return []
      return data as { serial: string; project_id: string | null }[]
    },
  })

  // Paginación en el navegador: la lista completa ya está cargada
  const [pagina, setPagina] = useState(0)
  const total = (proyectos ?? []).length
  const visibles = (proyectos ?? []).slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)

  const robotsDe = (id: string) => (fijados ?? []).filter((r) => r.project_id === id).length

  return (
    <div className="px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Proyectos</h2>
      <p className="mt-2 text-slate-600">Avance y actividad reciente de los proyectos.</p>

      {isLoading ? (
        <Cargando texto="Cargando proyectos…" className="py-16" />
      ) : (
        <>
          <p className="mt-6 text-sm text-slate-500">
            {(proyectos ?? []).length} {(proyectos ?? []).length === 1 ? 'proyecto' : 'proyectos'}
          </p>
          <div className="mt-3 space-y-4">
            {visibles.map((p, k) => {
              const i = pagina * FILAS_POR_PAGINA + k
              const color = ACENTOS[i % ACENTOS.length]
              const robots = robotsDe(p.id)
              const porcentaje = porcentajeProgreso(puntosProgreso(p.config, robots > 0))
              return (
                <Link
                  key={p.id}
                  to={`/editor/${p.id}`}
                  className="grid items-center gap-x-8 gap-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-slate-300 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_7rem_1.5rem]"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color }}>
                      <IconoCarpeta className="h-5 w-5 text-white" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{p.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {robots === 0 ? 'Sin robots asociados' : robots === 1 ? '1 robot asociado' : `${robots} robots asociados`}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Progreso</span>
                      <span className="font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {porcentaje}%
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full" style={{ backgroundColor: `${color}26` }}>
                      <div className="h-full rounded-full" style={{ width: `${porcentaje}%`, backgroundColor: color }} />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-slate-500">Última actividad</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{haceCuanto(p.updated_at)}</p>
                  </div>

                  <svg viewBox="0 0 20 20" className="hidden h-4 w-4 text-slate-400 sm:block" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )
            })}
            {(proyectos ?? []).length === 0 && (
              <p className="rounded-xl border border-slate-200 bg-white py-10 text-center text-slate-400">Todavía no hay proyectos.</p>
            )}
          </div>

          {total > FILAS_POR_PAGINA && (
            <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Mostrando {(pagina * FILAS_POR_PAGINA + 1).toLocaleString('es-CO')}–
                {Math.min((pagina + 1) * FILAS_POR_PAGINA, total).toLocaleString('es-CO')} de {total.toLocaleString('es-CO')}
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
                  disabled={(pagina + 1) * FILAS_POR_PAGINA >= total}
                  className="rounded-lg border border-slate-300 px-4 py-2 transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                  Siguiente →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
