import { useEffect, useRef, useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { BarraSubida } from '../BarraSubida'
import {
  formatoMB,
  nombreDesdeUrl,
  pesoDesdeUrl,
  rutaMedia,
  subirArchivo,
  type ProgresoSubida,
} from '../../lib/storage'
import { describirError } from '../../lib/errores'
import { IconoNube } from '../iconos'
import { InterruptorMostrar } from './DialogTexto'

interface DialogArchivoProps {
  titulo: string
  tipo: 'imagen' | 'video'
  projectId: string
  /** URL del archivo que ya tiene el proyecto: se muestra como si estuviera elegido */
  urlActual?: string
  /** texto de ayuda bajo la zona de subida; si no se pasa, usa el del tipo */
  nota?: string
  /** si se pasa, el diálogo muestra la casilla "Mostrar" y guarda su valor
   *  aunque no se suba un archivo nuevo */
  mostrar?: { etiqueta: string; ayuda: string; valor: boolean; onGuardar: (valor: boolean) => void }
  onSubido: (urlPublica: string) => void
  onCerrar: () => void
}

const CONFIG_TIPO = {
  imagen: {
    accept: 'image/jpeg,image/png,image/webp',
    maxMB: 5,
    ayuda: 'JPG, PNG o WEBP (Máx. 5MB)',
    extra: 'Resolución recomendada: 1587 × 991 px',
  },
  video: {
    accept: 'video/mp4,video/quicktime',
    maxMB: 50,
    ayuda: 'MP4 o MOV (Máx. 50MB)',
    extra: 'El robot lo descarga una vez y lo reproduce desde su memoria',
  },
} as const

/** Diálogo "Cambiar imagen de fondo" / "Cargar video para patrullaje" del mockup */
export function DialogArchivo({
  titulo,
  tipo,
  projectId,
  urlActual,
  nota,
  mostrar,
  onSubido,
  onCerrar,
}: DialogArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelador = useRef<AbortController | null>(null)
  const [visible, setVisible] = useState(mostrar?.valor ?? true)
  const cambioVisible = mostrar !== undefined && visible !== mostrar.valor
  const [archivo, setArchivo] = useState<File | null>(null)
  const [pesoActual, setPesoActual] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const cfg = CONFIG_TIPO[tipo]

  // El peso del archivo actual no está en la config: se le pregunta a Storage
  useEffect(() => {
    if (!urlActual) return
    let vigente = true
    void pesoDesdeUrl(urlActual).then((peso) => {
      if (vigente) setPesoActual(peso)
    })
    return () => {
      vigente = false
    }
  }, [urlActual])

  // Si el diálogo se cierra a mitad de la subida, la subida se cancela
  useEffect(() => () => cancelador.current?.abort(), [])

  function seleccionar(f: File | undefined) {
    setError('')
    if (!f) return
    if (f.size > cfg.maxMB * 1024 * 1024) {
      setError(`El archivo pesa ${formatoMB(f.size)} — el máximo es ${cfg.maxMB}MB`)
      return
    }
    setArchivo(f)
  }

  async function subir() {
    if (!archivo) {
      // Solo se cambió la casilla "Mostrar": no hay nada que subir
      if (cambioVisible) mostrar?.onGuardar(visible)
      onCerrar()
      return
    }
    const controlador = new AbortController()
    cancelador.current = controlador
    setSubiendo(true)
    setProgreso(null)
    setError('')
    try {
      const url = await subirArchivo('media', rutaMedia(projectId, archivo.name), archivo, {
        onProgreso: setProgreso,
        signal: controlador.signal,
      })
      onSubido(url)
      if (cambioVisible) mostrar?.onGuardar(visible)
      onCerrar()
    } catch (e) {
      if (controlador.signal.aborted) return
      setError(`No se pudo subir el archivo. ${describirError(e)}`)
      console.error(e)
    } finally {
      cancelador.current = null
      setSubiendo(false)
    }
  }

  function cancelar() {
    cancelador.current?.abort()
    onCerrar()
  }

  // Lo que se muestra en la zona de subida: el archivo elegido o, si no, el actual
  const nombreMostrado = archivo?.name ?? (urlActual ? nombreDesdeUrl(urlActual) : '')
  const pesoMostrado = archivo ? archivo.size : pesoActual

  return (
    <Modal
      titulo={titulo}
      onCancelar={cancelar}
      onAceptar={subir}
      aceptarDeshabilitado={(!archivo && !cambioVisible) || subiendo}
      textoAceptar={subiendo ? 'Subiendo...' : 'Aceptar'}
    >
      {mostrar && (
        <InterruptorMostrar
          etiqueta={mostrar.etiqueta}
          ayuda={mostrar.ayuda}
          valor={visible}
          onChange={setVisible}
        />
      )}
      <div
        onClick={() => !subiendo && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          if (!subiendo) setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          if (!subiendo) seleccionar(e.dataTransfer.files[0])
        }}
        className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
          subiendo ? 'cursor-default border-slate-300' : 'cursor-pointer'
        } ${arrastrando ? 'border-indigo-500 bg-indigo-50' : subiendo ? '' : 'border-slate-300 hover:border-indigo-400'}`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100">
          <IconoNube />
        </div>
        {nombreMostrado ? (
          <p className="mt-4 break-all font-medium text-slate-800">
            {nombreMostrado}{' '}
            {pesoMostrado !== null && <span className="text-slate-400">({formatoMB(pesoMostrado)})</span>}
          </p>
        ) : (
          <p className="mt-4 text-lg text-slate-700">
            Arrastra un {tipo === 'imagen' ? 'una imagen' : 'video'} aquí o{' '}
            <span className="font-medium text-indigo-600">haz clic para subir</span>
          </p>
        )}
        {/* Los formatos y el peso quedan a la vista: hacen falta antes de
            elegir el archivo. La recomendación se va al icono. */}
        <p className="mt-1 flex items-center justify-center gap-2 text-sm text-slate-400">
          {cfg.ayuda}
          <Ayuda>{nota ?? cfg.extra}</Ayuda>
        </p>
      </div>
      {subiendo && (
        <div className="mt-4">
          <BarraSubida progreso={progreso} />
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={cfg.accept}
        className="hidden"
        onChange={(e) => {
          seleccionar(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </Modal>
  )
}
