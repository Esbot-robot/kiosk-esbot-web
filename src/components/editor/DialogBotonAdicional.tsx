import { useEffect, useRef, useState } from 'react'
import { ModalPestanas } from '../ModalPestanas'
import { Ayuda } from '../Ayuda'
import { BarraSubida } from '../BarraSubida'
import { Interruptor } from '../Interruptor'
import { AparienciaBoton } from './AparienciaBoton'
import { CargadorArchivo } from './CargadorArchivo'
import { IconoPaleta, IconoPlay, IconoSecuencia, IconoUbicacion, IconoVideo, IconoVoz } from '../iconosPopup'
import { formatoMB, nombreDesdeUrl, rutaMedia, subirArchivo, type ProgresoSubida } from '../../lib/storage'
import { describirError } from '../../lib/errores'
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

type Pestana = 'apariencia' | 'accion' | 'voces'

const PESTANAS = [
  { id: 'apariencia', etiqueta: 'Apariencia', icono: <IconoPaleta /> },
  { id: 'accion', etiqueta: 'Acción', icono: <IconoPlay /> },
  { id: 'voces', etiqueta: 'Mensajes de voz', icono: <IconoVoz /> },
]

const ACCIONES: {
  valor: BotonAdicionalInicial['accion']
  etiqueta: string
  ayuda: string
  icono: React.ReactNode
}[] = [
  {
    valor: 'video',
    etiqueta: 'Reproducir video',
    ayuda: 'Pausa el contador de reanudación hasta que el video finalice.',
    icono: <IconoVideo className="h-5 w-5" />,
  },
  {
    valor: 'ir_ubicacion',
    etiqueta: 'Ir a una ubicación',
    ayuda: 'Guía al visitante hasta la ubicación y, luego, retoma el recorrido.',
    icono: <IconoUbicacion />,
  },
  {
    valor: 'secuencia',
    etiqueta: 'Reproducir secuencia',
    ayuda: 'Ejecuta una secuencia de Temi Center y pausa el contador de reanudación hasta que finalice.',
    icono: <IconoSecuencia />,
  },
]

