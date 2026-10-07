/* Utilidades compartidas por las gráficas de Analítica e Inicio */

/* Fechas manejadas como texto plano (sin zonas horarias):
   los eventos se guardan tal cual y se comparan/agrupan por string. */

export function ahoraLocal(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function inicioDeMes(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T00:00`
}

export type Granularidad = 'hora' | 'dia'

/** claves de agrupación entre desde y hasta (ambos "YYYY-MM-DDTHH:mm") */
export function generarBuckets(desde: string, hasta: string, gran: Granularidad): string[] {
  const p = (n: number) => String(n).padStart(2, '0')
  const claves: string[] = []
  const d = new Date(desde)
  const fin = new Date(hasta)
  if (gran === 'hora') {
    d.setMinutes(0, 0, 0)
    while (d <= fin) {
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}`)
      d.setHours(d.getHours() + 1)
    }
  } else {
    d.setHours(0, 0, 0, 0)
    while (d <= fin) {
      claves.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`)
      d.setDate(d.getDate() + 1)
    }
  }
  return claves
}

export function etiquetaBucket(clave: string, gran: Granularidad): string {
  if (gran === 'hora') {
    const [fecha, hora] = clave.split('T')
    const d = new Date(fecha + 'T00:00:00')
    return `${d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })} ${hora}h`
  }
  const d = new Date(clave + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function etiquetaLarga(clave: string, gran: Granularidad): string {
  if (gran === 'hora') {
    const [fecha, hora] = clave.split('T')
    const d = new Date(fecha + 'T00:00:00')
    const dia = d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
    return `${dia} · ${hora}:00 – ${hora}:59`
  }
  const d = new Date(clave + 'T00:00:00')
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

/** Paso "redondo" (1, 2, 5 × 10ⁿ) para que el eje Y tenga números limpios */
export function pasoRedondo(bruto: number): number {
  const base = 10 ** Math.floor(Math.log10(Math.max(bruto, 1)))
  for (const f of [1, 2, 5, 10]) if (f * base >= bruto) return f * base
  return 10 * base
}

/** Curva suave que pasa por cada punto sin inventar picos ni bajar de cero
 *  (interpolación monótona de Fritsch–Carlson) */
export function curvaSuave(pts: [number, number][]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M${pts[0][0]},${pts[0][1]}`
  const m: number[] = []
  for (let i = 0; i < n - 1; i++) m.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]))
  const t: number[] = pts.map((_, i) =>
    i === 0 ? m[0] : i === n - 1 ? m[n - 2] : m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  )
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const tau = 3 / Math.sqrt(s)
      t[i] = tau * a * m[i]
      t[i + 1] = tau * b * m[i]
    }
  }
  let d = `M${pts[0][0]},${pts[0][1]}`
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i]
    const [x1, y1] = pts[i + 1]
    const dx = (x1 - x0) / 3
    d += ` C${x0 + dx},${y0 + t[i] * dx} ${x1 - dx},${y1 - t[i + 1] * dx} ${x1},${y1}`
  }
  return d
}
