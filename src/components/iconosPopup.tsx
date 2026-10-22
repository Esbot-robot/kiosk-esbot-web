/** Iconos de línea de los popups con pestañas (20 px, heredan el color del texto) */
type IconoProps = { className?: string }

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

/** Diseño: paleta de pintor */
export const IconoPaleta = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.5-1.9-.3-1 .4-2.1 1.5-2.1H17a4 4 0 0 0 4-4c0-5-4-10-9-10z" />
    <circle cx="7.5" cy="11" r="1" fill="currentColor" />
    <circle cx="10.5" cy="7" r="1" fill="currentColor" />
    <circle cx="15" cy="7.5" r="1" fill="currentColor" />
  </svg>
)

/** Productos: portapapeles */
export const IconoPortapapeles = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4V3h6v1M9 11h6M9 15h4" />
  </svg>
)

/** Reanudar / tiempos: reloj */
export const IconoReloj = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

/** Cotizar: globo de chat con teléfono (WhatsApp) */
export const IconoChat = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.7L4 20z" />
    <path d="M9.5 9c.2 2.2 2.3 4.3 4.5 4.5l1.2-1.2-1.8-1-.8.7c-.8-.4-1.5-1.1-1.9-1.9l.7-.8-1-1.8L9.5 9z" />
  </svg>
)

export const IconoCerrarX = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

export const IconoSubir = ({ className = 'h-4 w-4' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
  </svg>
)

/** Lápiz de editar (del mismo gris que los textos secundarios) */
export const IconoLapizEditar = ({ className = 'h-3.5 w-3.5' }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
)

/** Hoja de cálculo verde, para el archivo de productos */
export const IconoExcel = ({ className = 'h-9 w-9' }: IconoProps) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
    <rect x="3" y="3" width="26" height="26" rx="4" fill="#1d7a4a" />
    <path d="M11 10l10 12M21 10L11 22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
)

/** Aviso amarillo (círculo con "!"): algo por revisar que no es un error */
export const IconoAvisoAmarillo = ({ className = 'h-4 w-4' }: IconoProps) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#f5b50a" />
    <path d="M12 7v6M12 16.5v.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
  </svg>
)

/** Acción: botón de reproducir */
export const IconoPlay = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor" />
  </svg>
)

/** Mensajes de voz: altavoz */
export const IconoVoz = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M4 10v4h4l5 4V6L8 10H4z" />
    <path d="M16.5 9a4 4 0 0 1 0 6M18.8 6.7a7.3 7.3 0 0 1 0 10.6" />
  </svg>
)

/** Captura: cámara */
export const IconoCamara = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M4 8h3l1.5-2h7L17 8h3v11H4V8z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

/** Código QR */
export const IconoQr = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="4" width="6" height="6" rx="1" />
    <rect x="14" y="4" width="6" height="6" rx="1" />
    <rect x="4" y="14" width="6" height="6" rx="1" />
    <path d="M14 14h2v2h-2zM18 14h2v2M14 18h2M18 18v2h-2" />
  </svg>
)

/** Pantalla: monitor */
export const IconoMonitor = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M9 20h6M12 16v4" />
  </svg>
)

/** Formulario: documento con líneas */
export const IconoDocumento = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M7 3h7l4 4v14H7V3z" />
    <path d="M14 3v4h4M10 12h5M10 16h5" />
  </svg>
)

/** Quitar: papelera */
export const IconoPapelera = ({ className = 'h-4 w-4' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </svg>
)

/** Cargar imagen: marco con montaña y sol */
export const IconoImagen = ({ className = 'h-7 w-7' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M4 17l5-5 4 4 3-3 4 4" />
  </svg>
)

/** Video cargado: pantalla con triángulo */
export const IconoVideo = ({ className = 'h-7 w-7' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="M10.5 9.5v5l4-2.5-4-2.5z" fill="currentColor" />
  </svg>
)

/** Cargar archivo: nube con flecha hacia arriba (gris, hereda el color del texto) */
export const IconoNubeSubir = ({ className = 'h-9 w-9' }: IconoProps) => (
  <svg {...base} strokeWidth={1.6} className={className}>
    <path d="M8 18H7a4 4 0 0 1-.9-7.9 6 6 0 0 1 11.6-1A4.5 4.5 0 0 1 17 18h-1" />
    <path d="M12 20v-9M8.8 14.2 12 11l3.2 3.2" />
  </svg>
)

/** Ir a una ubicación: marcador de mapa */
export const IconoUbicacion = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)

/** Reproducir secuencia: claqueta */
export const IconoSecuencia = ({ className = 'h-5 w-5' }: IconoProps) => (
  <svg {...base} className={className}>
    <rect x="4" y="9" width="16" height="11" rx="2" />
    <path d="M4 9l2.5-5 3 .6L7 9.5M9.5 9l2.5-5 3 .6L12.5 9.5M15 9l2.5-5 2.5.5L18 9.5" />
  </svg>
)
