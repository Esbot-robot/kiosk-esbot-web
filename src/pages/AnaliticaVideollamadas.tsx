import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { Cargando } from '../components/Cargando'

const FILAS_POR_PAGINA = 15

interface Llamada {
  actor_nombre: string
  objetivo: string | null
  creado_at: string
}

/** Analítica › Videollamadas (solo super administrador): historial de enlaces creados desde los robots */
export function AnaliticaVideollamadas() {
  // Paginación en el servidor: solo viajan las 15 filas de la página
  const [pagina, setPagina] = useState(0)
  const { data, isLoading } = useQuery({
    queryKey: ['actividad', 'llamadas-historial', pagina],
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const { data, count, error } = await supabase
        .from('actividad')
        .select('actor_nombre, objetivo, creado_at', { count: 'exact' })
        .eq('accion', 'orden')
        .like('texto', 'abrió una videollamada%')
        .order('creado_at', { ascending: false })
        .range(pagina * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA + FILAS_POR_PAGINA - 1)
      if (error) throw error
      return { llamadas: data as Llamada[], total: count ?? 0 }
    },
  })
  const llamadas = data?.llamadas
  const total = data?.total ?? 0

  return (
    <div className="px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Videollamadas</h2>
      <p className="mt-2 text-slate-600">Historial de las videollamadas realizadas desde los robots.</p>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <h3 className="px-6 py-5 font-semibold text-slate-900">Historial de videollamadas</h3>
        {isLoading ? (
          <Cargando texto="Cargando historial…" className="py-12" />
        ) : (
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-6 py-3 font-semibold">Robot</th>
                  <th className="px-6 py-3 font-semibold">Fecha</th>
                  <th className="px-6 py-3 font-semibold">Usuario</th>
                  <th className="px-6 py-3 font-semibold">Hora</th>
                </tr>
              </thead>
              <tbody>
                {(llamadas ?? []).map((l) => {
                  const fecha = new Date(l.creado_at)
                  return (
                    <tr key={l.creado_at} className="border-t border-slate-100">
                      <td className="px-6 py-3.5 text-slate-700">{l.objetivo ?? 'Robot'}</td>
                      <td className="px-6 py-3.5 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-3.5 text-slate-600">{l.actor_nombre}</td>
                      <td className="px-6 py-3.5 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  )
                })}
                {(llamadas ?? []).length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-slate-400">
                      Todavía no se han generado enlaces de videollamada.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {total > FILAS_POR_PAGINA && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
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
      </div>
    </div>
  )
}
