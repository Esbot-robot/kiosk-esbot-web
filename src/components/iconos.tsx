import lapizPng from '../assets/icons/lapiz.png'
import guardarPng from '../assets/icons/guardar.png'
import nubePng from '../assets/icons/nube.png'
import masPng from '../assets/icons/mas.png'
import menosPng from '../assets/icons/menos.png'
import volumenPng from '../assets/icons/volumen.png'
import ondaPng from '../assets/icons/onda.png'
import fijarPng from '../assets/icons/fijar.png'

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
  <img src={fijarPng} className={className} alt="" draggable={false} />
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

export const IconoReloj = ({ className = 'h-4 w-4' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
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

export const IconoPlay = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="12" cy="12" r="11" opacity="0.15" />
    <path d="M10 8l6 4-6 4z" />
  </svg>
)
