import lapizPng from '../assets/icons/lapiz.png'
import guardarPng from '../assets/icons/guardar.png'
import nubePng from '../assets/icons/nube.png'
import masPng from '../assets/icons/mas.png'
import menosPng from '../assets/icons/menos.png'
import volumenPng from '../assets/icons/volumen.png'
import ondaPng from '../assets/icons/onda.png'

type IconoProps = { className?: string }

export const IconoLapiz = ({ className = 'h-4 w-4' }: IconoProps) => (
  <img src={lapizPng} className={className} alt="" draggable={false} />
)
export const IconoGuardar = ({ className = 'h-5 w-5' }: IconoProps) => (
  <img src={guardarPng} className={className} alt="" draggable={false} />
)
export const IconoNube = ({ className = 'h-8 w-8' }: IconoProps) => (
  <img src={nubePng} className={className} alt="" draggable={false} />
)
export const IconoMas = ({ className = 'h-4 w-4' }: IconoProps) => (
  <img src={masPng} className={className} alt="" draggable={false} />
)
export const IconoMenos = ({ className = 'h-4 w-4' }: IconoProps) => (
  <img src={menosPng} className={className} alt="" draggable={false} />
)
export const IconoVolumen = ({ className = 'h-5 w-5' }: IconoProps) => (
  <img src={volumenPng} className={className} alt="" draggable={false} />
)
export const IconoOnda = ({ className = 'h-6 w-6' }: IconoProps) => (
  <img src={ondaPng} className={className} alt="" draggable={false} />
)
export const IconoFijar = ({ className = 'h-5 w-5' }: IconoProps) => (
  // Chincheta vectorial: hereda el color del texto (antes era una imagen azul fija)
  <svg
    viewBox="0 0 24 24"
    className={className}
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="1.2"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <g transform="rotate(45 12 12)">
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
      <path d="M12 17v5" fill="none" strokeWidth="2" strokeLinecap="round" />
    </g>
  </svg>
)

/* Iconos de línea (SVG) para sidebar y cards, estilo del mockup */

export const IconoCarpeta = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
)

export const IconoSalir = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

/** ☰ botón del menú en teléfono */
export const IconoMenu = ({ className = 'h-6 w-6' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
)

/** ✕ cerrar el menú en teléfono */
export const IconoCerrar = ({ className = 'h-6 w-6' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

export const IconoReloj = ({ className = 'h-4 w-4' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

/** Persona con candado de rol (menú lateral: Usuarios) */
export const IconoUsuarios = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="4" />
    <path d="M3 21v-2a4 4 0 0 1 4-4h4" />
    <path d="M16 19l2 2 4-4" />
  </svg>
)

/** Campana de notificaciones */
export const IconoCampana = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

/** Libreta de contactos (menú lateral) */
export const IconoContactos = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

export const IconoRobotLinea = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="8" width="14" height="10" rx="2" />
    <line x1="12" y1="8" x2="12" y2="4" />
    <circle cx="12" cy="3" r="1" />
    <circle cx="9.5" cy="12.5" r="0.5" fill="currentColor" />
    <circle cx="14.5" cy="12.5" r="0.5" fill="currentColor" />
    <path d="M9.5 15.5h5" />
  </svg>
)

export const IconoGrafica = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="4" y1="20" x2="20" y2="20" />
    <polyline points="4 14 9 9 13 12 20 5" />
  </svg>
)

/**
 * Icono de información de las ayudas del editor.
 *
 * El círculo va en #F0F0F0, el color pedido. Ese gris sobre fondo blanco casi
 * no se distingue, así que lleva un contorno tenue para que se note dónde hay
 * que poner el cursor, y la "i" en un gris oscuro para que se lea.
 */
export const IconoInfo = ({ className = 'h-4 w-4' }: IconoProps) => (
  // Solo contorno, sin relleno: el color (gris muy claro) lo pone quien lo usa con text-*
  <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="7.6" r="1.2" fill="currentColor" />
    <rect x="11" y="10.6" width="2" height="6.6" rx="1" fill="currentColor" />
  </svg>
)

export const IconoPlay = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="11" opacity="0.15" />
    <path d="M10 8l6 4-6 4z" />
  </svg>
)
