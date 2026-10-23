import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from './Modal'
import { Advertencia } from './Advertencia'
import type { ResultadoArchivo } from '../lib/archivosProyecto'

/** Triángulo de advertencia, el mismo de <Advertencia> */
function IconoAdvertencia() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-rose-600" fill="currentColor" aria-hidden="true">
      <path d="M12 2.5 1.5 21h21z" />
      <path d="M11 9.5h2v5.5h-2zM11 16.5h2v2h-2z" fill="#fff" />
    </svg>
  )
}

function ListaArchivos({ faltan }: { faltan: ResultadoArchivo[] }) {
  return (
    <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-800">
      {faltan.map((a, i) => (
        <li key={`${a.url}-${i}`}>{a.nombre}</li>
      ))}
    </ul>
  )
}

/**
 * Aviso dentro del editor: «Faltan 2 archivos» (mismo estilo que «Hay cambios sin guardar»).
 * Al pulsarlo se abre la lista de lo que falta.
 */
export function AvisoArchivosFaltantes({ faltan }: { faltan: ResultadoArchivo[] }) {
  const [abierto, setAbierto] = useState(false)
  if (faltan.length === 0) return null
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)} className="text-left hover:underline">
        <Advertencia>
          {faltan.length === 1 ? 'Falta 1 archivo' : `Faltan ${faltan.length} archivos`} en el almacenamiento
        </Advertencia>
      </button>
      {abierto && (
        <Modal titulo="Archivos que faltan" ancho="max-w-lg" onCancelar={() => setAbierto(false)} onAceptar={() => setAbierto(false)} textoAceptar="Entendido">
          <p className="text-slate-600">
            Este proyecto usa archivos que ya no están en el almacenamiento (por ejemplo, porque se borraron a mano en Supabase):
          </p>
          <ListaArchivos faltan={faltan} />
          <p className="mt-4 text-sm text-slate-500">
            Súbalos de nuevo desde el botón o la pantalla que corresponda y guarde el proyecto. Mientras falten, un robot que no
            tenga su propia copia no podrá actualizarse.
          </p>
        </Modal>
      )}
    </>
  )
}

/**
 * Icono de advertencia para la fila «Config vX» de la tarjeta del robot. Al pulsarlo, un popup
 * con lo que falta en el proyecto fijado y un botón para abrirlo.
 */
export function IconoArchivosFaltantes({
  proyectoId,
  proyectoNombre,
  faltan,
}: {
  proyectoId: string
  proyectoNombre: string
  faltan: ResultadoArchivo[]
}) {
  const [abierto, setAbierto] = useState(false)
  const navigate = useNavigate()
  if (faltan.length === 0) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        title="Faltan archivos del proyecto"
        aria-label="Faltan archivos del proyecto"
        className="rounded p-0.5 hover:bg-slate-100"
      >
        <IconoAdvertencia />
      </button>
      {abierto && (
        <Modal
          titulo="Archivos que faltan"
          ancho="max-w-lg"
          onCancelar={() => setAbierto(false)}
          onAceptar={() => navigate(`/editor/${proyectoId}`)}
          textoAceptar="Abrir el proyecto"
        >
          <p className="text-slate-600">
            El proyecto <strong className="text-slate-800">«{proyectoNombre}»</strong> usa archivos que ya no están en el
            almacenamiento:
          </p>
          <ListaArchivos faltan={faltan} />
          <p className="mt-4 text-sm text-slate-500">
            Este robot sigue con su copia, pero cualquier robot que no la tenga (nuevo, reinstalado o con la memoria borrada) no podrá
            actualizarse hasta que se suban de nuevo.
          </p>
        </Modal>
      )}
    </>
  )
}
