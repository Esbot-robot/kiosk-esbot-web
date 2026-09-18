import { useState, type ReactNode } from 'react'
import { IconoInfo } from './iconos'

interface AyudaProps {
  /** el texto de ayuda que antes iba escrito debajo del campo */
  children: ReactNode
  /**
   * Ancho del globo en clases de Tailwind. Ahora que cuelga del icono ya no
   * puede heredar el ancho del campo, así que se fija aquí; se cambia por
   * campo cuando una ayuda es más larga.
   */
  ancho?: string
}

/**
 * Ayuda contextual del editor.
 *
 * Los textos de ayuda ya no ocupan espacio bajo cada campo: se muestran al
 * poner el cursor sobre el icono de información.
 *
 * El globo sale **justo debajo del icono**: el `relative` está en el propio
 * componente, así que no importa dónde se use ni qué clases tenga el campo.
 * Como ya no hereda el ancho del contenedor, el ancho se fija con la prop
 * `ancho`.
 *
 * Se usa estado de React y no el truco `group-hover` de Tailwind porque ahí el
 * globo tendría que ser hijo o hermano del elemento que se pasa con el cursor,
 * y aquí el icono vive dentro de la etiqueta mientras el globo se dibuja al
 * final del campo. Con estado el disparador y el globo pueden estar en sitios
 * distintos del árbol.
 */
export function Ayuda({ children, ancho = 'w-72' }: AyudaProps) {
  const [abierto, setAbierto] = useState(false)

  return (
    // El relative va aquí, en el propio icono: así el globo se cuelga del
    // icono y no del contenedor del campo.
    <span className="relative inline-flex">
      <span
        role="button"
        tabIndex={0}
        aria-label="Ver ayuda"
        // cursor-default: sin esto el navegador muestra el puntero con "?" y no
        // gusta; el icono no se hace clic, solo se pasa por encima.
        className="inline-flex cursor-default items-center"
        onMouseEnter={() => setAbierto(true)}
        onMouseLeave={() => setAbierto(false)}
        // Foco y blur dejan consultarla con el teclado, sin mouse.
        onFocus={() => setAbierto(true)}
        onBlur={() => setAbierto(false)}
        // El icono va dentro de <label>, de botones de opción y de zonas de
        // arrastre: sin esto, hacer clic en él marcaría la casilla, cambiaría
        // la opción o abriría el explorador de archivos.
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}
      >
        <IconoInfo />
      </span>

      {abierto && (
        <span
          role="tooltip"
          className={`absolute left-0 top-full z-30 mt-1 ${ancho} rounded-lg bg-slate-800 px-3 py-2 text-sm font-normal leading-snug text-white shadow-lg`}
        >
          {children}
        </span>
      )}
    </span>
  )
}
