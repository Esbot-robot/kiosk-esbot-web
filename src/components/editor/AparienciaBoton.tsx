import { useRef, useState } from 'react'
import { CampoColor } from '../CampoColor'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import type { BotonEstilo } from '../../types/config'

interface AparienciaBotonProps {
  valor: BotonEstilo
  projectId: string
  onChange: (nuevo: BotonEstilo) => void
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

/** Campos visuales compartidos por el botón Jugar y las dos acciones adicionales. */
export function AparienciaBoton({ valor, projectId, onChange }: AparienciaBotonProps) {
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const inputImagen = useRef<HTMLInputElement>(null)
  const esTarjeta = valor.forma === 'tarjeta'

  async function subirImagen(file?: File) {
    setError('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Selecciona una imagen PNG, JPG o WEBP.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`La imagen pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El máximo es 10MB.`)
      return
    }

    setSubiendo(true)
    try {
      const imagen_url = await subirArchivo('media', rutaMedia(projectId, file.name), file)
      onChange({ ...valor, imagen_url })
    } catch (e) {
      const detalle = e instanceof Error ? e.message : 'Error desconocido'
      setError(`No se pudo subir la imagen: ${detalle}`)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CampoColor label="Color de texto" value={valor.color_texto} onChange={(color_texto) => onChange({ ...valor, color_texto })} />
        <CampoColor label="Color de fondo" value={valor.color_fondo} onChange={(color_fondo) => onChange({ ...valor, color_fondo })} />
        <CampoColor label="Color de contorno" value={valor.color_contorno} onChange={(color_contorno) => onChange({ ...valor, color_contorno })} />
      </div>

      <div>
        <p className="mb-2 font-medium text-slate-800">Formato visual</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`cursor-pointer rounded-lg border p-4 ${!esTarjeta ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
            <input
              type="radio"
              name={`forma-${valor.imagen_url || valor.texto}`}
              checked={!esTarjeta}
              onChange={() => onChange({ ...valor, forma: 'pildora' })}
              className="mr-2 accent-indigo-600"
            />
            <span className="font-semibold text-slate-800">Píldora</span>
            <span className="mt-1 block text-sm text-slate-500">El formato bajo y alargado actual.</span>
          </label>
          <label className={`cursor-pointer rounded-lg border p-4 ${esTarjeta ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
            <input
              type="radio"
              name={`forma-${valor.imagen_url || valor.texto}`}
              checked={esTarjeta}
              onChange={() => onChange({ ...valor, forma: 'tarjeta' })}
              className="mr-2 accent-indigo-600"
            />
            <span className="font-semibold text-slate-800">Tarjeta</span>
            <span className="mt-1 block text-sm text-slate-500">El doble de alto, con bordes redondeados.</span>
          </label>
        </div>
      </div>

      {esTarjeta && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="font-medium text-slate-800">Imagen de la tarjeta</p>
          <p className="mt-1 text-sm text-slate-500">Se mostrará directamente, sin capas, filtros ni oscurecimiento.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={subiendo}
              onClick={() => inputImagen.current?.click()}
              className="rounded-md border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {subiendo ? 'Subiendo...' : valor.imagen_url ? 'Reemplazar imagen' : 'Cargar imagen'}
            </button>
            {valor.imagen_url && (
              <>
                <span className="text-sm text-emerald-700">Imagen cargada</span>
                <button
                  type="button"
                  onClick={() => onChange({ ...valor, imagen_url: '' })}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              </>
            )}
          </div>
          <input
            ref={inputImagen}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void subirImagen(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {error && <p className="mt-3 text-sm font-medium text-rose-600">{error}</p>}
        </div>
      )}
    </div>
  )
}
