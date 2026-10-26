import { Advertencia } from '../Advertencia'
import { useState } from 'react'
import { CampoColor } from '../CampoColor'
import { Ayuda } from '../Ayuda'
import { Interruptor } from '../Interruptor'
import { CargadorArchivo } from './CargadorArchivo'
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
      setError('Seleccione una imagen en formato PNG, JPG o WEBP.')
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
      setError(`No fue posible subir la imagen. ${describirError(e)}`)
    } finally {
      setSubiendo(false)
    }
  }

  async function subirIcono(file?: File) {
    setError('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('El ícono debe estar en formato PNG, JPG o WEBP (se recomienda PNG con fondo transparente).')
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
      setError(`No fue posible subir el ícono. ${describirError(e)}`)
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
          <Ayuda>Píldora: formato bajo y alargado. Tarjeta: formato más alto, con bordes redondeados.</Ayuda>
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-slate-800">
          <input
            type="radio"
            name={`forma-${valor.imagen_url || valor.texto}`}
            checked={!esTarjeta}
            onChange={() => onChange({ ...valor, forma: 'pildora' })}
            className="accent-[#1d293d]"
          />
          Píldora
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-slate-800">
          <input
            type="radio"
            name={`forma-${valor.imagen_url || valor.texto}`}
            checked={esTarjeta}
            onChange={() => onChange({ ...valor, forma: 'tarjeta' })}
            className="accent-[#1d293d]"
          />
          Tarjeta
        </label>
      </div>

      {esTarjeta && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Imagen de la tarjeta
            <Ayuda>
              Se muestra tal cual, sin capas, filtros ni oscurecimiento. El robot la estira hasta llenar la tarjeta: use la
              misma proporción que tiene la tarjeta en la vista previa para que no se deforme.
            </Ayuda>
          </p>
          <div className="mt-3">
            <CargadorArchivo
              entidad="imagen"
              tipo="imagen"
              etiquetaCarga="Cargar imagen"
              detalle="PNG, JPG o WEBP (máx. 10 MB)"
              accept="image/png,image/jpeg,image/webp"
              url={valor.imagen_url}
              subiendo={subiendo}
              onElegir={(archivo) => void subirImagen(archivo)}
              onQuitar={() => onChange({ ...valor, imagen_url: '' })}
            />
          </div>
          {error && <Advertencia className="mt-3">{error}</Advertencia>}
        </div>
      )}

      {esTarjeta && !valor.imagen_url && diseno !== 'clasico' && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Ícono de la tarjeta
            <Ayuda>
              {diseno === 'banner'
                ? 'La tarjeta se compone con su color de fondo en degradado, este ícono y una franja inferior para el texto. '
                : 'La tarjeta se compone con su color de fondo, rayas diagonales del mismo tono y este ícono dentro de un círculo. '}
              Se utiliza únicamente cuando la tarjeta no tiene imagen. Formato recomendado: PNG cuadrado con fondo transparente, de máximo 2 MB.
            </Ayuda>
          </p>
          <div className="mt-3">
            <CargadorArchivo
              entidad="ícono"
              tipo="icono"
              etiquetaCarga="Cargar ícono"
              detalle="PNG, JPG o WEBP (máx. 2 MB)"
              accept="image/png,image/jpeg,image/webp"
              url={valor.icono_url ?? ''}
              subiendo={subiendoIcono}
              onElegir={(archivo) => void subirIcono(archivo)}
              onQuitar={() => onChange({ ...valor, icono_url: '' })}
            />
          </div>
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
              <div className="mt-4 flex items-center gap-3 text-sm text-slate-800">
                <span className="flex items-center gap-2 font-medium">
                  Rayas diagonales
                  <Ayuda>Salen del color de fondo de la tarjeta: un tono más oscuro del mismo color.</Ayuda>
                </span>
                <Interruptor
                  activo={valor.rayas !== false}
                  onChange={(rayas) => onChange({ ...valor, rayas })}
                  etiqueta="Rayas diagonales"
                />
              </div>
            </>
          )}
          {/* Banner: la franja de abajo, donde va el texto, tiene su propio color */}
          {diseno === 'banner' && (
            <div className="mt-4">
              <CampoColor
                label="Color de la franja del texto"
                value={valor.color_franja ?? ''}
                onChange={(color_franja) => onChange({ ...valor, color_franja })}
                ayuda="Color de la franja inferior de la tarjeta, donde se ubica el texto. Si no se define, se utiliza un tono más oscuro del color de la tarjeta."
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
