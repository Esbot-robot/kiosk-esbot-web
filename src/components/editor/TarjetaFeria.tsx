import { aclarar, colorContraste, colorRayas, FERIA } from '../../lib/disenos'
import { FUENTE_FERIA } from '../../lib/disenos'
import type { BotonEstilo } from '../../types/config'

/**
 * Tarjeta del diseño Feria sin imagen propia (vista previa del panel). La app
 * del robot la dibuja igual: color de la tarjeta, rayas diagonales de un tono
 * más oscuro del mismo color, círculo con el ícono (relleno y contorno
 * editables) y la franja de abajo con el texto.
 */
export function TarjetaFeria({
  estilo,
  texto,
  plano = false,
  fondoDefecto = FERIA.botonFondo,
}: {
  estilo: BotonEstilo
  texto: string
  /** diseño banner: tarjeta lisa, sin borde ni sombra dura ni rayas, con la franja de un tono más oscuro */
  plano?: boolean
  fondoDefecto?: string
}) {
  if (plano) {
    const fondo = estilo.color_fondo || fondoDefecto
    const franja = estilo.color_franja || colorRayas(fondo)
    return (
      <div
        className="flex h-42 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px]"
        style={{ backgroundColor: fondo, boxShadow: '0 10px 18px rgba(100, 116, 139, 0.32)' }}
      >
        {/* zona del ícono: degradado del color de la tarjeta, más claro arriba */}
        <div
          className="flex flex-1 items-center justify-center"
          style={{ backgroundImage: `linear-gradient(180deg, ${aclarar(fondo, 0.22)}, ${fondo})` }}
        >
          {/* en el banner el ícono va directo sobre el degradado, sin círculo */}
          {estilo.icono_url && <img src={estilo.icono_url} alt="" className="h-[52%] max-h-[4.6rem] object-contain" />}
        </div>
        <div
          className="flex h-[2.6rem] shrink-0 items-center truncate px-4 text-base font-bold"
          style={{ backgroundColor: franja, color: colorContraste(franja) }}
        >
          {texto}
        </div>
      </div>
    )
  }
  const contorno = estilo.color_contorno || FERIA.contorno
  const fondo = estilo.color_fondo || FERIA.botonFondo
  const conRayas = estilo.rayas !== false
  const raya = colorRayas(fondo)
  const relleno = estilo.color_circulo || '#FFFFFF'
  const bordeCirculo = estilo.contorno_circulo || contorno
  return (
    <div
      className="flex h-42 min-w-0 flex-1 flex-col overflow-hidden rounded-[28px]"
      style={{ border: `4px solid ${contorno}`, boxShadow: `0 6px 0 ${contorno}`, backgroundColor: fondo }}
    >
      <div
        className="flex flex-1 items-center justify-center"
        style={{
          backgroundImage: conRayas
            ? `repeating-linear-gradient(135deg, ${raya} 0 0.8rem, transparent 0.8rem 1.6rem)`
            : undefined,
        }}
      >
        {estilo.icono_url && (
          <span
            className="flex h-[4.2rem] w-[4.2rem] items-center justify-center rounded-full"
            style={{ backgroundColor: relleno, border: `3px solid ${bordeCirculo}` }}
          >
            <img src={estilo.icono_url} alt="" className="h-[58%] w-[58%] object-contain" />
          </span>
        )}
      </div>
      <div
        className="flex h-[2.6rem] shrink-0 items-center justify-center truncate px-2 text-lg font-bold uppercase"
        style={{
          borderTop: `3px solid ${contorno}`,
          color: estilo.color_texto || FERIA.botonTexto,
          fontFamily: FUENTE_FERIA,
        }}
      >
        {texto}
      </div>
    </div>
  )
}
