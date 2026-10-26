import { useLayoutEffect, useRef } from 'react'
import { dp } from '../../lib/pantallaRobot'

/**
 * Texto de un botón de la vista previa, en una sola línea. Igual que el robot
 * (ajustarTextoAlAncho): si no cabe, la letra se achica de a 1 sp hasta caber,
 * sin bajar de la mitad; si ni así cabe, se corta con «…».
 */
export function TextoAjustado({
  texto,
  tamano,
  className = '',
  style,
}: {
  texto: string
  /** tamaño de la letra en sp, el mismo que usa el robot */
  tamano: number
  className?: string
  style?: React.CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // El tamaño se fija aquí y no en style: si no, cada render de la página lo
    // devolvería al tamaño completo sin volver a medir
    const ajustar = () => {
      let sp = tamano
      el.style.fontSize = dp(sp)
      while (sp > tamano * 0.5 && el.scrollWidth > el.clientWidth) {
        sp -= 1
        el.style.fontSize = dp(sp)
      }
    }
    ajustar()
    // El ancho del botón cambia al agregar o quitar botones. Solo se vuelve a
    // medir si cambió el ancho: achicar la letra cambia el alto y avisaría de nuevo
    let ultimoAncho = el.clientWidth
    const observador = new ResizeObserver(() => {
      if (el.clientWidth === ultimoAncho) return
      ultimoAncho = el.clientWidth
      ajustar()
    })
    observador.observe(el)
    return () => observador.disconnect()
  }, [texto, tamano])

  return (
    <span
      ref={ref}
      className={`block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap ${className}`}
      style={style}
    >
      {texto}
    </span>
  )
}
