import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalPestanas } from '../ModalPestanas'
import { Ayuda } from '../Ayuda'
import { Interruptor } from '../Interruptor'
import { AparienciaBoton } from './AparienciaBoton'
import { CargadorArchivo } from './CargadorArchivo'
import { IconoCamara, IconoPaleta, IconoQr, IconoReloj } from '../iconosPopup'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import { describirError } from '../../lib/errores'
import { CampoTexto, ConfigFormulario } from './ConfigFormulario'
import { limpiarFormulario, MAX_DESPEDIDA, validarFormulario } from '../../lib/formulario'
import { Advertencia } from '../Advertencia'
import {
  FRASE_PREPARACION_DEFECTO,
  SEGUNDOS_PANTALLA_MAX,
  SEGUNDOS_PANTALLA_MIN,
  type BotonFoto,
  type EntregaFoto,
} from '../../types/config'

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
const MAX_FRASE = 150
/** segundos de la cuenta regresiva antes de la foto */
const MIN_CUENTA = 3
const MAX_CUENTA = 15
const MAX_WA_MENSAJE = 200

type Pestana = 'apariencia' | 'captura' | 'resultado' | 'cierre'

const PESTANAS = [
  { id: 'apariencia', etiqueta: 'Apariencia', icono: <IconoPaleta /> },
  { id: 'captura', etiqueta: 'Captura', icono: <IconoCamara /> },
  { id: 'resultado', etiqueta: 'Resultado', icono: <IconoQr /> },
  { id: 'cierre', etiqueta: 'Cierre', icono: <IconoReloj /> },
]

const ENTREGAS: { valor: EntregaFoto; label: string; detalle: string }[] = [
  { valor: 'ninguna', label: 'Sin código QR', detalle: 'Se muestra únicamente el número de la foto.' },
  { valor: 'whatsapp', label: 'WhatsApp', detalle: 'El visitante envía un mensaje con el número de su foto.' },
  {
    valor: 'registro',
    label: 'Formulario de registro',
    detalle: 'El visitante registra sus datos y descarga la foto.',
  },
]
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

/** Etiqueta de un campo dentro de una pestaña */
function Titulo({ children, ayuda }: { children: React.ReactNode; ayuda?: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
      {children}
      {ayuda && <Ayuda>{ayuda}</Ayuda>}
    </p>
  )
}

/** Campo numérico con su unidad al lado */
function CampoNumero({
  valor,
  min,
  max,
  paso,
  unidad,
  onChange,
}: {
  valor: number
  min: number
  max: number
  paso?: number
  unidad: string
  onChange: (valor: string) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <span className="text-slate-500">{unidad}</span>
    </div>
  )
}

