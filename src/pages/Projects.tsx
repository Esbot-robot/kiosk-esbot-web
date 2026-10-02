import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'
import { configVacia, type Project } from '../types/config'
import { DialogFijarRobot } from '../components/DialogFijarRobot'
import { IconoFijar, IconoReloj } from '../components/iconos'
import robotPng from '../assets/icons/robot.png'
import { Cargando } from '../components/Cargando'

async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data as Project[]
}

function tiempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutos < 1) return 'Editado justo ahora'
  if (minutos < 60) return `Editado hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `Editado hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Editado ayer'
  return `Editado hace ${dias} días`
}

export function Projects() {
  const [busqueda, setBusqueda] = useState('')
  const [proyectoAFijar, setProyectoAFijar] = useState<Project | null>(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: proyectos, isLoading, error } = useQuery({
    queryKey: ['projects'],
    queryFn: fetchProjects,
  })

  // Asignaciones robot → proyecto para saber a qué robot está fijado cada uno
  const { data: robots } = useQuery({
    queryKey: ['robots'],
    queryFn: async () => {
      const { data, error } = await supabase.from('robots').select('serial, project_id')
      if (error) throw error
      return data as { serial: string; project_id: string | null }[]
    },
  })

  const robotsPorProyecto = new Map<string, string[]>()
  for (const r of robots ?? []) {
    if (!r.project_id) continue
    const lista = robotsPorProyecto.get(r.project_id) ?? []
    lista.push(r.serial)
    robotsPorProyecto.set(r.project_id, lista)
  }

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

  /**
   * Copia del proyecto con toda su configuración. Comparte los archivos del
   * original (videos, logo, fondos, marco): no ocupa más almacenamiento, y al
   * eliminar un proyecto solo se borran los archivos que ningún otro usa.
   * No se copian los robots fijados, ni fotos ni analítica: son de cada evento.
   */
  const duplicar = useMutation({
    mutationFn: async (original: Project) => {
      const { error } = await supabase
        .from('projects')
        .insert({ nombre: `Copia de ${original.nombre}`, config: { ...structuredClone(original.config), version: 1 } })
      if (error) throw error
    },
    // la copia aparece de primera en la lista (orden: última edición)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  })

  const filtrados = (proyectos ?? []).filter((p) =>
    p.nombre.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      {/* Barra de búsqueda: en teléfono ocupa todo el ancho */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-8 md:px-12 md:py-4">
        <input
          type="search"
          placeholder="Buscar proyectos..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm focus:border-indigo-400 focus:outline-none md:w-96"
        />
      </div>

      {/* Mismos márgenes que Robots. Abajo, espacio extra en teléfono para
          que el botón flotante no tape la última tarjeta */}
      <div className="px-4 pb-28 pt-6 sm:px-8 md:px-12 md:py-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Proyectos</h2>
            <p className="mt-2 text-slate-600">
              Gestiona y personaliza tus módulos interactivos desde un solo lugar.
            </p>
          </div>
          {/* En teléfono este botón se cambia por el flotante de abajo */}
          <button
            onClick={() => crearProyecto.mutate()}
            disabled={crearProyecto.isPending}
            className="hidden shrink-0 rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 md:block"
          >
            + Nuevo proyecto
          </button>
        </div>
        {crearProyecto.error && (
          <p className="mt-4 text-sm text-red-600">
            No se pudo crear el proyecto. {describirError(crearProyecto.error)}
          </p>
        )}
        {duplicar.error && (
          <p className="mt-4 text-sm text-red-600">
            No se pudo duplicar el proyecto. {describirError(duplicar.error)}
          </p>
        )}

        {isLoading && <Cargando texto="Cargando proyectos…" />}
        {error && (
          <p className="mt-10 text-red-600">
            No se pudieron cargar los proyectos. {describirError(error)}
          </p>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {filtrados.map((proyecto) => {
            const serials = robotsPorProyecto.get(proyecto.id) ?? []
            const fijado = serials.length > 0
            return (
            <div
              key={proyecto.id}
              onClick={() => navigate(`/editor/${proyecto.id}`)}
              className={`relative cursor-pointer rounded-xl border bg-white p-4 text-left shadow-sm transition-shadow hover:shadow-md ${
                fijado ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
              }`}
            >
              {fijado && (
                <span className="absolute right-3 top-3 z-10 rounded-full bg-indigo-600 px-3 py-1 text-xs font-bold text-white">
                  {serials.length === 1 ? 'FIJADO' : `${serials.length} ROBOTS`}
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
                  <img src={robotPng} alt="" className="h-24 w-auto object-contain opacity-80" />
                )}
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">{proyecto.nombre}</h3>
              <div className="mt-1 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <IconoReloj /> {tiempoRelativo(proyecto.updated_at)}
                </p>
                <div className="flex items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      duplicar.mutate(proyecto)
                    }}
                    disabled={duplicar.isPending}
                    title="Duplicar proyecto"
                    aria-label="Duplicar proyecto"
                    className="rounded-lg px-2 py-1 text-blue-700 transition-colors hover:bg-indigo-50 disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setProyectoAFijar(proyecto)
                    }}
                    title="Fijar proyecto a robot"
                    className="rounded-lg px-2 py-1 transition-colors hover:bg-indigo-50"
                  >
                    <IconoFijar />
                  </button>
                </div>
              </div>
            </div>
            )
          })}
        </div>

        {!isLoading && filtrados.length === 0 && (
          <p className="mt-10 text-slate-500">
            {busqueda ? 'Sin resultados para esa búsqueda.' : 'Aún no hay proyectos. Crea el primero.'}
          </p>
        )}
      </div>

      {/* Nuevo proyecto en teléfono: botón redondo flotante abajo a la derecha.
          z-30 queda por debajo del menú lateral (z-40/50) cuando se abre */}
      <button
        onClick={() => crearProyecto.mutate()}
        disabled={crearProyecto.isPending}
        aria-label="Nuevo proyecto"
        title="Nuevo proyecto"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 transition-colors hover:bg-indigo-700 active:scale-95 disabled:opacity-50 md:hidden"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {proyectoAFijar && (
        <DialogFijarRobot proyecto={proyectoAFijar} onCerrar={() => setProyectoAFijar(null)} />
      )}
    </div>
  )
}
