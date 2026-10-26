/**
 * Pantalla del temi, medida con adb en dos robots (oct 2026): 1920 × 1080 px a
 * densidad 180, o sea 1 dp = 1,125 px y la pantalla mide 1706,67 × 960 dp.
 *
 * La app del robot define todo en dp (y los textos en sp, que con la letra del
 * sistema al 100 % valen lo mismo), así que la vista previa del editor usa la
 * misma unidad: cada medida de MainActivity se copia tal cual con dp().
 */
export const PANTALLA_DP = { ancho: 1920 / (180 / 160), alto: 1080 / (180 / 160) } as const

/**
 * Ancho del lienzo de la vista previa, en rem: 48rem = 768 px al tamaño base
 * normal (16 px). Va en rem y no en px porque los textos y botones de adentro
 * también van en rem: así guardan la misma proporción aunque el panel cambie
 * su tamaño base (en computador se ve al 80%, ver index.css).
 */
export const ANCHO_VISTA_REM = 48

/** Una medida de la app del robot (dp o sp) convertida al lienzo de la vista previa */
export function dp(n: number): string {
  return `${(n * ANCHO_VISTA_REM) / PANTALLA_DP.ancho}rem`
}