/** Configura una de las dos acciones opcionales de la pantalla inicial. */
export function DialogBotonAdicional({
  indice,
  valor,
  projectId,
  onGuardar,
  onCerrar,
}: DialogBotonAdicionalProps) {
  const [boton, setBoton] = useState(() => structuredClone(valor))
  const [pestana, setPestana] = useState<Pestana>('apariencia')
  const [error, setError] = useState('')
  const [subiendoCampo, setSubiendoCampo] = useState('')
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)
  const cancelador = useRef<AbortController | null>(null)

  // Si el diálogo se cierra a mitad de la subida, la subida se cancela
  useEffect(() => () => cancelador.current?.abort(), [])

  async function subirVideo(campo: 'video_url' | 'video_trayecto_url', file?: File) {
    setError('')
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Seleccione un archivo de video en formato MP4 o MOV.')
      return
    }
    if (file.size > MAX_VIDEO_BYTES) {
      setError(`El video pesa ${formatoMB(file.size)}. El máximo permitido es 50 MB.`)
      return
    }
    const controlador = new AbortController()
    cancelador.current = controlador
    setSubiendoCampo(campo)
    setProgreso(null)
    try {
      const url = await subirArchivo('media', rutaMedia(projectId, file.name), file, {
        onProgreso: setProgreso,
        signal: controlador.signal,
      })
      setBoton((actual) => ({ ...actual, [campo]: url }))
    } catch (e) {
      if (controlador.signal.aborted) return
      setError(`No fue posible subir el video. ${describirError(e)}`)
    } finally {
      cancelador.current = null
      setSubiendoCampo('')
    }
  }

  /** Muestra el error y lleva a la pestaña donde se corrige */
  function fallar(en: Pestana, mensaje: string) {
    setPestana(en)
    setError(mensaje)
  }

  function guardar() {
    const texto = boton.boton.texto.trim()
    if (!boton.activo) {
      onGuardar({ ...boton, boton: { ...boton.boton, texto } })
      onCerrar()
      return
    }
    if (!texto) return fallar('apariencia', 'Ingrese la etiqueta del botón.')

    if (boton.accion === 'video') {
      if (!boton.video_url) return fallar('accion', 'Cargue el video que reproducirá este botón.')
      if (!boton.tts_despues_video.trim()) {
        return fallar('voces', 'Ingrese el mensaje que se reproducirá al finalizar el video.')
      }
      if (!boton.tts_despedida.trim()) {
        return fallar('voces', 'Ingrese el mensaje de despedida previo a la reanudación del recorrido.')
      }
    }
    if (boton.accion === 'secuencia') {
      if (!boton.secuencia?.trim()) {
        return fallar('accion', 'Ingrese el nombre exacto de la secuencia creada en Temi Center.')
      }
      if (!boton.tts_despues_video.trim()) {
        return fallar('voces', 'Ingrese el mensaje que se reproducirá al finalizar la secuencia.')
      }
      if (!boton.tts_despedida.trim()) {
        return fallar('voces', 'Ingrese el mensaje de despedida previo a la reanudación del recorrido.')
      }
    }
    if (boton.accion === 'ir_ubicacion') {
      if (!boton.ubicacion.trim()) return fallar('accion', 'Ingrese el nombre exacto de la ubicación creada en Temi.')
      if (!boton.tts_antes_de_ir.trim()) {
        return fallar('voces', 'Ingrese el mensaje que se reproducirá antes de iniciar el desplazamiento.')
      }
      if (!boton.tts_al_llegar.trim()) {
        return fallar('voces', 'Ingrese el mensaje que se reproducirá al llegar a la ubicación.')
      }
      if (!boton.tts_despedida.trim()) {
        return fallar('voces', 'Ingrese el mensaje de despedida previo a la reanudación del recorrido.')
      }
    }
    onGuardar({ ...boton, boton: { ...boton.boton, texto } })
    onCerrar()
  }

  const VideoUpload = ({
    campo,
    titulo,
    ayudaExtra,
  }: {
    campo: 'video_url' | 'video_trayecto_url'
    titulo: string
    /** se suma a la ayuda de formato, para lo propio de cada video */
    ayudaExtra?: string
  }) => {
    const cargado = boton[campo]
    const subiendo = subiendoCampo === campo
    return (
      <div className="rounded-lg border border-slate-200 p-4">
        <p className="mb-3 flex items-center gap-2 font-medium text-slate-800">
          {titulo}
          <Ayuda>MP4 o MOV, máximo 50 MB.{ayudaExtra ? ` ${ayudaExtra}` : ''}</Ayuda>
        </p>
        <CargadorArchivo
          entidad="video"
          tipo="video"
          etiquetaCarga="Cargar video"
          detalle="MP4 o MOV (máx. 50 MB)"
          accept="video/mp4,video/quicktime"
          url={cargado}
          nombre={cargado ? nombreDesdeUrl(cargado) : undefined}
          subiendo={subiendo}
          estadoSubida={<BarraSubida progreso={progreso} />}
          deshabilitado={Boolean(subiendoCampo)}
          onElegir={(archivo) => void subirVideo(campo, archivo)}
          onQuitar={() => setBoton((actual) => ({ ...actual, [campo]: '' }))}
        />
      </div>
    )
  }

  return (
    <ModalPestanas
      titulo={`Configuración del botón adicional ${indice + 1}`}
      ayuda="Acción opcional de la pantalla inicial: reproduce un video, guía al visitante a una ubicación o ejecuta una secuencia de Temi Center."
      pestanas={PESTANAS}
      activa={pestana}
      onCambiar={(id) => setPestana(id as Pestana)}
      onCancelar={onCerrar}
      onAceptar={guardar}
      aceptarDeshabilitado={Boolean(subiendoCampo)}
      textoAceptar={subiendoCampo ? 'Subiendo video...' : 'Guardar'}
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
              activo={boton.activo}
              onChange={(activo) => setBoton((actual) => ({ ...actual, activo }))}
              etiqueta="Botón habilitado"
            />
          </div>

          <div>
            <p className="mb-2 font-medium text-slate-800">Etiqueta del botón</p>
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
              {boton.boton.texto.length} / {MAX_BOTON}
            </p>
          </div>

          <AparienciaBoton
            valor={boton.boton}
            projectId={projectId}
            onChange={(visual) => setBoton((actual) => ({ ...actual, boton: visual }))}
          />
        </div>
      )}

      {/* ───────── Acción ───────── */}
      {pestana === 'accion' && (
        <div className="space-y-5">
          <div>
            <p className="mb-2 font-medium text-slate-800">Acción al seleccionar</p>
            {/* Selector en una sola fila: la opción elegida muestra su texto; las demás, solo el icono */}
            <div
              role="radiogroup"
              aria-label="Acción al seleccionar"
              className="inline-flex max-w-full gap-1 rounded-full border border-slate-200 bg-white p-1"
            >
              {ACCIONES.map(({ valor: accion, etiqueta, icono }) => {
                const elegida = boton.accion === accion
                return (
                  <button
                    key={accion}
                    type="button"
                    role="radio"
                    aria-checked={elegida}
                    aria-label={etiqueta}
                    title={etiqueta}
                    onClick={() => setBoton((actual) => ({ ...actual, accion }))}
                    className={`flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-semibold transition-colors ${
                      elegida
                        ? 'bg-[#1d293d] px-5 text-white'
                        : 'w-11 text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {icono}
                    {elegida && etiqueta}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-sm text-slate-500">{ACCIONES.find((a) => a.valor === boton.accion)?.ayuda}</p>
          </div>

          {boton.accion === 'secuencia' && (
            <div>
              <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                Secuencia de Temi
                <Ayuda>
                  Nombre exacto de la secuencia creada en Temi Center. Requiere conexión a internet en el robot.
                </Ayuda>
              </p>
              <input
                value={boton.secuencia ?? ''}
                onChange={(e) => setBoton((actual) => ({ ...actual, secuencia: e.target.value }))}
                placeholder="Nombre exacto en Temi Center"
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          )}

          {boton.accion === 'video' && (
            <VideoUpload campo="video_url" titulo="Video a reproducir" />
          )}

          {boton.accion === 'ir_ubicacion' && (
            <>
              <div>
                <p className="mb-2 font-medium text-slate-800">Ubicación de Temi</p>
                <input
                  value={boton.ubicacion}
                  onChange={(e) => setBoton((actual) => ({ ...actual, ubicacion: e.target.value }))}
                  placeholder="Nombre exacto en Temi Center"
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <VideoUpload
                campo="video_trayecto_url"
                titulo="Video durante el trayecto (opcional)"
                ayudaExtra="Si su duración es menor que la del trayecto, se repite hasta llegar."
              />
            </>
          )}
        </div>
      )}

      {/* ───────── Mensajes de voz ───────── */}
      {pestana === 'voces' && (
        <div className="space-y-5">
          {boton.accion === 'ir_ubicacion' && (
            <>
              <TtsField
                titulo="Mensaje antes de iniciar el desplazamiento"
                value={boton.tts_antes_de_ir}
                onChange={(tts_antes_de_ir) => setBoton((actual) => ({ ...actual, tts_antes_de_ir }))}
              />
              <TtsField
                titulo="Mensaje al llegar a la ubicación"
                value={boton.tts_al_llegar}
                onChange={(tts_al_llegar) => setBoton((actual) => ({ ...actual, tts_al_llegar }))}
              />
            </>
          )}
          {boton.accion !== 'ir_ubicacion' && (
            <TtsField
              titulo={boton.accion === 'secuencia' ? 'Mensaje al finalizar la secuencia' : 'Mensaje al finalizar el video'}
              ayuda={
                boton.accion === 'video'
                  ? 'Tras reproducirlo, se reanuda el contador que estaba en pausa.'
                  : undefined
              }
              value={boton.tts_despues_video}
              onChange={(tts_despues_video) => setBoton((actual) => ({ ...actual, tts_despues_video }))}
            />
          )}
          <TtsField
            titulo="Mensaje de despedida antes de reanudar el recorrido"
            value={boton.tts_despedida}
            onChange={(tts_despedida) => setBoton((actual) => ({ ...actual, tts_despedida }))}
          />
        </div>
      )}
    </ModalPestanas>
  )
}

function TtsField({
  titulo,
  ayuda,
  value,
  onChange,
}: {
  titulo: string
  ayuda?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
        {titulo}
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
      </p>
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
