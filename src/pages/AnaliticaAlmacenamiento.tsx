import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { tamanoLegible, videosSinUso } from '../lib/media'
import { useArchivosMedia } from '../lib/useArchivosMedia'
import { VideosSinUso } from '../components/VideosSinUso'
import { GaleriaMedia } from '../components/GaleriaMedia'
import { Cargando } from '../components/Cargando'

const COLOR = '#1d293d'

/** Analítica › Almacenamiento (solo super administrador): espacio de los archivos del panel */
export function AnaliticaAlmacenamiento() {
  const { data: archivos, isLoading } = useArchivosMedia()

  const { data: proyectos } = useQuery({
    queryKey: ['projects', 'almacenamiento'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, nombre, config')
      if (error) throw error
      return data as { id: string; nombre: string; config: unknown }[]
    },
  })

  const [verSinUso, setVerSinUso] = useState(false)
  // carpeta del proyecto cuyos archivos se están viendo (null = ninguna)
  const [carpetaAbierta, setCarpetaAbierta] = useState<string | null>(null)

  const sinUso = useMemo(
    () => (archivos && proyectos ? videosSinUso(archivos, proyectos.map((p) => p.config)) : []),
    [archivos, proyectos]
  )
  const bytesTotal = (archivos ?? []).reduce((t, a) => t + a.tamano, 0)
  const bytesSinUso = sinUso.reduce((t, v) => t + v.tamano, 0)

  // Espacio por carpeta: cada proyecto tiene la suya en el bucket
  const porProyecto = useMemo(() => {
    const nombres = new Map((proyectos ?? []).map((p) => [p.id, p.nombre]))
    const mapa = new Map<string, number>()
    for (const a of archivos ?? []) mapa.set(a.carpeta, (mapa.get(a.carpeta) ?? 0) + a.tamano)
    return [...mapa.entries()]
      .map(([carpeta, bytes]) => ({
        clave: carpeta,
        nombre: carpeta === '' ? 'Archivos sueltos' : (nombres.get(carpeta) ?? 'Proyecto eliminado'),
        bytes,
      }))
      .sort((a, b) => b.bytes - a.bytes)
  }, [archivos, proyectos])
  const maximo = Math.max(1, ...porProyecto.map((f) => f.bytes))

  return (
    <div className="px-4 pb-16 pt-6 sm:px-8 md:px-12 md:py-10">
      <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Almacenamiento</h2>
      <p className="mt-2 text-slate-600">Espacio ocupado por los archivos de los proyectos: imágenes, videos y catálogos.</p>

      {isLoading ? (
        <Cargando texto="Calculando el espacio…" className="py-16" />
      ) : (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-semibold text-slate-900">Espacio por proyecto</h3>
                <div className="flex gap-6 text-right">
                  <div>
                    <p className="text-xs text-slate-500">Espacio usado</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {tamanoLegible(bytesTotal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Archivos</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {(archivos ?? []).length.toLocaleString('es-CO')}
                    </p>
                  </div>
                </div>
              </div>
              <div className="-mx-2 mt-4 space-y-2">
                {porProyecto.map((f) => (
                  <button
                    key={f.clave}
                    type="button"
                    onClick={() => setCarpetaAbierta(f.clave)}
                    title="Ver los archivos de este proyecto"
                    className="block w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-slate-600">{f.nombre}</span>
                      <span className="flex items-center gap-2 font-semibold text-slate-800" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {tamanoLegible(f.bytes)}
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path d="M8 5l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full" style={{ width: `${(f.bytes / maximo) * 100}%`, backgroundColor: COLOR }} />
                    </div>
                  </button>
                ))}
                {porProyecto.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No hay archivos guardados.</p>}
              </div>
            </div>

            <div className="self-start rounded-xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <h3 className="font-semibold text-slate-900">Liberar espacio</h3>
              <p className="mt-2 text-sm text-slate-600">
                {sinUso.length === 0
                  ? 'No hay videos sin uso: todos los archivos están asignados a algún proyecto.'
                  : `Hay ${sinUso.length} ${sinUso.length === 1 ? 'video que ningún proyecto utiliza' : 'videos que ningún proyecto utiliza'}, con ${tamanoLegible(bytesSinUso)} en total.`}
              </p>
              <button
                type="button"
                onClick={() => setVerSinUso(true)}
                disabled={sinUso.length === 0}
                className="mt-4 w-full bg-[#1d293d] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Revisar videos sin uso
              </button>
            </div>
          </div>
        </>
      )}

      {carpetaAbierta !== null && (
        <GaleriaMedia
          titulo={porProyecto.find((f) => f.clave === carpetaAbierta)?.nombre ?? 'Archivos'}
          archivos={(archivos ?? []).filter((a) => a.carpeta === carpetaAbierta)}
          proyectos={proyectos ?? []}
          onCerrar={() => setCarpetaAbierta(null)}
        />
      )}

      {verSinUso && (
        <VideosSinUso
          videos={sinUso}
          nombresProyecto={Object.fromEntries((proyectos ?? []).map((p) => [p.id, p.nombre]))}
          onCerrar={() => setVerSinUso(false)}
        />
      )}
    </div>
  )
}
