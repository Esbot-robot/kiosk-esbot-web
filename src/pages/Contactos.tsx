import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { Cargando } from '../components/Cargando'
import type { Contacto } from '../types/config'

const FILAS_POR_PAGINA = 100

type Origen = Contacto['origen']

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
  const [params, setParams] = useSearchParams()
  const [origen, setOrigen] = useState<Origen>('foto')
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState('')
  const [pagina, setPagina] = useState(0)
  const [exportando, setExportando] = useState(false)

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

  useEffect(() => setPagina(0), [proyectoId, origen, filtro])

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

  /** consulta base de la pestaña y la búsqueda actuales (tabla y CSV) */
  function consulta() {
    let q = supabase
      .from('contactos')
      .select(COLUMNAS, { count: 'exact' })
      .eq('project_id', proyectoId)
      .eq('origen', origen)
      .order('creado_at', { ascending: false })
    if (filtro) q = q.or(`nombre.ilike.%${filtro}%,correo.ilike.%${filtro}%,celular.ilike.%${filtro}%`)
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

  const total = (conteos?.foto ?? 0) + (conteos?.registro ?? 0)
  const nombreProyecto = proyectos?.find((p) => p.id === proyectoId)?.nombre ?? ''

  const eliminar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('contactos').delete().eq('project_id', proyectoId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contactos'] })
      queryClient.invalidateQueries({ queryKey: ['contactos-conteo'] })
      void avisoGuardado('Contactos eliminados')
    },
    onError: (e) => void avisoError('No se pudieron eliminar', describirError(e)),
  })

  async function confirmarEliminar() {
    const ok = await avisoConfirmar(
      '¿Eliminar contactos?',
      `Se eliminarán ${total.toLocaleString('es-CO')} contactos de "${nombreProyecto}" (foto y registro). No se puede deshacer.`
    )
    if (ok) eliminar.mutate()
  }

  /** CSV de la pestaña abierta, en tandas de 1000 (límite de Supabase por consulta) */
  async function exportarCsv() {
    setExportando(true)
    try {
      const filas: Contacto[] = []
      for (let desde = 0; ; desde += 1000) {
        const { data, error } = await consulta().range(desde, desde + 999)
        if (error) throw error
        filas.push(...(data as Contacto[]))
        if (!data || data.length < 1000) break
      }
      const encabezado = origen === 'foto' ? ['Foto', 'Nombre', 'Correo', 'Celular', 'Robot', 'Fecha'] : ['Nombre', 'Correo', 'Celular', 'Fecha']
      const lineas = filas.map((c) => {
        const fecha = new Date(c.creado_at).toLocaleString('es-CO')
        const valores = origen === 'foto' ? [c.foto_numero, c.nombre, c.correo, c.celular, c.serial, fecha] : [c.nombre, c.correo, c.celular, fecha]
        return valores.map(celdaCsv).join(';')
      })
      // BOM + punto y coma: así lo abre bien el Excel en español, con tildes
      const blob = new Blob(['﻿' + [encabezado.join(';'), ...lineas].join('\r\n')], { type: 'text/csv;charset=utf-8' })
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      const nombreArchivo = nombreProyecto.replace(/[^\p{L}\p{N}]+/gu, '_') || 'proyecto'
      enlace.download = `Contactos_${origen === 'foto' ? 'foto' : 'registro'}_${nombreArchivo}.csv`
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    } catch (e) {
      void avisoError('No se pudo exportar', describirError(e))
    } finally {
      setExportando(false)
    }
  }

  const filas = listado?.filas ?? []
  const totalFiltrado = listado?.total ?? 0
  const paginas = Math.max(1, Math.ceil(totalFiltrado / FILAS_POR_PAGINA))

  return (
    <div className="overflow-x-hidden px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Contactos</h2>
          <p className="mt-2 text-slate-600">Datos que dejaron los visitantes en el formulario del QR.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <label className="text-sm text-slate-600">
            Proyecto
            <select
              value={proyectoId}
              onChange={(e) => setParams({ proyecto: e.target.value })}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 sm:w-64"
            >
              {(proyectos ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void exportarCsv()}
            disabled={exportando || totalFiltrado === 0}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {exportando ? 'Exportando…' : 'Exportar CSV'}
          </button>
          <button
            onClick={() => void confirmarEliminar()}
            disabled={eliminar.isPending || total === 0}
            className="rounded-lg border border-rose-300 px-5 py-2.5 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
          >
            {eliminar.isPending ? 'Eliminando…' : 'Eliminar contactos'}
          </button>
        </div>
      </div>

      {cargandoProyectos ? (
        <Cargando />
      ) : !proyectoId ? (
        <p className="mt-10 text-slate-500">Todavía no hay proyectos.</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-3 gap-3">
            {[
              { label: 'Total', valor: total },
              { label: 'Desde foto', valor: conteos?.foto ?? 0 },
              { label: 'Desde registro', valor: conteos?.registro ?? 0 },
            ].map(({ label, valor }) => (
              <div key={label} className="rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="text-2xl font-bold text-slate-800">{valor.toLocaleString('es-CO')}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, correo o celular"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 sm:w-80"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl bg-white shadow-sm">
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
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      {origen === 'foto' && (
                        <td className="px-4 py-3">
                          {c.foto_id ? (
                            <a
                              href={urlFoto(c.foto_id)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Ver foto (si ya venció, no abre)"
                              className="font-semibold text-indigo-600 hover:underline"
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
