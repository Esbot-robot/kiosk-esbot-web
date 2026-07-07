interface CampoColorProps {
  label: string
  /** hex "#RRGGBB" o vacío (= usar diseño por defecto de la app) */
  value: string
  onChange: (hex: string) => void
}

export function CampoColor({ label, value, onChange }: CampoColorProps) {
  const hexSinNumeral = value.replace('#', '')

  function cambiarDesdeTexto(texto: string) {
    const limpio = texto.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    onChange(limpio ? `#${limpio}` : '')
  }

  return (
    <div>
      <p className="mb-2 font-medium text-slate-800">{label}</p>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 items-center rounded-lg border border-slate-300 px-4 py-3">
          <span className="mr-2 text-slate-400">#</span>
          <input
            value={hexSinNumeral}
            onChange={(e) => cambiarDesdeTexto(e.target.value)}
            placeholder="vacío = por defecto"
            className="w-full font-mono uppercase focus:outline-none"
          />
        </div>
        <input
          type="color"
          value={value || '#ffffff'}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 cursor-pointer rounded-lg border border-slate-300"
          title="Elegir color"
        />
      </div>
    </div>
  )
}
