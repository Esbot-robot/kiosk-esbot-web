import { useRef, useState } from 'react'
import { CampoColor } from '../CampoColor'
import { Ayuda } from '../Ayuda'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import { describirError } from '../../lib/errores'
import type { BotonEstilo } from '../../types/config'

interface AparienciaBotonProps {
  valor: BotonEstilo
  projectId: string
  onChange: (nuevo: BotonEstilo) => void
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const MAX_ICONO_BYTES = 2 * 1024 * 1024

/** Campos visuales compartidos por el botón Jugar y las dos acciones adicionales. */
export function AparienciaBoton({ valor, projectId, onChange }: AparienciaBotonProps) {
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const inputImagen = useRef<HTMLInputElement>(null)
  const inputIcono = useRef<HTMLInputElement>(null)
  const [subiendoIcono, setSubiendoIcono] = useState(false)
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
      setError(`No se pudo subir la imagen. ${describirError(e)}`)
    } finally {
      setSubiendo(false)
    }
  }

  async function subirIcono(file?: File) {
    setError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('El ícono debe ser PNG, JPG o WEBP (mejor PNG con fondo transparente).')
      return
    }
    if (file.size > MAX_ICONO_BYTES) {
      setError(`El ícono pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El máximo es 2MB.`)
      return
    }
    setSubiendoIcono(true)
    try {
      const icono_url = await subirArchivo('media', rutaMedia(projectId, file.name), file)
      onChange({ ...valor, icono_url })
    } catch (e) {
      setError(`No se pudo subir el ícono. ${describirError(e)}`)
    } finally {
      setSubiendoIcono(false)
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
            <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
              Píldora
              <Ayuda>El formato bajo y alargado actual.</Ayuda>
            </span>
          </label>
          <label className={`cursor-pointer rounded-lg border p-4 ${esTarjeta ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}>
            <input
              type="radio"
              name={`forma-${valor.imagen_url || valor.texto}`}
              checked={esTarjeta}
              onChange={() => onChange({ ...valor, forma: 'tarjeta' })}
              className="mr-2 accent-indigo-600"
            />
            <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
              Tarjeta
              <Ayuda>El doble de alto, con bordes redondeados.</Ayuda>
            </span>
          </label>
        </div>
      </div>

      {esTarjeta && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Imagen de la tarjeta
            <Ayuda>Se mostrará directamente, sin capas, filtros ni oscurecimiento.</Ayuda>
          </p>
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

      {esTarjeta && !valor.imagen_url && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Ícono de la tarjeta
            <Ayuda>
              Solo en el diseño Feria y cuando la tarjeta no tiene imagen. La tarjeta se dibuja con su color de fondo,
              rayas diagonales del mismo tono y este ícono dentro de un círculo. Usa un PNG cuadrado con fondo
              transparente; se ajusta solo al círculo. Máximo 2MB.
            </Ayuda>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={subiendoIcono}
              onClick={() => inputIcono.current?.click()}
              className="rounded-md border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {subiendoIcono ? 'Subiendo...' : valor.icono_url ? 'Reemplazar ícono' : 'Cargar ícono'}
            </button>
            {valor.icono_url && (
              <>
                <img src={valor.icono_url} alt="" className="h-8 w-8 rounded-full border border-slate-200 object-contain p-1" />
                <button
                  type="button"
                  onClick={() => onChange({ ...valor, icono_url: '' })}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              </>
            )}
          </div>
          <input
            ref={inputIcono}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              void subirIcono(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <CampoColor
              label="Relleno del círculo"
              value={valor.color_circulo ?? ''}
              onChange={(color_circulo) => onChange({ ...valor, color_circulo })}
            />
            <CampoColor
              label="Contorno del círculo"
              value={valor.contorno_circulo ?? ''}
              onChange={(contorno_circulo) => onChange({ ...valor, contorno_circulo })}
            />
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-slate-800">
            <input
              type="checkbox"
              checked={valor.rayas !== false}
              onChange={(e) => onChange({ ...valor, rayas: e.target.checked })}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="flex items-center gap-2 font-medium">
              Rayas diagonales
              <Ayuda>Salen del color de fondo de la tarjeta: un tono más oscuro del mismo color.</Ayuda>
            </span>
          </label>
        </div>
      )}
    </div>
  )
}
