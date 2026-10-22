import type { ReactNode } from 'react'
import { Advertencia } from './Advertencia'
import { Ayuda } from './Ayuda'
import { IconoCerrarX } from './iconosPopup'
import { useSoloLectura } from '../lib/perfil'

export interface PestanaPopup {
  id: string
  etiqueta: string
  icono: ReactNode
}

interface ModalPestanasProps {
  titulo: string
  /** ayuda del popup completo, junto al título */
  ayuda?: ReactNode
  pestanas: PestanaPopup[]
  activa: string
  onCambiar: (id: string) => void
  /** el contenido de la pestaña activa */
  children: ReactNode
  onCancelar: () => void
  onAceptar: () => void
  textoAceptar?: string
  /** deshabilita "Guardar" (por ejemplo, mientras se sube un archivo) */
  aceptarDeshabilitado?: boolean
  /** error de validación: va siempre a la vista, encima de los botones */
  aviso?: ReactNode
}

/**
 * Popup de configuración de un botón, con barra lateral de pestañas (Diseño, Productos,
 * Cotizar…). Mismo comportamiento que Modal: el título y los botones quedan fijos y solo
 * se desplaza el contenido; un cliente lector lo ve completo pero sin poder escribir.
 * Con una sola pestaña no se dibuja la barra lateral.
 * En pantallas angostas la barra lateral pasa a ser una fila de pestañas arriba.
 * El alto del contenido es fijo en computador, para que el popup no salte al cambiar de pestaña.
 */
export function ModalPestanas({
  titulo,
  ayuda,
  pestanas,
  activa,
  onCambiar,
  children,
  onCancelar,
  onAceptar,
  textoAceptar = 'Guardar',
  aceptarDeshabilitado,
  aviso,
}: ModalPestanasProps) {
  const soloLectura = useSoloLectura()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 md:px-8 md:py-5">
          <h3 className="flex items-center gap-3 text-xl font-semibold text-slate-900 md:text-2xl">
            {titulo}
            {ayuda && <Ayuda ancho="w-80">{ayuda}</Ayuda>}
          </h3>
          <button
            type="button"
            onClick={onCancelar}
            aria-label="Cerrar"
            className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
          >
            <IconoCerrarX />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          {pestanas.length > 1 && (
          <nav
            role="tablist"
            aria-orientation="vertical"
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-slate-100 p-3 md:w-52 md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4"
          >
            {pestanas.map((p) => {
              const seleccionada = p.id === activa
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={seleccionada}
                  onClick={() => onCambiar(p.id)}
                  className={`flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-base transition-colors ${
                    seleccionada
                      ? 'bg-slate-100 font-semibold text-slate-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="text-slate-700">{p.icono}</span>
                  {p.etiqueta}
                </button>
              )
            })}
          </nav>
          )}

          <div
            role="tabpanel"
            className="popup-secciones min-h-0 flex-1 overflow-y-auto px-5 py-5 md:h-[34rem] md:px-8 md:py-6"
          >
            {soloLectura ? (
              <fieldset disabled className="min-w-0">
                {children}
              </fieldset>
            ) : (
              children
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-100 px-5 pb-5 pt-4 md:px-8 md:pb-6">
          {aviso && !soloLectura && <Advertencia className="mb-3">{aviso}</Advertencia>}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onCancelar}
              className="px-6 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              {soloLectura ? 'Cerrar' : 'Cancelar'}
            </button>
            {!soloLectura && (
              <button
                type="button"
                onClick={onAceptar}
                disabled={aceptarDeshabilitado}
                className="bg-[#1d293d] px-7 py-2.5 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {textoAceptar}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
