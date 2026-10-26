import { aclarar, colorContraste, colorRayas, FERIA } from '../../lib/disenos'
import { FUENTE_FERIA } from '../../lib/disenos'
import { dp } from '../../lib/pantallaRobot'
import type { BotonEstilo } from '../../types/config'
import { TextoAjustado } from './TextoAjustado'

/** Medidas de TarjetaFeriaDrawable en la app del robot (en dp) */
const RADIO = 28
const GROSOR = 5
const SOMBRA = 8
/** la franja del texto ocupa este tanto del alto de la tarjeta */
const PROPORCION_FRANJA = 0.27

/**
 * Tarjeta del diseño Feria sin imagen propia (vista previa del panel). La app
 * del robot la dibuja igual: color de la tarjeta, rayas diagonales de un tono
 * más oscuro del mismo color, círculo con el ícono (relleno y contorno
 * editables) y la franja de abajo con el texto.
 */
export function TarjetaFeria({
  estilo,
  texto,
  alto,
  tamanoTexto,
  plano = false,
  fondoDefecto = FERIA.botonFondo,
}: {
  estilo: BotonEstilo
  texto: string
  /** alto total del botón en dp, con la sombra dura incluida */
  alto: number
  /** tamaño de la letra en sp, el mismo del resto de los botones */
  tamanoTexto: number
  /** diseño banner: tarjeta lisa, sin borde ni sombra dura ni rayas, con la franja de un tono más oscuro */
  plano?: boolean
  fondoDefecto?: string
}) {
  const cuerpo = alto - (plano ? 0 : SOMBRA)
  const franja = cuerpo * PROPORCION_FRANJA
  const zona = cuerpo - franja // zona de arriba: rayas e ícono
  // Diámetro del círculo: el 64% de la zona, sin pasar de la mitad del ancho
  const diametro = `min(${dp(zona * 0.64)}, 50%)`

  if (plano) {
    const fondo = estilo.color_fondo || fondoDefecto
    const colorFranja = estilo.color_franja || colorRayas(fondo)
    return (
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        style={{
          height: dp(alto),
          borderRadius: dp(RADIO),
          backgroundColor: fondo,
          boxShadow: `0 ${dp(10)} ${dp(18)} rgba(100, 116, 139, 0.32)`,
        }}
      >
        {/* zona del ícono: degradado del color de la tarjeta, más claro arriba */}
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ height: dp(zona), backgroundImage: `linear-gradient(180deg, ${aclarar(fondo, 0.22)}, ${fondo})` }}
        >
          {/* en el banner el ícono va directo sobre el degradado, sin círculo, al 75% del diámetro */}
          {estilo.icono_url && (
            <img
              src={estilo.icono_url}
              alt=""
              className="aspect-square object-contain"
              style={{ width: `calc(${diametro} * 0.75)` }}
            />
          )}
        </div>
        <div
          className="flex shrink-0 items-center font-bold"
          style={{ height: dp(franja), paddingLeft: dp(28), paddingRight: dp(16), backgroundColor: colorFranja, color: colorContraste(colorFranja) }}
        >
          <TextoAjustado texto={texto} tamano={tamanoTexto} />
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
    <div className="min-w-0 flex-1" style={{ height: dp(alto) }}>
      <div
        className="relative flex flex-col overflow-hidden"
        style={{ height: dp(cuerpo), borderRadius: dp(RADIO), backgroundColor: fondo, boxShadow: `0 ${dp(SOMBRA)} 0 ${contorno}` }}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{
            height: dp(zona),
            // rayas "/" de 26 dp de grosor cada 52 dp en horizontal (36,8 dp medidos en diagonal)
            backgroundImage: conRayas
              ? `repeating-linear-gradient(135deg, ${raya} 0 ${dp(26)}, transparent ${dp(26)} ${dp(36.77)})`
              : undefined,
          }}
        >
          {estilo.icono_url && (
            <span
              className="flex aspect-square items-center justify-center rounded-full"
              style={{ width: diametro, backgroundColor: relleno, border: `${dp(GROSOR)} solid ${bordeCirculo}` }}
            >
              <img src={estilo.icono_url} alt="" className="h-[56%] w-[56%] object-contain" />
            </span>
          )}
        </div>
        <div
          className="flex flex-1 items-center justify-center font-bold uppercase"
          style={{
            borderTop: `${dp(4)} solid ${contorno}`,
            marginTop: `-${dp(2)}`,
            paddingInline: dp(16),
            color: estilo.color_texto || FERIA.botonTexto,
            fontFamily: FUENTE_FERIA,
          }}
        >
          <TextoAjustado texto={texto} tamano={tamanoTexto} />
        </div>
        {/* contorno por encima de todo, como en el robot */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ borderRadius: dp(RADIO), border: `${dp(GROSOR)} solid ${contorno}` }}
        />
      </div>
    </div>
  )
}
