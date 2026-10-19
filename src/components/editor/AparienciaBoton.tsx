import { Advertencia } from '../Advertencia'
import { useRef, useState } from 'react'
import { CampoColor } from '../CampoColor'
import { Ayuda } from '../Ayuda'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import { describirError } from '../../lib/errores'
import { useDiseno } from '../../lib/disenos'
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
  // Cada diseño usa solo parte de estos campos: el resto se oculta para no llenar el diálogo
  const diseno = useDiseno()
  // Banner + tarjeta: el texto y el contorno se calculan solos, solo se elige el fondo.
  // La píldora del banner sí lleva texto, fondo y contorno.
  const soloFondo = diseno === 'banner' && esTarjeta

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
      <div className={`grid grid-cols-1 gap-4 ${soloFondo ? '' : 'sm:grid-cols-3'}`}>
        {!soloFondo && (
          <CampoColor label="Color de texto" value={valor.color_texto} onChange={(color_texto) => onChange({ ...valor, color_texto })} />
        )}
        <CampoColor label="Color de fondo" value={valor.color_fondo} onChange={(color_fondo) => onChange({ ...valor, color_fondo })} />
        {!soloFondo && (
          <CampoColor label="Color de contorno" value={valor.color_contorno} onChange={(color_contorno) => onChange({ ...valor, color_contorno })} />
        )}
      </div>

      {/* Formato visual: la etiqueta y las dos opciones en la misma línea */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="flex items-center gap-2 font-medium text-slate-800">
          Formato visual
          <Ayuda>Píldora: el formato bajo y alargado. Tarjeta: más alta, con bordes redondeados.</Ayuda>
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-slate-800">
          <input
            type="radio"
            name={`forma-${valor.imagen_url || valor.texto}`}
            checked={!esTarjeta}
            onChange={() => onChange({ ...valor, forma: 'pildora' })}
            className="accent-indigo-600"
          />
          Píldora
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-slate-800">
          <input
            type="radio"
            name={`forma-${valor.imagen_url || valor.texto}`}
            checked={esTarjeta}
            onChange={() => onChange({ ...valor, forma: 'tarjeta' })}
            className="accent-indigo-600"
          />
          Tarjeta
        </label>
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
          {error && <Advertencia className="mt-3">{error}</Advertencia>}
        </div>
      )}

      {esTarjeta && !valor.imagen_url && diseno !== 'clasico' && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Ícono de la tarjeta
            <Ayuda>
              {diseno === 'banner'
                ? 'La tarjeta se dibuja con su color de fondo en degradado y este ícono encima, con una franja abajo para el texto. '
                : 'La tarjeta se dibuja con su color de fondo, rayas diagonales del mismo tono y este ícono dentro de un círculo. '}
              Solo se usa cuando la tarjeta no tiene imagen. Usa un PNG cuadrado con fondo transparente. Máximo 2MB.
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
          {/* Feria: círculo del ícono (relleno y contorno) y rayas */}
          {diseno === 'feria' && (
            <>
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
            </>
          )}
          {/* Banner: la franja de abajo, donde va el texto, tiene su propio color */}
          {diseno === 'banner' && (
            <div className="mt-4">
              <CampoColor
                label="Color de la franja del texto"
                value={valor.color_franja ?? ''}
                onChange={(color_franja) => onChange({ ...valor, color_franja })}
                ayuda="Es el color de la franja de abajo, donde va el texto de la tarjeta. Si lo dejas vacío, usa un tono más oscuro del color de la tarjeta."
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