/** Configura el botón "Tomar foto": apariencia, captura, resultado y cierre */
export function DialogFoto({ valor, projectId, galeriaToken, onGuardar, onCerrar }: DialogFotoProps) {
  const [foto, setFoto] = useState(() => structuredClone(valor))
  const [pestana, setPestana] = useState<Pestana>('apariencia')
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const enlaceGaleria = galeriaToken ? `${window.location.origin}/galeria#${galeriaToken}` : ''

  async function subirMarco(file?: File) {
    setError('')
    if (!file) return
    if (file.type !== 'image/png') {
      setError('El marco debe ser un archivo PNG con el área de la foto transparente.')
      return
    }
    if (file.size > MAX_MARCO_BYTES) {
      setError(`El marco pesa ${(file.size / 1024 / 1024).toFixed(1)} MB. El máximo permitido es 3 MB.`)
      return
    }
    setSubiendo(true)
    try {
      const marco_url = await subirArchivo('media', rutaMedia(projectId, file.name), file, { contentType: 'image/png' })
      setFoto((actual) => ({ ...actual, marco_url }))
    } catch (e) {
      setError(`No fue posible subir el marco. ${describirError(e)}`)
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
      setError('No fue posible copiar el enlace. Selecciónelo y cópielo manualmente.')
    }
  }

  /** Muestra el error y lleva a la pestaña donde se corrige */
  function fallar(en: Pestana, mensaje: string) {
    setPestana(en)
    setError(mensaje)
  }

  function guardar() {
    const texto = foto.boton.texto.trim()
    if (foto.activo) {
      if (!texto) return fallar('apariencia', 'Ingrese la etiqueta del botón.')
      if (!foto.marco_url) return fallar('captura', 'Cargue el marco de la promoción que se aplicará a la foto.')
      if (!foto.texto.trim()) {
        return fallar('resultado', 'Ingrese el texto que el robot mostrará y reproducirá junto al número.')
      }
      if (foto.entrega === 'whatsapp') {
        const soloDigitos = foto.whatsapp_numero.replace(/\D/g, '')
        if (soloDigitos.length < 10 || soloDigitos.length > 15) {
          return fallar('resultado', 'Ingrese el número de WhatsApp con indicativo de país, solo dígitos. Ejemplo: 573108676490.')
        }
        if (!foto.whatsapp_mensaje.trim()) {
          return fallar('resultado', 'Ingrese el mensaje que enviará el visitante por WhatsApp.')
        }
      }
      if (foto.entrega === 'registro') {
        const errorFormulario = validarFormulario(foto.formulario, foto.despedida_nombre)
        if (errorFormulario) return fallar('resultado', errorFormulario)
      }
    }
    onGuardar({
      ...foto,
      // Las apps anteriores solo conocen whatsapp_activo: con registro no
      // muestran QR, que es lo más seguro mientras se actualizan
      whatsapp_activo: foto.entrega === 'whatsapp',
      despedida: foto.despedida.trim(),
      despedida_nombre: foto.despedida_nombre.trim(),
      formulario: limpiarFormulario(foto.formulario),
      boton: { ...foto.boton, texto },
      texto: foto.texto.trim(),
      // Vacía = la frase de siempre, para que el robot nunca cuente en silencio
      frase_preparacion: foto.frase_preparacion.trim() || FRASE_PREPARACION_DEFECTO,
      whatsapp_numero: foto.whatsapp_numero.replace(/\D/g, ''),
      whatsapp_mensaje: foto.whatsapp_mensaje.trim(),
    })
    onCerrar()
  }

  return (
    <ModalPestanas
      titulo="Configuración del botón Tomar foto"
      ayuda="El robot toma la foto del visitante, la inserta en el marco de la promoción y le asigna un número para reclamarla en el stand."
      pestanas={PESTANAS}
      activa={pestana}
      onCambiar={(id) => setPestana(id as Pestana)}
      onCancelar={onCerrar}
      onAceptar={guardar}
      aceptarDeshabilitado={subiendo}
      textoAceptar={subiendo ? 'Subiendo marco...' : 'Guardar'}
      aviso={error}
    >
      {/* ───────── Apariencia ───────── */}
      {pestana === 'apariencia' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 font-medium text-slate-800">
              Botón habilitado
              <Ayuda>Los botones deshabilitados no se muestran en el robot.</Ayuda>
            </span>
            <Interruptor
              activo={foto.activo}
              onChange={(activo) => setFoto((actual) => ({ ...actual, activo }))}
              etiqueta="Botón habilitado"
            />
          </div>

          <div>
            <Titulo>Etiqueta del botón</Titulo>
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
              {foto.boton.texto.length} / {MAX_BOTON}
            </p>
          </div>

          {/* Píldora o tarjeta, colores e imagen de la tarjeta */}
          <AparienciaBoton
            valor={foto.boton}
            projectId={projectId}
            onChange={(visual) => setFoto((actual) => ({ ...actual, boton: visual }))}
          />
        </div>
      )}

      {/* ───────── Captura ───────── */}
      {pestana === 'captura' && (
        <div className="space-y-5">
          {/* Marco de la promoción */}
          <div className="rounded-lg border border-slate-200 p-4">
            <Titulo ayuda="PNG de 1200 × 1800 px (vertical), con el área de la foto transparente y sin transparencias fuera del marco. Máximo 3 MB.">
              Marco de la promoción
            </Titulo>
            <div className="mt-3">
              <CargadorArchivo
                entidad="marco"
                tipo="marco"
                etiquetaCarga="Cargar marco"
                detalle="PNG de 1200 × 1800 px (máx. 3 MB)"
                accept="image/png"
                url={foto.marco_url}
                subiendo={subiendo}
                onElegir={(archivo) => void subirMarco(archivo)}
                onQuitar={() => setFoto((actual) => ({ ...actual, marco_url: '' }))}
              />
            </div>
          </div>

          <div>
            <Titulo ayuda={`Segundos de los que dispone el visitante para ubicarse antes de la captura (${MIN_CUENTA} a ${MAX_CUENTA}).`}>
              Cuenta regresiva
            </Titulo>
            <CampoNumero
              valor={foto.segundos_cuenta}
              min={MIN_CUENTA}
              max={MAX_CUENTA}
              unidad="segundos"
              onChange={(v) =>
                setFoto((actual) => ({
                  ...actual,
                  segundos_cuenta: Math.min(MAX_CUENTA, Math.max(MIN_CUENTA, Number(v) || 10)),
                }))
              }
            />
          </div>

          <div>
            <Titulo ayuda="Lo reproduce el robot al iniciar la cuenta regresiva. Si se deja vacío, se utiliza el mensaje predeterminado.">
              Mensaje de preparación
            </Titulo>
            <textarea
              value={foto.frase_preparacion}
              maxLength={MAX_FRASE}
              rows={2}
              placeholder={FRASE_PREPARACION_DEFECTO}
              onChange={(e) =>
                setFoto((actual) => ({ ...actual, frase_preparacion: e.target.value.slice(0, MAX_FRASE) }))
              }
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-right text-sm text-slate-400">
              {foto.frase_preparacion.length} / {MAX_FRASE} caracteres
            </p>
          </div>

          {/* Inclinación de la cabeza: la cámara va en ella, así que define el encuadre */}
          <div>
            <Titulo ayuda={`Ángulo de la cabeza del robot durante la captura. 0 corresponde a la pantalla recta; los valores positivos elevan la cámara (de ${MIN_INCLINACION} a ${MAX_INCLINACION}).`}>
              Inclinación de la pantalla
            </Titulo>
            <CampoNumero
              valor={foto.inclinacion_pantalla}
              min={MIN_INCLINACION}
              max={MAX_INCLINACION}
              paso={5}
              unidad="grados"
              onChange={(v) => setFoto((actual) => ({ ...actual, inclinacion_pantalla: limitarInclinacion(v) }))}
            />
          </div>
        </div>
      )}

      {/* ───────── Resultado ───────── */}
      {pestana === 'resultado' && (
        <div className="space-y-5">
          <div>
            <Titulo ayuda="Se muestra en pantalla junto al número y se reproduce por voz. Debe indicar dónde reclamar la foto y mencionar el número que aparece en pantalla.">
              Texto al mostrar la foto
            </Titulo>
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

          {/* Código QR que acompaña la foto */}
          <div>
            <Titulo ayuda="Se muestra junto al número en la pantalla de resultado.">Código QR con la foto</Titulo>
            <div className="space-y-2">
              {ENTREGAS.map(({ valor, label, detalle }) => (
                <label
                  key={valor}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 ${
                    foto.entrega === valor ? 'border-[#1d293d] bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="entrega-foto"
                    checked={foto.entrega === valor}
                    onChange={() => setFoto((actual) => ({ ...actual, entrega: valor }))}
                    className="mt-1 h-4 w-4 accent-[#1d293d]"
                  />
                  <span>
                    <span className="block font-medium text-slate-800">{label}</span>
                    <span className="block text-sm text-slate-500">{detalle}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {foto.entrega === 'whatsapp' && (
            <>
              <div>
                <Titulo ayuda="Con indicativo de país, sin espacios ni signos. Colombia: 57 + número de celular.">
                  Número que recibe los mensajes
                </Titulo>
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

              <div>
                <Titulo
                  ayuda={
                    <>
                      Utilice <span className="font-mono">{'{numero}'}</span> para incluir el número de la foto. Si se
                      omite, se agrega al final del mensaje.
                    </>
                  }
                >
                  Mensaje del visitante
                </Titulo>
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
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500">
                  {ejemploMensaje(foto.whatsapp_mensaje)}
                </p>
                <p className="mt-1 text-right text-sm text-slate-400">
                  {foto.whatsapp_mensaje.length} / {MAX_WA_MENSAJE} caracteres
                </p>
              </div>
            </>
          )}

          {foto.entrega === 'registro' && (
            <>
              <Link
                to={`/contactos?proyecto=${projectId}`}
                className="inline-block text-sm font-semibold text-indigo-600 hover:underline"
              >
                Ver contactos registrados →
              </Link>
              <ConfigFormulario
                origen="foto"
                valor={foto.formulario}
                onChange={(formulario) => setFoto((actual) => ({ ...actual, formulario }))}
              />
              <CampoTexto
                label="Mensaje de despedida con nombre"
                ayuda={
                  <>
                    Se reproduce si el visitante se registra antes de que finalice el tiempo en pantalla. Utilice{' '}
                    <span className="font-mono">{'{nombre}'}</span> para incluir su primer nombre.
                  </>
                }
                valor={foto.despedida_nombre}
                max={MAX_DESPEDIDA}
                filas={2}
                onChange={(despedida_nombre) => setFoto((actual) => ({ ...actual, despedida_nombre }))}
              />
            </>
          )}
        </div>
      )}

      {/* ───────── Cierre ───────── */}
      {pestana === 'cierre' && (
        <div className="space-y-5">
          <div>
            <Titulo
              ayuda={`Tiempo disponible para leer y capturar el número o el código QR (${SEGUNDOS_PANTALLA_MIN} a ${SEGUNDOS_PANTALLA_MAX} segundos). Con formulario de registro se recomienda un tiempo mayor.`}
            >
              Tiempo en pantalla
            </Titulo>
            <CampoNumero
              valor={foto.segundos_pantalla}
              min={SEGUNDOS_PANTALLA_MIN}
              max={SEGUNDOS_PANTALLA_MAX}
              unidad="segundos"
              onChange={(v) =>
                setFoto((actual) => ({
                  ...actual,
                  segundos_pantalla: Math.min(SEGUNDOS_PANTALLA_MAX, Math.max(SEGUNDOS_PANTALLA_MIN, Number(v) || 10)),
                }))
              }
            />
          </div>

          <CampoTexto
            label={foto.entrega === 'registro' ? 'Mensaje de despedida sin nombre' : 'Mensaje de despedida'}
            ayuda={
              foto.entrega === 'registro'
                ? 'Se reproduce al finalizar el tiempo si nadie se registró. Vacío: no se reproduce ningún mensaje.'
                : 'Se reproduce al finalizar el tiempo en pantalla, antes de retomar el recorrido. Vacío: no se reproduce ningún mensaje.'
            }
            valor={foto.despedida}
            max={MAX_DESPEDIDA}
            filas={2}
            onChange={(despedida) => setFoto((actual) => ({ ...actual, despedida }))}
          />

          {/* Enlace de la galería para el cliente */}
          {foto.activo && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <Titulo ayuda="Enlace exclusivo para consultar la galería. Debe mantenerse en privado.">
                Enlace de la galería para el cliente
              </Titulo>
              {enlaceGaleria ? (
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
                    className="rounded-lg bg-[#1d293d] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    {copiado ? 'Copiado ✓' : 'Copiar'}
                  </button>
                </div>
              ) : (
                <Advertencia className="mt-1">
                  Este proyecto aún no tiene enlace de galería. Se genera al crear la columna galeria_token en Supabase.
                </Advertencia>
              )}
            </div>
          )}
        </div>
      )}
    </ModalPestanas>
  )
}
