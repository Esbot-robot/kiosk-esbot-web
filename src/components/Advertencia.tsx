import type { ReactNode } from 'react'

/**
 * Aviso de advertencia del panel: triángulo rojo y texto en negro, sin fondo.
 * Es el mismo estilo del aviso "falta cargar la versión" de Robots, para que
 * todos los avisos (robot sin conexión, cambios sin guardar, etc.) se vean igual.
 * Va como <span> en bloque para poder usarse dentro de etiquetas de texto.
 */
export function Advertencia({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`flex items-start gap-2 text-sm text-slate-900 ${className}`}>
      <svg viewBox="0 0 24 24" className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" fill="currentColor" aria-hidden="true">
        <path d="M12 2.5 1.5 21h21z" />
        <path d="M11 9.5h2v5.5h-2zM11 16.5h2v2h-2z" fill="#fff" />
      </svg>
      <span>{children}</span>
    </span>
  )
}
