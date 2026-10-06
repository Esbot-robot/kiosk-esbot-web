import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { Cargando } from '../components/Cargando'
import type { Contacto } from '../types/config'
import { esAdmin, usePerfil } from '../lib/perfil'

const FILAS_POR_PAGINA = 100

type Origen = Contacto['origen']
type AccionLote = '' | 'exportar' | 'eliminar'

/** ids por petición al exportar o borrar una selección (la URL tiene límite) */
const IDS_POR_TANDA = 150

const COLUMNAS = 'id, project_id, origen, foto_id, foto_numero, serial, nombre, correo, celular, creado_at'

function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Quita lo que rompería el filtro .or() de PostgREST (comas, paréntesis, comodines) */
function limpiarBusqueda(texto: string): string {
  return texto.replace(/[,()%*\\]/g, ' ').trim()
}

function urlFoto(id: string): string {
  return supabase.storage.from('fotos').getPublicUrl(`${id}.jpg`).data.publicUrl
}

/** Valor de una celda CSV: entre comillas si trae separador, comillas o saltos */
function celdaCsv(valor: string | number | null): string {
  const texto = valor === null ? '' : String(valor)
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/**
 * Contactos que dejaron los visitantes en el formulario del QR, por proyecto.
 * Dos pestañas: los que llegaron desde la foto y los del botón de registro.
 */
export function Contactos() {
  const queryClient = useQueryClient()
  const admin = esAdmin(usePerfil())
  const [params, setParams] = useSearchParams()
  const [origen, setOrigen] = useState<Origen>('foto')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(0)
  const [accion, setAccion] = useState<AccionLote>('')
  const [aplicando, setAplicando] = useState(false)
  /** ids marcados; con "todos" la selección es todo lo que coincide con la búsqueda */
  const [seleccion, setSeleccion] = useState<Set<string>>(() => new Set())
  const [todos, setTodos] = useState(false)
  const casillaTodos = useRef<HTMLInputElement>(null)

  const { data: proyectos, isLoading: cargandoProyectos } = useQuery({
    queryKey: ['proyectos-nombres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, nombre').order('updated_at', { ascending: false })
      if (error) throw error
      return data as { id: string; nombre: string }[]
    },
  })

  const proyectoId = params.get('proyecto') ?? proyectos?.[0]?.id ?? ''

  // La búsqueda espera a que se deje de escribir para no consultar por cada letra
  useEffect(() => {
    const t = setTimeout(() => setFiltro(limpiarBusqueda(busqueda)), 350)
    return () => clearTimeout(t)
  }, [busqueda])

  useEffect(() => {
    setPagina(0)
    limpiarSeleccion()
  }, [proyectoId, origen, filtro])

  function limpiarSeleccion() {
    setSeleccion(new Set())
    setTodos(false)
  }

  const { data: conteos } = useQuery({
    queryKey: ['contactos-conteo', proyectoId],
    enabled: !!proyectoId,
    queryFn: async () => {
      const contar = async (o: Origen) => {
        const { count, error } = await supabase
          .from('contactos')
          .select('id', { count: 'exact', head: true })
          .eq('project_id', proyectoId)
          .eq('origen', o)
        if (error) throw error
        return count ?? 0
      }
      const [foto, registro] = await Promise.all([contar('foto'), contar('registro')])
      return { foto, registro }
    },
  })

  const filtroOr = `nombre.ilike.%${filtro}%,correo.ilike.%${filtro}%,celular.ilike.%${filtro}%`

  /** consulta base de la pestaña y la búsqueda actuales (tabla y CSV) */
  function consulta() {
    let q = supabase
      .from('contactos')
      .select(COLUMNAS, { count: 'exact' })
      .eq('project_id', proyectoId)
      .eq('origen', origen)
      .order('creado_at', { ascending: false })
    if (filtro) q = q.or(filtroOr)
    return q
  }

  const {
    data: listado,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['contactos', proyectoId, origen, filtro, pagina],
    enabled: !!proyectoId,
    placeholderData: (anterior) => anterior,
    queryFn: async () => {
      const desde = pagina * FILAS_POR_PAGINA
      const { data, error, count } = await consulta().range(desde, desde + FILAS_POR_PAGINA - 1)
      if (error) throw error
      return { filas: data as Contacto[], total: count ?? 0 }
    },
  })

  const nombreProyecto = proyectos?.find((p) => p.id === proyectoId)?.nombre ?? ''

  /** Borra la selección: por ids, o todo lo que coincide si están "todos" */
  async function eliminarSeleccion() {
    if (todos) {
      let q = supabase.from('contactos').delete().eq('project_id', proyectoId).eq('origen', origen)
      if (filtro) q = q.or(filtroOr)
      const { error } = await q
      if (error) throw error
      return
    }
    const ids = [...seleccion]
    for (let i = 0; i < ids.length; i += IDS_POR_TANDA) {
      const { error } = await supabase.from('contactos').delete().in('id', ids.slice(i, i + IDS_POR_TANDA))
      if (error) throw error
    }
  }

  /** Filas completas de la selección, para el CSV */
  async function filasSeleccionadas(): Promise<Contacto[]> {
    const filas: Contacto[] = []
    if (todos) {
      // En tandas de 1000, el límite de Supabase por consulta
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await consulta().range(desde, desde + 999)
        if (error) throw error
        filas.push(...(data as Contacto[]))
        if (!data || data.length < 1000) break
      }
      return filas
    }
    const ids = [...seleccion]
    for (let i = 0; i < ids.length; i += IDS_POR_TANDA) {
      const { data, error } = await supabase
        .from('contactos')
        .select(COLUMNAS)
        .in('id', ids.slice(i, i + IDS_POR_TANDA))
        .order('creado_at', { ascending: false })
      if (error) throw error
      filas.push(...(data as Contacto[]))
    }
    return filas
  }

  function descargarCsv(filas: Contacto[]) {
    const encabezado = origen === 'foto' ? ['Foto', 'Nombre', 'Correo', 'Celular', 'Robot', 'Fecha'] : ['Nombre', 'Correo', 'Celular', 'Fecha']
    const lineas = filas.map((c) => {
      const fecha = new Date(c.creado_at).toLocaleString('es-CO')
      const valores = origen === 'foto' ? [c.foto_numero, c.nombre, c.correo, c.celular, c.serial, fecha] : [c.nombre, c.correo, c.celular, fecha]
      return valores.map(celdaCsv).join(';')
    })
    // BOM + punto y coma: así lo abre bien el Excel en español, con tildes
    const blob = new Blob(['\uFEFF' + [encabezado.join(';'), ...lineas].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    const nombreArchivo = nombreProyecto.replace(/[^\p{L}\p{N}]+/gu, '_') || 'proyecto'
    enlace.download = `Contactos_${origen === 'foto' ? 'foto' : 'registro'}_${nombreArchivo}.csv`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  /** Botón Aplicar de las acciones en lote */
  async function aplicarAccion() {
    if (cantidadSeleccionada === 0) {
      void avisoError('Sin selección', 'Marca al menos un contacto en la tabla.')
      return
    }
    if (!accion) {
      void avisoError('Sin acción', 'Elige qué hacer con los contactos seleccionados.')
      return
    }
    const cantidad = cantidadSeleccionada.toLocaleString('es-CO')
    if (accion === 'eliminar') {
      const ok = await avisoConfirmar(
        '¿Eliminar contactos?',
        `Se eliminarán ${cantidad} ${cantidadSeleccionada === 1 ? 'contacto' : 'contactos'} de "${nombreProyecto}". No se puede deshacer.`
      )
      if (!ok) return
    }
    setAplicando(true)
    try {
      if (accion === 'exportar') {
        descargarCsv(await filasSeleccionadas())
      } else {
        await eliminarSeleccion()
        limpiarSeleccion()
        setPagina(0)
        await queryClient.invalidateQueries({ queryKey: ['contactos'] })
        await queryClient.invalidateQueries({ queryKey: ['contactos-conteo'] })
        void avisoGuardado(cantidadSeleccionada === 1 ? 'Contacto eliminado' : 'Contactos eliminados')
      }
      setAccion('')
    } catch (e) {
      void avisoError(accion === 'exportar' ? 'No se pudo exportar' : 'No se pudieron eliminar', describirError(e))
    } finally {
      setAplicando(false)
    }
  }

  const filas = listado?.filas ?? []
  const totalFiltrado = listado?.total ?? 0
  const paginas = Math.max(1, Math.ceil(totalFiltrado / FILAS_POR_PAGINA))
  const cantidadSeleccionada = todos ? totalFiltrado : seleccion.size
  const paginaMarcada = filas.length > 0 && filas.every((c) => todos || seleccion.has(c.id))
  const paginaParcial = !paginaMarcada && filas.some((c) => seleccion.has(c.id))

  // El estado "a medias" de la casilla del encabezado solo se pone por código
  useEffect(() => {
    if (casillaTodos.current) casillaTodos.current.indeterminate = paginaParcial
  }, [paginaParcial])

  function marcarPagina(marcar: boolean) {
    if (!marcar) return limpiarSeleccion()
    setSeleccion((actual) => new Set([...actual, ...filas.map((c) => c.id)]))
  }

  function marcarFila(id: string, marcar: boolean) {
    // Al desmarcar una fila con "todos" activo, se pasa a selección por ids
    const base = todos ? new Set(filas.map((c) => c.id)) : new Set(seleccion)
    if (marcar) base.add(id)
    else base.delete(id)
    setTodos(false)
    setSeleccion(base)
  }

  return (
    <div className="overflow-x-hidden px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <div>
        <div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Contactos</h2>
          <p className="mt-2 text-slate-600">Contactos de registros por QR.</p>
        </div>
      </div>

      {cargandoProyectos ? (
        <Cargando />
      ) : !proyectoId ? (
        <p className="mt-10 text-slate-500">Todavía no hay proyectos.</p>
      ) : (
        <>
          <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-fit rounded-lg bg-slate-200 p-1">
              {(['foto', 'registro'] as Origen[]).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrigen(o)}
                  className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    origen === o ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {o === 'foto' ? 'Fotos' : 'Registro'} ({(conteos?.[o] ?? 0).toLocaleString('es-CO')})
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                value={proyectoId}
                onChange={(e) => setParams({ proyecto: e.target.value })}
                aria-label="Proyecto"
                title="Proyecto"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 sm:w-64"
              >
                {(proyectos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, correo o celular"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 sm:w-80"
              />
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl bg-white shadow-sm">
            {/* Acciones en lote: se elige qué hacer y se aplica a los marcados */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
              <div className="relative">
                <select
                  value={accion}
                  onChange={(e) => setAccion(e.target.value as AccionLote)}
                  aria-label="Acciones en lote"
                  className="h-10 appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-10 text-sm text-slate-800 transition-colors hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Acciones en lote</option>
                  <option value="exportar">Exportar CSV</option>
                  {admin && <option value="eliminar">Eliminar</option>}
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
              <button
                onClick={() => void aplicarAccion()}
                disabled={aplicando}
                className={`h-10 rounded-lg border bg-white px-5 text-sm font-semibold transition-colors disabled:opacity-60 ${
                  accion === 'eliminar'
                    ? 'border-rose-400 text-rose-600 hover:bg-rose-50'
                    : 'border-[#2A4470] text-[#2A4470] hover:bg-slate-100'
                }`}
              >
                {aplicando ? (accion === 'eliminar' ? 'Eliminando…' : 'Exportando…') : 'Aplicar'}
              </button>
              {cantidadSeleccionada > 0 && (
                <span className="flex items-center gap-2 rounded-full bg-indigo-50 py-1 pl-3 pr-1 text-sm font-medium text-indigo-700">
                  {cantidadSeleccionada.toLocaleString('es-CO')}{' '}
                  {cantidadSeleccionada === 1 ? 'seleccionado' : 'seleccionados'}
                  <button
                    onClick={limpiarSeleccion}
                    aria-label="Quitar selección"
                    title="Quitar selección"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
                  >
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                      <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
                    </svg>
                  </button>
                </span>
              )}
            </div>

            {/* Página completa marcada: ofrecer ampliar a todo lo que coincide */}
            {paginaMarcada && totalFiltrado > filas.length && (
              <div className="border-b border-slate-200 bg-indigo-50/60 px-4 py-2.5 text-center text-sm text-slate-700">
                {todos ? (
                  <>
                    Están seleccionados los {totalFiltrado.toLocaleString('es-CO')} contactos.{' '}
                    <button onClick={limpiarSeleccion} className="font-semibold text-indigo-600 hover:underline">
                      Quitar selección
                    </button>
                  </>
                ) : (
                  <>
                    Se seleccionaron los {filas.length} contactos de esta página.{' '}
                    <button onClick={() => setTodos(true)} className="font-semibold text-indigo-600 hover:underline">
                      Seleccionar los {totalFiltrado.toLocaleString('es-CO')}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className="overflow-x-auto">
            {isLoading ? (
              <Cargando />
            ) : error ? (
              <div className="p-6">
                <p className="text-red-600">No se pudieron cargar los contactos. {describirError(error)}</p>
                <button onClick={() => void refetch()} className="mt-3 text-sm font-semibold text-indigo-600">
                  Reintentar
                </button>
              </div>
            ) : filas.length === 0 ? (
              <p className="p-6 text-slate-500">
                {filtro ? 'Ningún contacto coincide con la búsqueda.' : 'Aún no hay contactos en esta pestaña.'}
              </p>
            ) : (
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="w-12 py-3 pl-4">
                      <input
                        ref={casillaTodos}
                        type="checkbox"
                        checked={paginaMarcada}
                        onChange={(e) => marcarPagina(e.target.checked)}
                        aria-label="Seleccionar los contactos de esta página"
                        className="h-4 w-4 cursor-pointer rounded accent-indigo-600"
                      />
                    </th>
                    {origen === 'foto' && <th className="px-4 py-3 font-medium">Foto</th>}
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Correo</th>
                    <th className="px-4 py-3 font-medium">Celular</th>
                    {origen === 'foto' && <th className="px-4 py-3 font-medium">Robot</th>}
                    <th className="px-4 py-3 font-medium">Fecha</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => (
                    <tr
                      key={c.id}
                      className={`border-b border-slate-100 transition-colors last:border-0 ${
                        todos || seleccion.has(c.id) ? 'bg-indigo-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="py-3 pl-4">
                        <input
                          type="checkbox"
                          checked={todos || seleccion.has(c.id)}
                          onChange={(e) => marcarFila(c.id, e.target.checked)}
                          aria-label={`Seleccionar a ${c.nombre}`}
                          className="h-4 w-4 cursor-pointer rounded accent-indigo-600"
                        />
                      </td>
                      {origen === 'foto' && (
                        <td className="px-4 py-3">
                          {c.foto_id ? (
                            <a
                              href={urlFoto(c.foto_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver foto (si ya venció, no abre)"
                              className="font-semibold text-[#2A4470] hover:underline"
                            >
                              #{c.foto_numero}
                            </a>
                          ) : (
                            `#${c.foto_numero ?? ''}`
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-slate-800">{c.nombre}</td>
                      <td className="px-4 py-3 text-slate-600">{c.correo}</td>
                      <td className="px-4 py-3 text-slate-600">{c.celular}</td>
                      {origen === 'foto' && <td className="px-4 py-3 font-mono text-xs text-slate-500">{c.serial}</td>}
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">{fechaHora(c.creado_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            </div>
          </div>

          {paginas > 1 && (
            <div className="mt-4 flex items-center justify-end gap-3 text-sm text-slate-600">
              <button
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {pagina + 1} de {paginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(paginas - 1, p + 1))}
                disabled={pagina >= paginas - 1}
                className="rounded-lg border border-slate-300 px-3 py-1.5 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
