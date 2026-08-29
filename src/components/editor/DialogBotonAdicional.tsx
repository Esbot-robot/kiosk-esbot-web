import { useRef, useState, type RefObject } from 'react'
import { Modal } from '../Modal'
import { AparienciaBoton } from './AparienciaBoton'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import type { BotonAdicionalInicial } from '../../types/config'

interface DialogBotonAdicionalProps {
  indice: number
  valor: BotonAdicionalInicial
  projectId: string
  onGuardar: (nuevo: BotonAdicionalInicial) => void
  onCerrar: () => void
}

const MAX_VIDEO_BYTES = 50 * 1024 * 1024
const MAX_BOTON = 20
const MAX_TTS = 300

/** Configura una de las dos acciones opcionales de la pantalla inicial. */
export function DialogBotonAdicional({
  indice,
  valor,
  projectId,
  onGuardar,
  onCerrar,
}: DialogBotonAdicionalProps) {
  const [boton, setBoton] = useState(() => structuredClone(valor))
  const [error, setError] = useState('')
  const [subiendoCampo, setSubiendoCampo] = useState('')
  const videoInput = useRef<HTMLInputElement>(null)
  const trayectoInput = useRef<HTMLInputElement>(null)

  async function subirVideo(campo: 'video_url' | 'video_trayecto_url', file?: File) {
    setError('')
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Selecciona un archivo de video MP4 o MOV.')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`El video pesa ${(file.size / 1024 / 1024).toFixed(1)}MB. El máximo es 50MB.`)
      return
    }
    setSubiendoCampo(campo)
    try {
      const url = await subirArchivo('media', rutaMedia(projectId, file.name), file)
      setBoton((actual) => ({ ...actual, [campo]: url }))
    } catch (e) {
      const detalle = e instanceof Error ? e.message : 'Error desconocido'
      setError(`No se pudo subir el video: ${detalle}`)
    } finally {
      setSubiendoCampo('')
    }
  }

  function guardar() {
    const texto = boton.boton.texto.trim()
    if (boton.activo && !texto) {
      setError('Escribe el texto que verá el visitante en el botón.')
      return
    }
    if (boton.activo && boton.accion === 'video' && !boton.video_url) {
      setError('Carga el video que reproducirá este botón.')
      return
    }
    if (boton.activo && boton.accion === 'video' && !boton.tts_despues_video.trim()) {
      setError('Escribe el texto que Temi dirá al terminar el video.')
      return
    }
    if (boton.activo && boton.accion === 'video' && !boton.tts_despedida.trim()) {
      setError('Escribe la despedida antes de que Temi reanude el patrullaje.')
      return
    }
    if (boton.activo && boton.accion === 'ir_ubicacion' && !boton.ubicacion.trim()) {
      setError('Escribe el nombre exacto de la ubicación creada en Temi.')
      return
    }
    if (boton.activo && boton.accion === 'ir_ubicacion' && !boton.tts_antes_de_ir.trim()) {
      setError('Escribe el texto que Temi dirá antes de iniciar el recorrido.')
      return
    }
    if (boton.activo && boton.accion === 'ir_ubicacion' && !boton.tts_al_llegar.trim()) {
      setError('Escribe el texto que Temi dirá al llegar a la ubicación.')
      return
    }
    if (boton.activo && boton.accion === 'ir_ubicacion' && !boton.tts_despedida.trim()) {
      setError('Escribe la despedida antes de que Temi reanude el patrullaje.')
      return
    }
    onGuardar({ ...boton, boton: { ...boton.boton, texto } })
    onCerrar()
  }

  const VideoUpload = ({
    campo,
    titulo,
    input,
  }: {
    campo: 'video_url' | 'video_trayecto_url'
    titulo: string
    input: RefObject<HTMLInputElement | null>
  }) => {
    const cargado = boton[campo]
    const subiendo = subiendoCampo === campo
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="font-medium text-slate-800">{titulo}</p>
        <p className="mt-1 text-sm text-slate-500">MP4 o MOV, máximo 50MB.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={Boolean(subiendoCampo)}
            onClick={() => input.current?.click()}
            className="rounded-md border border-indigo-300 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
          >
            {subiendo ? 'Subiendo...' : cargado ? 'Reemplazar video' : 'Cargar video'}
          </button>
          {cargado && (
            <>
              <span className="text-sm text-emerald-700">Video cargado</span>
              <button
                type="button"
                onClick={() => setBoton((actual) => ({ ...actual, [campo]: '' }))}
                className="text-sm font-medium text-rose-600 hover:text-rose-700"
              >
                Quitar
              </button>
            </>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            void subirVideo(campo, e.target.files?.[0])
            e.target.value = ''
          }}
        />
      </div>
    )
  }

  return (
    <Modal
      titulo={`Configurar botón adicional ${indice + 1}`}
      onCancelar={onCerrar}
      onAceptar={guardar}
      aceptarDeshabilitado={Boolean(subiendoCampo)}
      textoAceptar={subiendoCampo ? 'Subiendo video...' : 'Guardar botón'}
    >
      <div className="max-h-[62vh] space-y-5 overflow-y-auto pr-2">
        <label className="flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
          <input
            type="checkbox"
            checked={boton.activo}
            onChange={(e) => setBoton((actual) => ({ ...actual, activo: e.target.checked }))}
            className="h-4 w-4 accent-indigo-600"
          />
          <span>
            <span className="block font-semibold">Mostrar este botón</span>
            <span className="block text-sm text-slate-500">Los botones desactivados no aparecen en el robot.</span>
          </span>
        </label>

        <div>
          <p className="mb-2 font-medium text-slate-800">Texto del botón</p>
          <input
            value={boton.boton.texto}
            maxLength={MAX_BOTON}
            onChange={(e) =>
              setBoton((actual) => ({
                ...actual,
                boton: { ...actual.boton, texto: e.target.value.slice(0, MAX_BOTON) },
              }))
            }
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {boton.boton.texto.length} / {MAX_BOTON} caracteres
          </p>
        </div>

        <AparienciaBoton
          valor={boton.boton}
          projectId={projectId}
          onChange={(visual) => setBoton((actual) => ({ ...actual, boton: visual }))}
        />

        <div>
          <p className="mb-2 font-medium text-slate-800">Acción al tocar</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`cursor-pointer rounded-lg border p-4 ${
                boton.accion === 'video' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name={`accion-${boton.id}`}
                checked={boton.accion === 'video'}
                onChange={() => setBoton((actual) => ({ ...actual, accion: 'video' }))}
                className="mr-2 accent-indigo-600"
              />
              <span className="font-semibold text-slate-800">Reproducir video</span>
              <span className="mt-1 block text-sm text-slate-500">Pausa el contador hasta que termine.</span>
            </label>
            <label
              className={`cursor-pointer rounded-lg border p-4 ${
                boton.accion === 'ir_ubicacion' ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'
              }`}
            >
              <input
                type="radio"
                name={`accion-${boton.id}`}
                checked={boton.accion === 'ir_ubicacion'}
                onChange={() => setBoton((actual) => ({ ...actual, accion: 'ir_ubicacion' }))}
                className="mr-2 accent-indigo-600"
              />
              <span className="font-semibold text-slate-800">Ir a ubicación</span>
              <span className="mt-1 block text-sm text-slate-500">Guía al visitante y retoma el patrullaje.</span>
            </label>
          </div>
        </div>

        {boton.accion === 'video' ? (
          <>
            <VideoUpload campo="video_url" titulo="Video que se reproducirá" input={videoInput} />
            <div>
              <p className="mb-2 font-medium text-slate-800">Texto al terminar el video</p>
              <textarea
                value={boton.tts_despues_video}
                maxLength={MAX_TTS}
                rows={3}
                onChange={(e) =>
                  setBoton((actual) => ({ ...actual, tts_despues_video: e.target.value.slice(0, MAX_TTS) }))
                }
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-sm text-slate-500">
                Después de decirlo, continúa el contador que estaba pausado.
              </p>
            </div>
            <TtsField
              titulo="Despedida antes de reanudar patrullaje"
              value={boton.tts_despedida}
              onChange={(tts_despedida) => setBoton((actual) => ({ ...actual, tts_despedida }))}
            />
          </>
        ) : (
          <>
            <div>
              <p className="mb-2 font-medium text-slate-800">Ubicación de Temi</p>
              <input
                value={boton.ubicacion}
                onChange={(e) => setBoton((actual) => ({ ...actual, ubicacion: e.target.value }))}
                placeholder="Nombre exacto creado en Temi Center"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <TtsField
              titulo="Texto antes de iniciar el recorrido"
              value={boton.tts_antes_de_ir}
              onChange={(tts_antes_de_ir) => setBoton((actual) => ({ ...actual, tts_antes_de_ir }))}
            />
            <VideoUpload campo="video_trayecto_url" titulo="Video durante el trayecto (opcional)" input={trayectoInput} />
            <p className="-mt-3 text-sm text-slate-500">Si dura menos que el trayecto, se repetirá hasta llegar.</p>
            <TtsField
              titulo="Texto al llegar a la ubicación"
              value={boton.tts_al_llegar}
              onChange={(tts_al_llegar) => setBoton((actual) => ({ ...actual, tts_al_llegar }))}
            />
            <TtsField
              titulo="Despedida antes de reanudar patrullaje"
              value={boton.tts_despedida}
              onChange={(tts_despedida) => setBoton((actual) => ({ ...actual, tts_despedida }))}
            />
          </>
        )}
        {error && <p className="text-sm font-medium text-rose-600">{error}</p>}
      </div>
    </Modal>
  )
}

function TtsField({
  titulo,
  value,
  onChange,
}: {
  titulo: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-2 font-medium text-slate-800">{titulo}</p>
      <textarea
        value={value}
        maxLength={MAX_TTS}
        rows={3}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_TTS))}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <p className="mt-1 text-right text-sm text-slate-400">
        {value.length} / {MAX_TTS} caracteres
      </p>
    </div>
  )
}
