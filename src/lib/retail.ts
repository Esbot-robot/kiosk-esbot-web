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

/**
 * Zona de la plantilla para los cupones generales: el robot los ofrece fuera de
 * las zonas (pasillos) y en las zonas sin cupones activos hoy. Igual que la app
 * (EventConfig.Retail.ZONA_GENERAL).
 */
export const ZONA_GENERAL = 'General'

export function esZonaGeneral(zona: string): boolean {
  return zona.trim().toLowerCase() === ZONA_GENERAL.toLowerCase()
}

/**
 * Avisos sobre dónde saludará el robot hoy: zonas sin cupones activos (ahí ofrece
 * los generales, si hay) y cupones generales que existen pero no están activos.
 */
export function avisosZonas(cupones: Pick<CuponRetail, 'zona' | 'vigencia_desde' | 'vigencia_hasta'>[], hoy = hoyColombia()): string[] {
  const activo = cupones.map((c) => estadoCupon(c, hoy).estado === 'activo')
  const generales = cupones.filter((c) => esZonaGeneral(c.zona))
  const generalesActivos = cupones.some((c, i) => esZonaGeneral(c.zona) && activo[i])
  const zonas = [...new Set(cupones.map((c) => c.zona.trim()).filter((z) => !esZonaGeneral(z)))]
  const avisos = zonas
    .filter((z) => !cupones.some((c, i) => c.zona.trim() === z && activo[i]))
    .map((z) =>
      generalesActivos
        ? `Zona «${z}» no tiene cupones activos hoy: el robot ofrecerá los cupones generales.`
        : `Zona «${z}» no tiene cupones activos hoy: el robot no saludará en esa zona.`
    )
  if (generales.length > 0 && !generalesActivos) {
    avisos.push('Ningún cupón general está activo hoy: fuera de las zonas el robot no saludará.')
  }
  return avisos
}
