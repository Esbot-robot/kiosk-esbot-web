import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { avisoCargando, avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { tamanoLegible, type ArchivoMedia } from '../lib/media'

/** Los subidos hace menos de esto no se pueden borrar: quizá aún no se ha
 *  guardado el proyecto, o un robot todavía los está mostrando */
const DIAS_PROTEGIDO = 3

/**
 * Lista de videos sin uso para borrarlos desde el panel (solo super
 * administrador, desde Inicio). Solo viajan nombres y tamaños: nada se
 * reproduce ni se descarga, así que no suma egress. "Ver" abre un video
 * solo si se le da clic.
 */
export function VideosSinUso({
  videos,
  nombresProyecto,
  onCerrar,
}: {
  videos: ArchivoMedia[]
  nombresProyecto: Record<string, string>
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [borrando, setBorrando] = useState(false)

  const protegido = (v: ArchivoMedia) =>
    v.creado !== null && Date.now() - new Date(v.creado).getTime() < DIAS_PROTEGIDO * 24 * 3600_000
  const borrables = useMemo(() => videos.filter((v) => !protegido(v)), [videos])
  const elegidos = videos.filter((v) => seleccion.has(v.ruta))
  const bytesElegidos = elegidos.reduce((t, v) => t + v.tamano, 0)
  const todos = borrables.length > 0 && borrables.every((v) => seleccion.has(v.ruta))

  function alternar(ruta: string) {
    setSeleccion((actual) => {
      const nuevo = new Set(actual)
      if (nuevo.has(ruta)) nuevo.delete(ruta)
      else nuevo.add(ruta)
      return nuevo
    })
  }

  async function eliminar() {
    if (elegidos.length === 0 || borrando) return
    const ok = await avisoConfirmar(
      elegidos.length === 1 ? '¿Eliminar 1 video?' : `¿Eliminar ${elegidos.length} videos?`,
      `Se liberarán ${tamanoLegible(bytesElegidos)}. No se puede deshacer.`
    )
    if (!ok) return
    setBorrando(true)
    try {
      void avisoCargando('Eliminando videos…')
      // Se vuelve a revisar justo antes de borrar: alguien pudo guardar un
      // proyecto que use alguno mientras la ventana estaba abierta
      const { data, error } = await supabase.from('projects').select('config')
      if (error) throw error
      const enUso = JSON.stringify((data ?? []).map((p) => p.config))
      const rutas = elegidos.map((v) => v.ruta).filter((r) => !enUso.includes(r))
      for (let i = 0; i < rutas.length; i += 100) {
        const { error: e } = await supabase.storage.from('media').remove(rutas.slice(i, i + 100))
        if (e) throw e
      }
      setSeleccion(new Set())
      await queryClient.invalidateQueries({ queryKey: ['media'] })
      const saltados = elegidos.length - rutas.length
      void avisoGuardado(
        saltados > 0
          ? `Videos eliminados (${saltados} se conservaron porque ya están en uso)`
          : 'Videos eliminados'
      )
    } catch (e) {
      void avisoError('No se pudieron eliminar', describirError(e))
    } finally {
      setBorrando(false)
    }
  }

  return (
    <Modal
      titulo="Videos sin uso"
      ancho="max-w-[44rem]"
      onCancelar={onCerrar}
      onAceptar={() => void eliminar()}
      aceptarDeshabilitado={elegidos.length === 0 || borrando}
      textoAceptar={elegidos.length ? `Eliminar (${tamanoLegible(bytesElegidos)})` : 'Eliminar'}
    >
      <p className="text-sm text-slate-600">
        Videos sin proyecto asignado. Elimínalos para liberar espacio. Las fotos tomadas por los robots se borran
        automáticamente a los 7 días.
      </p>

      {videos.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">No hay videos sin uso.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={todos}
                    disabled={borrables.length === 0}
                    onChange={() => setSeleccion(todos ? new Set() : new Set(borrables.map((v) => v.ruta)))}
                    aria-label="Seleccionar todos"
                    className="h-4 w-4 accent-[#2A4470]"
                  />
                </th>
                <th className="px-3 py-2 font-medium">Video</th>
                <th className="px-3 py-2 font-medium">Proyecto</th>
                <th className="px-3 py-2 text-right font-medium">Tamaño</th>
                <th className="px-3 py-2 font-medium">Subido</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {videos.map((v) => {
                const bloqueado = protegido(v)
                return (
                  <tr key={v.ruta} className={`border-t border-slate-100 ${bloqueado ? 'text-slate-400' : 'text-slate-700'}`}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={seleccion.has(v.ruta)}
                        disabled={bloqueado}
                        onChange={() => alternar(v.ruta)}
                        aria-label={`Seleccionar ${v.nombre}`}
                        className="h-4 w-4 accent-[#2A4470]"
                      />
                    </td>
                    <td className="max-w-[14rem] truncate px-3 py-2" title={v.nombre}>
                      {v.nombre}
                    </td>
                    <td className="max-w-[10rem] truncate px-3 py-2">
                      {nombresProyecto[v.carpeta] ?? <span className="italic text-slate-400">Proyecto eliminado</span>}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {tamanoLegible(v.tamano)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {v.creado
                        ? new Date(v.creado).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '—'}
                      {bloqueado && <span className="ml-1 text-xs">(reciente)</span>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {/* Solo se descarga si se le da clic (eso sí gasta egress) */}
                      <a
                        href={supabase.storage.from('media').getPublicUrl(v.ruta).data.publicUrl}
                        target="_blank"
                        rel="noreferrer"
                        title="Abrir el video en otra pestaña (gasta lo que pesa el video)"
                        className="text-xs font-semibold text-[#2A4470] hover:underline"
                      >
                        Ver
                      </a>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
