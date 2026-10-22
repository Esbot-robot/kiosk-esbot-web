import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { avisoCargando, avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { tamanoLegible, type ArchivoMedia } from '../lib/media'
import { usosDeArchivo } from '../lib/usoMedia'
import { IconoCerrarX } from './iconosPopup'

type Filtro = 'todos' | 'imagen' | 'video'

type FiltroUso = 'todos' | 'sin_uso'

/** Lista desplegable con el mismo aspecto que «Acciones en lote» de Contactos */
function Desplegable({
  etiqueta,
  valor,
  onCambiar,
  opciones,
}: {
  etiqueta: string
  valor: string
  onCambiar: (v: string) => void
  opciones: { id: string; texto: string }[]
}) {
  return (
    <div className="relative">
      <select
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta}
        className="h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-sm text-slate-800 transition-colors hover:border-slate-400 focus:border-[#1d293d] focus:outline-none"
      >
        {opciones.map((o) => (
          <option key={o.id} value={o.id}>
            {o.texto}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const esImagen = (a: ArchivoMedia) => a.tipo.startsWith('image/')
const esVideo = (a: ArchivoMedia) => a.tipo.startsWith('video/')
const urlDe = (a: ArchivoMedia) => supabase.storage.from('media').getPublicUrl(a.ruta).data.publicUrl

function Miniatura({ archivo }: { archivo: ArchivoMedia }) {
  if (esImagen(archivo)) {
    // loading="lazy": solo se descargan las imágenes que se llegan a ver en la lista
    return <img src={urlDe(archivo)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-slate-100 text-slate-400">
      {esVideo(archivo) ? (
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5v7l5.5-3.5z" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 3h8l5 5v13H6z" />
          <path d="M14 3v5h5" />
        </svg>
      )}
    </span>
  )
}

/**
 * Archivos de un proyecto, con el estilo de una biblioteca de medios: cuadrícula
 * con filtro por tipo y, al elegir uno, su ficha al lado. Solo se descargan las
 * imágenes visibles; los videos nunca se cargan aquí ("Abrir" los abre aparte).
 */
export function GaleriaMedia({
  titulo,
  archivos,
  proyectos,
  onCerrar,
}: {
  titulo: string
  archivos: ArchivoMedia[]
  /** todos los proyectos: sirven para saber dónde se usa cada archivo */
  proyectos: { nombre: string; config: unknown }[]
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [filtroUso, setFiltroUso] = useState<FiltroUso>('todos')
  const [elegida, setElegida] = useState<string | null>(null)
  const [dimensiones, setDimensiones] = useState<{ ruta: string; ancho: number; alto: number } | null>(null)
  const [borrando, setBorrando] = useState(false)

  const ordenados = useMemo(
    () => [...archivos].sort((a, b) => (b.creado ?? '').localeCompare(a.creado ?? '')),
    [archivos]
  )
  const enUsoTodos = useMemo(() => JSON.stringify(proyectos.map((p) => p.config)), [proyectos])
  const visibles = ordenados.filter(
    (a) =>
      (filtro === 'imagen' ? esImagen(a) : filtro === 'video' ? esVideo(a) : true) &&
      (filtroUso === 'sin_uso' ? !enUsoTodos.includes(a.ruta) : true)
  )
  const actual = archivos.find((a) => a.ruta === elegida) ?? null
  const usos = useMemo(() => (actual ? usosDeArchivo(actual.ruta, proyectos) : []), [actual, proyectos])
  const actualEnUso = usos.length > 0
  const conteo = (f: Filtro) => (f === 'imagen' ? archivos.filter(esImagen).length : f === 'video' ? archivos.filter(esVideo).length : archivos.length)

  async function borrar() {
    if (!actual || borrando) return
    if (actualEnUso) return
    const ok = await avisoConfirmar('¿Eliminar este archivo?', `Se liberarán ${tamanoLegible(actual.tamano)}. No se puede deshacer.`)
    if (!ok) return
    setBorrando(true)
    try {
      void avisoCargando('Eliminando archivo…')
      // Se vuelve a revisar justo antes de borrar: alguien pudo guardar un proyecto que lo use
      const { data, error } = await supabase.from('projects').select('config')
      if (error) throw error
      if (JSON.stringify((data ?? []).map((p) => p.config)).includes(actual.ruta)) {
        void avisoError('No se eliminó', 'El archivo está en uso en un proyecto.')
        return
      }
      const { error: e } = await supabase.storage.from('media').remove([actual.ruta])
      if (e) throw e
      setElegida(null)
      await queryClient.invalidateQueries({ queryKey: ['media'] })
      void avisoGuardado('Archivo eliminado')
    } catch (e) {
      void avisoError('No se pudo eliminar', describirError(e))
    } finally {
      setBorrando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex h-[calc(100dvh-2rem)] max-h-[46rem] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-8 md:py-5">
          <div className="min-w-0">
            <h3 className="truncate text-xl font-semibold text-slate-900 md:text-2xl">{titulo}</h3>
            <p className="text-sm text-slate-500">
              {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'} ·{' '}
              {tamanoLegible(archivos.reduce((t, a) => t + a.tamano, 0))}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <IconoCerrarX />
          </button>
        </div>

        {/* Filtros: tipo de archivo y uso */}
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-3 md:px-8">
          <Desplegable
            etiqueta="Tipo de archivo"
            valor={filtro}
            onCambiar={(v) => setFiltro(v as Filtro)}
            opciones={[
              { id: 'todos', texto: `Todos los tipos (${conteo('todos')})` },
              { id: 'imagen', texto: `Imágenes (${conteo('imagen')})` },
              { id: 'video', texto: `Videos (${conteo('video')})` },
            ]}
          />
          <Desplegable
            etiqueta="Uso del archivo"
            valor={filtroUso}
            onCambiar={(v) => setFiltroUso(v as FiltroUso)}
            opciones={[
              { id: 'todos', texto: 'Todos' },
              { id: 'sin_uso', texto: 'Sin uso' },
            ]}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="min-h-0 flex-1 overflow-y-auto p-5 md:px-8">
            {visibles.length === 0 ? (
              <p className="py-16 text-center text-sm text-slate-400">No hay archivos con estos filtros.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {visibles.map((a) => {
                  const marcada = a.ruta === elegida
                  return (
                    <button
                      key={a.ruta}
                      type="button"
                      onClick={() => setElegida(marcada ? null : a.ruta)}
                      title={a.nombre}
                      className={`group relative aspect-square overflow-hidden border bg-slate-50 text-left transition-shadow ${
                        marcada ? 'border-[#1d293d] ring-2 ring-[#1d293d]' : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <Miniatura archivo={a} />
                      <span className="absolute inset-x-0 bottom-0 truncate bg-white/90 px-2 py-1.5 text-xs text-slate-700">
                        {a.nombre}
                      </span>
                      {marcada && (
                        <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center bg-[#1d293d] text-white">
                          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                            <path d="M4.5 10.5l3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Ficha del archivo elegido */}
          <aside className="max-h-72 shrink-0 overflow-y-auto border-t border-slate-100 bg-slate-50 p-5 md:max-h-none md:w-72 md:border-l md:border-t-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Detalles del archivo</p>
            {!actual ? (
              <p className="mt-4 text-sm text-slate-400">Seleccione un archivo para ver sus detalles.</p>
            ) : (
              <div className="mt-4">
                <div className="relative aspect-square w-32 overflow-hidden border border-slate-200 bg-white">
                  <Miniatura archivo={actual} />
                  {esImagen(actual) && (
                    <img
                      src={urlDe(actual)}
                      alt=""
                      className="hidden"
                      onLoad={(e) =>
                        setDimensiones({ ruta: actual.ruta, ancho: e.currentTarget.naturalWidth, alto: e.currentTarget.naturalHeight })
                      }
                    />
                  )}
                </div>
                <p className="mt-3 break-all text-sm font-semibold text-slate-800">{actual.nombre}</p>
                <div className="mt-1 space-y-0.5 text-sm text-slate-500">
                  {actual.creado && (
                    <p>{new Date(actual.creado).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  )}
                  <p>{tamanoLegible(actual.tamano)}</p>
                  {esImagen(actual) && dimensiones?.ruta === actual.ruta && (
                    <p>
                      {dimensiones.ancho} por {dimensiones.alto} píxeles
                    </p>
                  )}
                  <p>{esVideo(actual) ? 'Video' : esImagen(actual) ? 'Imagen' : 'Archivo'}</p>
                </div>
                <div className="mt-4 border-t border-slate-200 pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uso</p>
                  {actualEnUso ? (
                    <ul className="mt-2 space-y-2">
                      {usos.map((u, i) => (
                        <li key={i} className="text-sm">
                          <span className="block font-medium text-slate-800">{u.lugar}</span>
                          <span className="block text-xs text-slate-500">Proyecto: {u.proyecto}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No está asignado a ningún proyecto.</p>
                  )}
                </div>
                <a
                  href={urlDe(actual)}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir en otra pestaña (consume datos equivalentes al tamaño del archivo)"
                  className="mt-3 block text-sm text-blue-600 hover:underline"
                >
                  Abrir archivo
                </a>
                <button
                  type="button"
                  onClick={() => void borrar()}
                  disabled={actualEnUso || borrando}
                  title={actualEnUso ? 'No se puede eliminar un archivo que un proyecto está usando' : undefined}
                  className="mt-2 text-sm text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  Borrar permanentemente
                </button>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  )
}
