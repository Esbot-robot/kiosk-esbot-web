import { DISENOS, type Diseno } from '../../lib/disenos'
import { CampoColor } from '../CampoColor'

/** Esquema de cada diseño: solo las cajas principales, sin colores de marca */
function Miniatura({ diseno }: { diseno: Diseno }) {
  const base = '#cbd5e1'
  const fuerte = '#64748b'
  return (
    <svg viewBox="0 0 160 100" className="w-full rounded-md bg-slate-100" aria-hidden="true">
      {/* logo */}
      <rect x="62" y="6" width="36" height="12" rx="3" fill={base} />
      {diseno === 'banner' ? (
        <>
          {/* imagen arriba (con el logo) y panel de color abajo, con la barra del contador */}
          <rect x="0" y="52" width="160" height="48" fill="#e2e8f0" />
          <rect x="0" y="49" width="160" height="3" fill="#94a3b8" />
          <rect x="0" y="49" width="100" height="3" fill={fuerte} />
          <rect x="10" y="58" width="70" height="8" rx="2" fill={fuerte} />
          <rect x="10" y="69" width="100" height="5" rx="2" fill={base} />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={10 + i * 50} y="80" width="44" height="14" rx="7" fill="#1e293b" />
          ))}
        </>
      ) : diseno === 'feria' ? (
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
  colorPanel = '',
  onColorPanel,
}: {
  valor: Diseno
  onChange: (d: Diseno) => void
  deshabilitado?: boolean
  /** color del panel de abajo (solo diseño banner) */
  colorPanel?: string
  onColorPanel?: (color: string) => void
}) {
  const actual = DISENOS.find((d) => d.id === valor)
  return (
    <div className="mb-5 border-b border-slate-200 pb-5">
      {/* "Diseño de la pantalla - Clásico ▾": mismo estilo del filtro de estado de Robots */}
      <label className="relative flex w-fit items-center gap-1.5 text-slate-500">
        Diseño de la pantalla -
        <select
          value={valor}
          disabled={deshabilitado}
          onChange={(e) => onChange(e.target.value as Diseno)}
          className="cursor-pointer appearance-none bg-transparent py-1 pr-6 font-semibold text-slate-800 focus:outline-none disabled:cursor-default disabled:opacity-60"
        >
          {DISENOS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </select>
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-0 h-4 w-4 text-slate-600" fill="currentColor" aria-hidden="true">
          <path d="M5.5 8h9L10 13z" />
        </svg>
      </label>

      {/* Abajo: cómo es el diseño elegido */}
      <div className="mt-3 flex items-center gap-3">
        <div className="w-36 shrink-0">
          <Miniatura diseno={valor} />
        </div>
        <p className="text-xs text-slate-500">{actual?.descripcion}</p>
      </div>

      {valor === 'banner' && onColorPanel && (
        <div className="mt-4">
          <CampoColor
            label="Color del panel de abajo"
            value={colorPanel}
            onChange={onColorPanel}
            ayuda="Color de fondo de la zona que contiene el título, el subtítulo y los botones. El color del texto se ajusta automáticamente para garantizar la legibilidad."
          />
        </div>
      )}
    </div>
  )
}
