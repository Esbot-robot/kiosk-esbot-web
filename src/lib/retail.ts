import type { CuponRetail } from '../types/config'

/**
 * Vigencia de los cupones del Retail. La app del robot usa la misma regla
 * (EventConfig.CuponRetail.vigenteEl): fechas AAAA-MM-DD, días incluidos y la
 * fecha de Colombia, así lo que el panel muestra como activo es lo que el
 * robot ofrece ese día.
 */

const FECHA = /^\d{4}-\d{2}-\d{2}$/

/** Fecha de hoy en Colombia, AAAA-MM-DD */
export function hoyColombia(ahora = new Date()): string {
  // en-CA escribe las fechas como AAAA-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(ahora)
}

export function fechaValida(fecha: string): boolean {
  if (!FECHA.test(fecha)) return false
  const [a, m, d] = fecha.split('-').map(Number)
  const dia = new Date(Date.UTC(a, m - 1, d))
  return dia.getUTCFullYear() === a && dia.getUTCMonth() === m - 1 && dia.getUTCDate() === d
}

/** Días de la fecha a hasta la b (negativo si b es anterior) */
export function diasEntre(a: string, b: string): number {
  const utc = (f: string) => {
    const [anio, mes, dia] = f.split('-').map(Number)
    return Date.UTC(anio, mes - 1, dia)
  }
  return Math.round((utc(b) - utc(a)) / 86_400_000)
}

export type EstadoCupon =
  /** se ofrece hoy; dias = cuántos faltan para que venza (0 = vence hoy) */
  | { estado: 'activo'; dias: number }
  /** todavía no empieza; dias = en cuántos se activa */
  | { estado: 'por_activar'; dias: number }
  /** ya pasó su fecha final; dias = hace cuántos venció */
  | { estado: 'vencido'; dias: number }

export function estadoCupon(cupon: Pick<CuponRetail, 'vigencia_desde' | 'vigencia_hasta'>, hoy = hoyColombia()): EstadoCupon {
  if (hoy < cupon.vigencia_desde) return { estado: 'por_activar', dias: diasEntre(hoy, cupon.vigencia_desde) }
  if (hoy > cupon.vigencia_hasta) return { estado: 'vencido', dias: diasEntre(cupon.vigencia_hasta, hoy) }
  return { estado: 'activo', dias: diasEntre(hoy, cupon.vigencia_hasta) }
}
