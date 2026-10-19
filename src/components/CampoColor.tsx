import type { ReactNode } from 'react'
import { Ayuda } from './Ayuda'

interface CampoColorProps {
  label: string
  /** hex "#RRGGBB" o vacío (= usar diseño por defecto de la app) */
  value: string
  onChange: (hex: string) => void
  /** ayuda opcional; sale en el icono de información junto a la etiqueta */
  ayuda?: ReactNode
}

/** Cuadriculado del círculo cuando no hay color elegido (= el de por defecto) */
const SIN_COLOR = {
  backgroundImage: 'conic-gradient(#e2e8f0 25%, #ffffff 0 50%, #e2e8f0 0 75%, #ffffff 0)',
  backgroundSize: '10px 10px',
}

/**
 * Etiqueta arriba y debajo, en una sola línea compacta, un círculo con el color
 * y su código "# RRGGBB". El círculo abre el selector de color del navegador y
 * el código se puede escribir directamente.
 */
export function CampoColor({ label, value, onChange, ayuda }: CampoColorProps) {
  const hexSinNumeral = value.replace('#', '')

  function cambiarDesdeTexto(texto: string) {
    const limpio = texto.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    onChange(limpio ? `#${limpio}` : '')
  }

  return (
    <div className="min-w-0">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-500">
        {label}
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
      </p>
      <div className="flex items-center gap-3">
        <label className="relative h-9 w-9 shrink-0 cursor-pointer" title="Elegir color">
          <span
            className="block h-full w-full rounded-full border border-slate-300 shadow-sm"
            style={value ? { backgroundColor: value } : SIN_COLOR}
          />
          <input
            type="color"
            value={value || '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <div className="flex min-w-0 flex-1 items-center border-b border-transparent font-mono text-slate-800 transition-colors focus-within:border-indigo-500 hover:border-slate-300">
          <span className="mr-2 text-slate-400">#</span>
          <input
            value={hexSinNumeral}
            onChange={(e) => cambiarDesdeTexto(e.target.value)}
            placeholder="por defecto"
            className="w-full min-w-0 bg-transparent py-1 uppercase placeholder:font-sans placeholder:normal-case placeholder:text-slate-400 focus:outline-none"
          />
        </div>
      </div>
    </div>
  )
}
