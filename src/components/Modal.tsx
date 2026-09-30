import { Ayuda } from './Ayuda'

interface ModalProps {
  titulo: string
  /**
   * Ayuda del diálogo completo: sale en el icono de información al lado del
   * título. Es para lo que explica de qué va el popup, no para un campo
   * concreto; esa ayuda va con <Ayuda> junto a la etiqueta del campo.
   */
  ayuda?: React.ReactNode
  /**
   * Error de validación o de guardado. Va encima de los botones, siempre a la
   * vista: al final del contenido quedaba escondido si había que desplazarse,
   * y parecía que "Guardar" no hacía nada.
   */
  aviso?: React.ReactNode
  children: React.ReactNode
  onCancelar: () => void
  onAceptar: () => void
  aceptarDeshabilitado?: boolean
  textoAceptar?: string
}

export function Modal({
  titulo,
  ayuda,
  aviso,
  children,
  onCancelar,
  onAceptar,
  aceptarDeshabilitado,
  textoAceptar = 'Aceptar',
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      {/* Nunca más alto que la pantalla (dvh: descuenta las barras del navegador
          del teléfono). Título y botones fijos; el contenido se desplaza. */}
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl">
        <h3 className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4 text-xl font-semibold text-slate-900 md:px-8 md:py-6 md:text-2xl">
          {titulo}
          {ayuda && <Ayuda ancho="w-80">{ayuda}</Ayuda>}
        </h3>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 md:px-8 md:py-6">{children}</div>
        <div className="shrink-0 border-t border-slate-100 px-5 pb-5 pt-4 md:px-8 md:pb-8">
          {aviso && <div className="mb-3 text-sm font-medium text-rose-600">{aviso}</div>}
          <div className="flex justify-end gap-3">
            <button
              onClick={onCancelar}
              className="rounded-lg px-6 py-3 font-medium text-slate-600 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              onClick={onAceptar}
              disabled={aceptarDeshabilitado}
              className="rounded-lg bg-indigo-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 md:px-8"
            >
              {textoAceptar}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
