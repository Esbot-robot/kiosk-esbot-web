import { DISENOS, type Diseno } from '../../lib/disenos'
import { Ayuda } from '../Ayuda'

/** Esquema de cada diseño: solo las cajas principales, sin colores de marca */
function Miniatura({ diseno }: { diseno: Diseno }) {
  const base = '#cbd5e1'
  const fuerte = '#64748b'
  return (
    <svg viewBox="0 0 160 100" className="w-full rounded-md bg-slate-100" aria-hidden="true">
      {/* logo */}
      <rect x="62" y="6" width="36" height="12" rx="3" fill={base} />
      {diseno === 'feria' ? (
        <>
          {/* título en cinta con muescas y subtítulo en barra oscura */}
          <path d="M26 24h108v14h-108zM26 29a3 3 0 0 1 0 4zM134 29a3 3 0 0 0 0 4z" fill={fuerte} />
          <circle cx="26" cy="31" r="3" fill="#f1f5f9" />
          <circle cx="134" cy="31" r="3" fill="#f1f5f9" />
          <rect x="22" y="38" width="116" height="9" rx="2" fill="#334155" />
          {/* botones con borde grueso y sombra dura */}
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={22 + i * 39} y="62" width="34" height="28" rx="6" fill="#1e293b" />
              <rect x={23 + i * 39} y="58" width="32" height="27" rx="5" fill={base} stroke="#1e293b" strokeWidth="2" />
            </g>
          ))}
        </>
      ) : (
        <>
          {/* título y subtítulo en franjas de lado a lado */}
          <rect x="0" y="24" width="160" height="14" fill={fuerte} />
          <rect x="0" y="38" width="160" height="10" fill={base} />
          {/* botones en píldora */}
          {[0, 1, 2].map((i) => (
            <rect key={i} x={14 + i * 46} y="62" width="40" height="18" rx="9" fill="#1e293b" />
          ))}
        </>
      )}
      {/* contador */}
      <rect x={diseno === 'feria' ? 64 : 112} y="91" width={diseno === 'feria' ? 32 : 40} height="6" rx="3" fill={fuerte} />
    </svg>
  )
}

/** Elige cómo se dibuja la pantalla inicial del robot (cada diseño es una plantilla) */
export function SelectorDiseno({
  valor,
  onChange,
  deshabilitado,
}: {
  valor: Diseno
  onChange: (d: Diseno) => void
  deshabilitado?: boolean
}) {
  return (
    <div className="mb-5 border-b border-slate-200 pb-5">
      <p className="flex items-center gap-2 font-semibold text-slate-800">
        Diseño de la pantalla
        <Ayuda>
          Cambia cómo se ve la pantalla inicial del robot. Los colores, el fondo y los textos siguen siendo los del
          proyecto. Los robots con una app anterior siguen mostrando el diseño clásico.
        </Ayuda>
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {DISENOS.map((d) => {
          const activo = d.id === valor
          return (
            <button
              key={d.id}
              type="button"
              disabled={deshabilitado}
              onClick={() => onChange(d.id)}
              aria-pressed={activo}
              className={`rounded-lg border-2 p-2 text-left transition-colors disabled:opacity-60 ${
                activo ? 'border-[#2A4470] bg-slate-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <Miniatura diseno={d.id} />
              <p className="mt-2 text-sm font-semibold text-slate-800">{d.nombre}</p>
              <p className="text-xs text-slate-500">{d.descripcion}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
