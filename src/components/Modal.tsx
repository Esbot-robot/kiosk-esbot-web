interface ModalProps {
  titulo: string
  children: React.ReactNode
  onCancelar: () => void
  onAceptar: () => void
  aceptarDeshabilitado?: boolean
  textoAceptar?: string
}

export function Modal({
  titulo,
  children,
  onCancelar,
  onAceptar,
  aceptarDeshabilitado,
  textoAceptar = 'Aceptar',
}: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <h3 className="border-b border-slate-100 px-8 py-6 text-2xl font-semibold text-slate-900">
          {titulo}
        </h3>
        <div className="px-8 py-6">{children}</div>
        <div className="flex justify-end gap-3 px-8 pb-8">
          <button
            onClick={onCancelar}
            className="rounded-lg px-6 py-3 font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            Cancelar
          </button>
          <button
            onClick={onAceptar}
            disabled={aceptarDeshabilitado}
            className="rounded-lg bg-indigo-600 px-8 py-3 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
          >
            {textoAceptar}
          </button>
        </div>
      </div>
    </div>
  )
}
