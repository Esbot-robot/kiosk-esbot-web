import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { configVacia, type Project } from '../types/config'

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

function tiempoRelativo(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (dias === 0) return 'Editado hoy'
  if (dias === 1) return 'Editado ayer'
  return `Editado hace ${dias} días`
}

export function Projects() {
  const [busqueda, setBusqueda] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: proyectos, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  const crearProyecto = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ nombre: 'Nuevo proyecto', config: configVacia() })
        .select()
        .single()
      if (error) throw error
      return data as Project
    },
    onSuccess: (proyecto) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate(`/editor/${proyecto.id}`)
    },
  })

  const filtrados = (proyectos ?? []).filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      {/* Barra de búsqueda */}
      <div className="border-b border-slate-200 bg-white px-12 py-4">
        <input
          type="search"
          placeholder="Buscar proyectos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-96 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none"
        />
      </div>

      <div className="px-12 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-4xl font-bold text-slate-900">Proyectos</h2>
            <p className="mt-2 text-slate-600">
              Gestiona y personaliza tus módulos interactivos desde un solo lugar.
            </p>
          </div>
          <button
            onClick={() => crearProyecto.mutate()}
            disabled={crearProyecto.isPending}
            className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            + Nuevo proyecto
          </button>
        </div>

        {isLoading && <p className="mt-10 text-slate-500">Cargando proyectos...</p>}
        {error && (
          <p className="mt-10 text-red-600">
            Error cargando proyectos. ¿Está bien configurado el .env?
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {filtrados.map((proyecto) => (
            <button
              key={proyecto.id}
              onClick={() => navigate(`/editor/${proyecto.id}`)}
              className={`relative rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${
                proyecto.activo ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
              }`}
            >
              {proyecto.activo && (
                <span className="absolute right-3 top-3 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                  ACTIVO
                </span>
              )}
              {/* Miniatura: fondo de la pantalla inicial si existe */}
              <div className="flex h-32 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                {proyecto.config.pantalla_inicial.fondo_url ? (
                  <img
                    src={proyecto.config.pantalla_inicial.fondo_url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">🤖</span>
                )}
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{proyecto.nombre}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                🕐 {tiempoRelativo(proyecto.updated_at)}
              </p>
            </button>
          ))}
        </div>

        {!isLoading && filtrados.length === 0 && (
          <p className="mt-10 text-slate-500">
            {busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay proyectos. Crea el primero.'}
          </p>
        )}
      </div>
    </div>
  )
}
