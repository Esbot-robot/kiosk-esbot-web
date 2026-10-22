/**
 * Interruptor encendido/apagado (el que reemplaza a las casillas de "Mostrar este
 * botón", "Rayas diagonales", etc.). Es un botón con rol "switch": se alcanza con
 * el teclado y los lectores de pantalla lo anuncian como interruptor.
 */
export function Interruptor({
  activo,
  onChange,
  etiqueta,
}: {
  activo: boolean
  onChange: (activo: boolean) => void
  /** nombre para lectores de pantalla (lo visible lo pone quien lo usa) */
  etiqueta: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={() => onChange(!activo)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
        activo ? 'bg-[#1d293d]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          activo ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
