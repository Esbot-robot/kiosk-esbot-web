import { useState } from 'react'
import { Modal } from './Modal'
import type { TipoProyecto } from '../types/config'

const TIPOS: { id: TipoProyecto; nombre: string; icono: React.ReactNode }[] = [
  {
    id: 'evento',
    nombre: 'Evento',
    icono: (
      // calendario
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M16 2v4M8 2v4M3 10h18" />
      </svg>
    ),
  },
  {
    id: 'retail',
    nombre: 'Retail',
    icono: (
      // bolsa de compras
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
        <path d="M3 6h18M16 10a4 4 0 0 1-8 0" />
      </svg>
    ),
  },
]

/**
 * Lo primero al crear un proyecto: elegir si es Evento o Retail. El tipo no se
 * cambia después, porque cada uno guarda una configuración distinta y cambiarlo
 * la dejaría a medias sin que nadie lo note.
 */
export function DialogNuevoProyecto({
  creando,
  error,
  onCrear,
  onCerrar,
}: {
  creando: boolean
  /** si no se pudo crear: se muestra dentro del diálogo, no detrás */
  error?: string
  onCrear: (tipo: TipoProyecto) => void
  onCerrar: () => void
}) {
  const [tipo, setTipo] = useState<TipoProyecto | null>(null)

  return (
    <Modal
      titulo="Nuevo proyecto"
      ancho="max-w-xl"
      aviso={error}
      onCancelar={onCerrar}
      onAceptar={() => tipo && onCrear(tipo)}
      aceptarDeshabilitado={!tipo || creando}
      textoAceptar={creando ? 'Creando...' : 'Crear proyecto'}
    >
      <p className="text-center text-sm font-bold uppercase tracking-wider text-[#1d293d]">Seleccione el tipo de proyecto</p>
      <div role="radiogroup" aria-label="Tipo de proyecto" className="mt-6 flex justify-center gap-10">
        {TIPOS.map((t) => {
          const elegido = tipo === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={elegido}
              onClick={() => setTipo(t.id)}
              className="group flex flex-col items-center gap-3"
            >
              {/* Círculo con el ícono; el elegido lleva borde azul oscuro y el visto arriba a la derecha */}
              <span
                className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-white transition-colors ${
                  elegido
                    ? 'border-[3px] border-[#1d293d] text-[#1d293d]'
                    : 'border border-slate-200 text-slate-400 shadow-sm group-hover:border-slate-300'
                }`}
              >
                {t.icono}
                {elegido && (
                  <span className="absolute -right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#1d293d] text-white ring-4 ring-white">
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </span>
              <span className={`text-xs font-semibold uppercase tracking-wider ${elegido ? 'text-[#1d293d]' : 'text-slate-400'}`}>
                {t.nombre}
              </span>
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
