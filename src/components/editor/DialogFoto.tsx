import { useRef, useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { AparienciaBoton } from './AparienciaBoton'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import type { BotonFoto } from '../../types/config'

interface DialogFotoProps {
  valor: BotonFoto
  projectId: string
  /** token de la galería del evento; llega de la columna galeria_token */
  galeriaToken?: string | null
  onGuardar: (nuevo: BotonFoto) => void
  onCerrar: () => void
}

const MAX_MARCO_BYTES = 3 * 1024 * 1024
const MAX_BOTON = 20
const MAX_TEXTO = 300
const MAX_WA_MENSAJE = 200
/** límites físicos de la cabeza del robot según el SDK de temi */
const MIN_INCLINACION = -30
const MAX_INCLINACION = 50

/** Deja el valor escrito dentro del rango del robot; vacío o inválido vuelve a 0 */
function limitarInclinacion(valor: string): number {
  const grados = Math.round(Number(valor))
  if (!Number.isFinite(grados)) return 0
  return Math.min(MAX_INCLINACION, Math.max(MIN_INCLINACION, grados))
}

/** Así queda el mensaje que enviará el visitante (ejemplo con la foto #47) */
function ejemploMensaje(plantilla: string): string {
  const conNumero = plantilla.includes('{numero}')
    ? plantilla.replace(/\{numero\}/g, '47')
    : `${plantilla} #47`
  return conNumero.trim()
}

/** Configura el botón "Tomar foto": apariencia, marco de la promo y texto */
export function DialogFoto({ valor, projectId, galeriaToken, onGuardar, onCerrar }: DialogFotoProps) {
  const [foto, setFoto] = useState(() => structuredClone(valor))
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const inputMarco = useRef<HTMLInputElement>(null)

  const enlaceGaleria = galeriaToken ? `${window.location.origin}/galeria#${galeriaToken}` : ''

  async function subirMarco(file?: File) {
    setError('')
    if (!file) return
    if (file.type !== 'image/png') {
      setError('El marco debe ser un PNG con el hueco de la foto transparente.')
      return
    }
    if (file.size > MAX_MARCO_BYTES) {
      setError(`El marco pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El máximo es 3MB.`)
      return
    }
    setSubiendo(true)
    try {
      const marco_url = await subirArchivo('media', rutaMedia(projectId, file.name), file, 'image/png')
      setFoto((actual) => ({ ...actual, marco_url }))
    } catch (e) {
      const detalle = e instanceof Error ? e.message : 'Error desconocido'
      setError(`No se pudo subir el marco: ${detalle}`)
    } finally {
      setSubiendo(false)
    }
  }

  async function copiarEnlace() {
    try {
      await navigator.clipboard.writeText(enlaceGaleria)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      setError('No se pudo copiar. Selecciona el enlace y cópialo a mano.')
    }
  }

  function guardar() {
    const texto = foto.boton.texto.trim()
    if (foto.activo && !texto) {
      setError('Escribe el texto que verá el visitante en el botón.')
      return
    }
    if (foto.activo && !foto.marco_url) {
      setError('Carga el marco de la promo que se aplicará a la foto.')
      return
    }
    if (foto.activo && !foto.texto.trim()) {
      setError('Escribe el texto que el robot mostrará y dirá con el número.')
      return
    }
    if (foto.activo && foto.whatsapp_activo) {
      const soloDigitos = foto.whatsapp_numero.replace(/\D/g, '')
      if (soloDigitos.length < 10 || soloDigitos.length > 15) {
        setError('Escribe el número de WhatsApp con indicativo de país, solo dígitos. Ej: 573108676490')
        return
      }
      if (!foto.whatsapp_mensaje.trim()) {
        setError('Escribe el mensaje que enviará el visitante por WhatsApp.')
        return
      }
    }
    onGuardar({
      ...foto,
      boton: { ...foto.boton, texto },
      texto: foto.texto.trim(),
      whatsapp_numero: foto.whatsapp_numero.replace(/\D/g, ''),
      whatsapp_mensaje: foto.whatsapp_mensaje.trim(),
    })
    onCerrar()
  }

  return (
    <Modal
      titulo="Configurar botón Tomar foto"
      onCancelar={onCerrar}
      onAceptar={guardar}
      aceptarDeshabilitado={subiendo}
      textoAceptar={subiendo ? 'Subiendo marco...' : 'Guardar botón'}
    >
      <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-2">
        <label className="relative flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
          <input
            type="checkbox"
            checked={foto.activo}
            onChange={(e) => setFoto((actual) => ({ ...actual, activo: e.target.checked }))}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="flex items-center gap-2 font-semibold">
            Mostrar este botón
            <Ayuda>Los botones desactivados no aparecen en el robot.</Ayuda>
          </span>
        </label>

        <div>
          <p className="mb-2 font-medium text-slate-800">Texto del botón</p>
          <input
            value={foto.boton.texto}
            maxLength={MAX_BOTON}
            onChange={(e) =>
              setFoto((actual) => ({
                ...actual,
                boton: { ...actual.boton, texto: e.target.value.slice(0, MAX_BOTON) },
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {foto.boton.texto.length} / {MAX_BOTON} caracteres
          </p>
        </div>

        {/* Píldora o tarjeta, colores e imagen de la tarjeta */}
        <AparienciaBoton
          valor={foto.boton}
          projectId={projectId}
          onChange={(visual) => setFoto((actual) => ({ ...actual, boton: visual }))}
        />

        {/* Marco de la promo */}
        <div className="relative rounded-lg border border-slate-200 p-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Marco de la promo
            <Ayuda>
              PNG de 1200 × 1800 px (vertical), con el hueco de la foto transparente y sin
              transparencias por fuera del marco. Máximo 3MB.
            </Ayuda>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={subiendo}
              onClick={() => inputMarco.current?.click()}
              className="rounded-md border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              {subiendo ? 'Subiendo...' : foto.marco_url ? 'Reemplazar marco' : 'Cargar marco'}
            </button>
            {foto.marco_url && (
              <>
                <span className="text-sm text-emerald-700">Marco cargado</span>
                <button
                  type="button"
                  onClick={() => setFoto((actual) => ({ ...actual, marco_url: '' }))}
                  className="text-sm font-medium text-rose-600 hover:text-rose-700"
                >
                  Quitar
                </button>
              </>
            )}
          </div>
          {foto.marco_url && (
            <img
              src={foto.marco_url}
              alt="Marco cargado"
              className="mt-3 h-40 w-auto rounded-md border border-slate-200 bg-slate-100 object-contain"
            />
          )}
          <input
            ref={inputMarco}
            type="file"
            accept="image/png"
            className="hidden"
            onChange={(e) => {
              void subirMarco(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>

        {/* Texto que se muestra y se dice */}
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Texto al mostrar la foto
            <Ayuda>
              Se muestra en pantalla junto al número y el robot lo dice en voz alta. Debe indicar
              dónde reclamar la foto y mencionar el número que aparece en pantalla.
            </Ayuda>
          </p>
          <textarea
            value={foto.texto}
            maxLength={MAX_TEXTO}
            rows={3}
            onChange={(e) => setFoto((actual) => ({ ...actual, texto: e.target.value.slice(0, MAX_TEXTO) }))}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {foto.texto.length} / {MAX_TEXTO} caracteres
          </p>
        </div>

        {/* QR de WhatsApp */}
        <div className="rounded-lg border border-slate-200 p-4">
          <label className="relative flex items-center gap-3 text-slate-800">
            <input
              type="checkbox"
              checked={foto.whatsapp_activo}
              onChange={(e) => setFoto((actual) => ({ ...actual, whatsapp_activo: e.target.checked }))}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="flex items-center gap-2 font-semibold">
              Mostrar QR de WhatsApp
              <Ayuda>El visitante lo escanea y envía el mensaje con el número de su foto.</Ayuda>
            </span>
          </label>

          {foto.whatsapp_activo && (
            <div className="mt-4 space-y-4">
              <div className="relative">
                <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                  Número que recibe los mensajes
                  <Ayuda>
                    Con indicativo de país y sin espacios ni signos. Colombia: 57 + celular.
                  </Ayuda>
                </p>
                <input
                  value={foto.whatsapp_numero}
                  inputMode="numeric"
                  placeholder="573108676490"
                  onChange={(e) =>
                    setFoto((actual) => ({
                      ...actual,
                      whatsapp_numero: e.target.value.replace(/\D/g, '').slice(0, 15),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                  Mensaje que enviará el visitante
                  <Ayuda>
                    Escribe <span className="font-mono">{'{numero}'}</span> donde quieras que
                    aparezca el número de la foto. Si no lo pones, se agrega al final.
                  </Ayuda>
                </p>
                <textarea
                  value={foto.whatsapp_mensaje}
                  maxLength={MAX_WA_MENSAJE}
                  rows={2}
                  onChange={(e) =>
                    setFoto((actual) => ({
                      ...actual,
                      whatsapp_mensaje: e.target.value.slice(0, MAX_WA_MENSAJE),
                    }))
                  }
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Así lo verá: <span className="font-medium">{ejemploMensaje(foto.whatsapp_mensaje)}</span>
                </p>
                <p className="mt-1 text-right text-sm text-slate-400">
                  {foto.whatsapp_mensaje.length} / {MAX_WA_MENSAJE} caracteres
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tiempo en pantalla */}
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Tiempo en pantalla
            <Ayuda>Tiempo de lectura y captura del número/QR por parte del visitante.</Ayuda>
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={5}
              max={30}
              value={foto.segundos_pantalla}
              onChange={(e) =>
                setFoto((actual) => ({
                  ...actual,
                  segundos_pantalla: Math.min(30, Math.max(5, Number(e.target.value) || 10)),
                }))
              }
              className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-slate-600">segundos</span>
          </div>
        </div>

        {/* Inclinación de la cabeza: la cámara va en ella, así que define el encuadre */}
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Inclinación de la pantalla
            <Ayuda>
              Ángulo de la cabeza al tomar la foto. 0 = pantalla derecha, positivo sube la cámara
              ({MIN_INCLINACION} a {MAX_INCLINACION}).
            </Ayuda>
          </p>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={MIN_INCLINACION}
              max={MAX_INCLINACION}
              step={5}
              value={foto.inclinacion_pantalla}
              onChange={(e) =>
                setFoto((actual) => ({
                  ...actual,
                  inclinacion_pantalla: limitarInclinacion(e.target.value),
                }))
              }
              className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
            />
            <span className="text-slate-600">grados</span>
          </div>
        </div>

        {/* Enlace de la galería para el cliente */}
        {foto.activo && (
          <div className="relative rounded-lg border border-indigo-200 bg-indigo-50 p-4">
            <p className="flex items-center gap-2 font-medium text-slate-800">
              Enlace de la galería para el cliente
              <Ayuda>Enlace exclusivo para ver galería. Mantener en privado.</Ayuda>
            </p>
            {enlaceGaleria ? (
              <>
                <div className="mt-3 flex gap-2">
                  <input
                    readOnly
                    value={enlaceGaleria}
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-700"
                  />
                  <button
                    type="button"
                    onClick={() => void copiarEnlace()}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                  >
                    {copiado ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-amber-700">
                Este proyecto todavía no tiene enlace de galería. Se genera al crear la columna
                galeria_token en Supabase.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}
