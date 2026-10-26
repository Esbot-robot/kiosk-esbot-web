import { createContext, useContext } from 'react'

/**
 * Diseños (plantillas) de la pantalla inicial del robot.
 * El valor viaja en la config del proyecto (pantalla_inicial.diseno). Los
 * robots con una app anterior no lo conocen y muestran el diseño clásico.
 */
export type Diseno = 'clasico' | 'feria' | 'banner'

export const DISENOS: { id: Diseno; nombre: string; descripcion: string }[] = [
  { id: 'clasico', nombre: 'Clásico', descripcion: 'Franjas de lado a lado y botones en píldora' },
  { id: 'feria', nombre: 'Feria', descripcion: 'Título en cinta, botones con borde y sombra' },
  { id: 'banner', nombre: 'Banner', descripcion: 'Imagen arriba y panel de color abajo' },
]

/** Diseño elegido en el editor: los diálogos de los botones muestran solo lo que ese diseño usa */
export const DisenoContext = createContext<Diseno>('clasico')
export function useDiseno(): Diseno {
  return useContext(DisenoContext)
}

/** diseño banner: color del panel cuando el proyecto no define uno */
export const BANNER = { panel: '#FFFFFF' } as const

/** Mezcla un color con blanco: t=0 deja el color, t=1 da blanco (el degradado del banner arranca así arriba) */
export function aclarar(hex: string, t: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((hex || '').trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const mezcla = (c: number) => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')
  return `#${mezcla((n >> 16) & 255)}${mezcla((n >> 8) & 255)}${mezcla(n & 255)}`
}

/**
 * Color de texto legible sobre un fondo: oscuro sobre fondos claros, blanco
 * sobre oscuros. El robot usa la misma regla (luminancia 0,6).
 */
export function colorContraste(fondoHex: string, alfa = 1): string {
  const m = /^#?([0-9a-f]{6})$/i.exec((fondoHex || '').trim())
  const n = m ? parseInt(m[1], 16) : 0xffffff
  const luminancia = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return luminancia > 0.6 ? `rgba(17,24,39,${alfa})` : `rgba(255,255,255,${alfa})`
}

/** colores de respaldo del diseño feria cuando el proyecto no define los suyos */
export const FERIA = {
  tituloFondo: '#FFFFFF',
  tituloTexto: '#111111',
  subtituloFondo: '#111111',
  subtituloTexto: '#FFFFFF',
  botonFondo: '#FFFFFF',
  botonTexto: '#111111',
  contorno: '#111111',
} as const

/** Roboto es la letra normal de Android (Typeface.DEFAULT), la del robot en el clásico y el banner */
export const FUENTE_ROBOT = "'Roboto', 'Arial', sans-serif"

/** Roboto Condensed es la sans-serif-condensed de Android, la del robot */
export const FUENTE_FERIA = "'Roboto Condensed', 'Arial Narrow', sans-serif"

/**
 * Color de las rayas de una tarjeta: el mismo tono de la tarjeta, más oscuro
 * (o más claro si la tarjeta ya es oscura). El robot usa la misma regla.
 */
export function colorRayas(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return 'rgba(0,0,0,0.12)'
  const n = parseInt(m[1], 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  const v = max > 0.35 ? max * 0.86 : Math.min(1, max + 0.12)
  // HSV → RGB
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const mm = v - c
  const [r1, g1, b1] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  const hx = (u: number) => Math.round((u + mm) * 255).toString(16).padStart(2, '0')
  return `#${hx(r1)}${hx(g1)}${hx(b1)}`
}

export function disenoDe(valor: string | undefined | null): Diseno {
  return valor === 'feria' ? 'feria' : valor === 'banner' ? 'banner' : 'clasico'
}
