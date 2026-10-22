import { useRef, type ReactNode } from 'react'
import { IconoLapizEditar, IconoNubeSubir, IconoPapelera, IconoVideo } from '../iconosPopup'

interface CargadorArchivoProps {
  /** qué se carga, para la vista previa y las descripciones ("imagen", "ícono", "video", "marco") */
  entidad: string
  tipo: 'imagen' | 'icono' | 'marco' | 'video'
  /** texto del recuadro cuando todavía no hay archivo ("Cargar imagen") */
  etiquetaCarga: string
  /** formato y tamaño aceptados, debajo de la etiqueta */
  detalle: string
  accept: string
  /** archivo actual; vacío = todavía no hay */
  url: string
  /** nombre a mostrar junto a la vista previa de un video */
  nombre?: string
  subiendo?: boolean
  /** avance de la subida (barra) */
  estadoSubida?: ReactNode
  /** deshabilita los botones, por ejemplo mientras otro archivo se está subiendo */
  deshabilitado?: boolean
  onElegir: (archivo: File) => void
  onQuitar: () => void
}

const claseIcono =
  'flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-40'

/**
 * Cargador de un archivo del botón. Sin archivo, un recuadro con el icono y la acción; con
 * archivo, su vista previa y dos iconos (reemplazar y quitar) con su descripción al pasar el cursor.
 */
export function CargadorArchivo({
  entidad,
  tipo,
  etiquetaCarga,
  detalle,
  accept,
  url,
  nombre,
  subiendo,
  estadoSubida,
  deshabilitado,
  onElegir,
  onQuitar,
}: CargadorArchivoProps) {
  const input = useRef<HTMLInputElement>(null)
  const elegir = () => input.current?.click()

  return (
    <div>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = ''
          if (archivo) onElegir(archivo)
        }}
      />

      {subiendo ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center text-sm text-slate-500">
          Subiendo {entidad}…
          {estadoSubida && <div className="mt-3 text-left">{estadoSubida}</div>}
        </div>
      ) : url ? (
        <div className="flex items-center gap-3">
          {tipo === 'video' ? (
            <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <IconoVideo className="h-7 w-7 shrink-0 text-slate-500" />
              <span className="break-all text-sm text-slate-700">{nombre || 'Video cargado'}</span>
            </div>
          ) : (
            <img
              src={url}
              alt={`${entidad} cargado`}
              className={
                tipo === 'marco'
                  ? 'h-40 w-auto rounded-lg border border-slate-200 bg-slate-100 object-contain'
                  : tipo === 'icono'
                    ? 'h-16 w-16 rounded-lg border border-slate-200 bg-slate-50 object-contain p-2'
                    : 'h-24 w-24 rounded-lg border border-slate-200 bg-slate-50 object-contain'
              }
            />
          )}
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={deshabilitado}
              onClick={elegir}
              title={`Reemplazar ${entidad}`}
              aria-label={`Reemplazar ${entidad}`}
              className={claseIcono}
            >
              <IconoLapizEditar className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={deshabilitado}
              onClick={onQuitar}
              title={`Quitar ${entidad}`}
              aria-label={`Quitar ${entidad}`}
              className={`${claseIcono} hover:!bg-rose-50 hover:!text-rose-600`}
            >
              <IconoPapelera />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={deshabilitado}
          onClick={elegir}
          className="flex w-full max-w-xs flex-col items-center gap-1 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-slate-500 transition-colors hover:border-slate-400 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IconoNubeSubir />
          <span className="text-sm font-medium text-slate-700">{etiquetaCarga}</span>
          <span className="text-xs text-slate-400">{detalle}</span>
        </button>
      )}
    </div>
  )
}
