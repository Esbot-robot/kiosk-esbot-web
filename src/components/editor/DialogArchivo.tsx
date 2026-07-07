import { useRef, useState } from 'react'
import { Modal } from '../Modal'
import { rutaMedia, subirArchivo } from '../../lib/storage'

interface DialogArchivoProps {
  titulo: string
  tipo: 'imagen' | 'video'
  projectId: string
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
export function DialogArchivo({ titulo, tipo, projectId, onSubido, onCerrar }: DialogArchivoProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [error, setError] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [arrastrando, setArrastrando] = useState(false)
  const cfg = CONFIG_TIPO[tipo]

  function seleccionar(f: File | undefined) {
    setError('')
    if (!f) return
    if (f.size > cfg.maxMB * 1024 * 1024) {
      setError(`El archivo pesa ${(f.size / 1024 / 1024).toFixed(1)}MB — el máximo es ${cfg.maxMB}MB`)
      return
    }
    setArchivo(f)
  }

  async function subir() {
    if (!archivo) return
    setSubiendo(true)
    setError('')
    try {
      const url = await subirArchivo('media', rutaMedia(projectId, archivo.name), archivo)
      onSubido(url)
      onCerrar()
    } catch (e) {
      setError('Error subiendo el archivo. ¿Existe el bucket "media" (público) en Supabase?')
      console.error(e)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      onAceptar={subir}
      aceptarDeshabilitado={!archivo || subiendo}
      textoAceptar={subiendo ? 'Subiendo...' : 'Aceptar'}
    >
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          seleccionar(e.dataTransfer.files[0])
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors ${
          arrastrando ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'
        }`}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-2xl">
          ☁️
        </div>
        {archivo ? (
          <p className="mt-4 font-medium text-slate-800">
            {archivo.name}{' '}
            <span className="text-slate-400">({(archivo.size / 1024 / 1024).toFixed(1)}MB)</span>
          </p>
        ) : (
          <p className="mt-4 text-lg text-slate-700">
            Arrastra un {tipo === 'imagen' ? 'una imagen' : 'video'} aquí o{' '}
            <span className="font-medium text-indigo-600">haz clic para subir</span>
          </p>
        )}
        <p className="mt-1 text-sm text-slate-400">{cfg.ayuda}</p>
      </div>
      <p className="mt-3 text-sm text-slate-500">{cfg.extra}</p>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={cfg.accept}
        className="hidden"
        onChange={(e) => seleccionar(e.target.files?.[0])}
      />
    </Modal>
  )
}
