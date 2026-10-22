import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
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

/** separación mínima entre el globo y el borde de la ventana */
const MARGEN = 8

/**
 * Ayuda contextual del panel: el texto sale al poner el cursor (o el foco)
 * sobre el icono de información.
 *
 * El globo se dibuja en <body> (portal) con posición fija calculada desde el
 * icono. Antes iba dentro del propio campo, y los contenedores que recortan lo
 * que se sale (tarjetas con overflow-hidden, diálogos con scroll) lo dejaban
 * cortado; además heredaba estilos del título, como las mayúsculas.
 * Sale debajo del icono; si no cabe, encima. A lo ancho nunca se sale de la
 * ventana.
 *
 * Se usa estado de React y no `group-hover` porque el disparador y el globo
 * viven en sitios distintos del árbol.
 */
export function Ayuda({ children, ancho = 'w-72' }: AyudaProps) {
  const [abierto, setAbierto] = useState(false)
  const icono = useRef<HTMLSpanElement>(null)
  const globo = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const ubicar = useCallback(() => {
    const i = icono.current?.getBoundingClientRect()
    const g = globo.current?.getBoundingClientRect()
    if (!i || !g) return
    const anchoVentana = window.innerWidth
    const altoVentana = window.innerHeight
    // A lo ancho: alineado con el icono, sin salirse por ningún lado
    const left = Math.min(Math.max(MARGEN, i.left), anchoVentana - g.width - MARGEN)
    // A lo alto: debajo si cabe; si no, encima
    const abajo = i.bottom + 4
    const top = abajo + g.height > altoVentana - MARGEN ? Math.max(MARGEN, i.top - g.height - 4) : abajo
    setPos((p) => (p && p.top === top && p.left === left ? p : { top, left }))
  }, [])

  // Se mide el globo ya dibujado (invisible) y se coloca antes de pintarlo
  useLayoutEffect(() => {
    if (!abierto) {
      setPos(null)
      return
    }
    ubicar()
    // Si la página o un diálogo se desplazan con el globo abierto, lo sigue
    window.addEventListener('scroll', ubicar, true)
    window.addEventListener('resize', ubicar)
    return () => {
      window.removeEventListener('scroll', ubicar, true)
      window.removeEventListener('resize', ubicar)
    }
  }, [abierto, ubicar])

  return (
    <span className="inline-flex">
      <span
        ref={icono}
        role="button"
        tabIndex={0}
        aria-label="Ver ayuda"
        // cursor-default: sin esto el navegador muestra el puntero con "?" y no
        // gusta; el icono no se hace clic, solo se pasa por encima.
        className="inline-flex cursor-default items-center text-slate-300 transition-colors hover:text-slate-500 focus:text-slate-500 focus:outline-none"
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

      {abierto &&
        createPortal(
          <span
            ref={globo}
            role="tooltip"
            // max-w: en teléfono el globo no es más ancho que la pantalla
            className={`pointer-events-none fixed z-[100] ${ancho} max-w-[calc(100vw-1rem)] rounded-lg bg-slate-800 px-3 py-2 text-left text-sm font-normal normal-case leading-snug tracking-normal text-white shadow-lg`}
            style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
          >
            {children}
          </span>,
          document.body
        )}
    </span>
  )
}
