/** Blanco o negro, el que se lea mejor sobre el color de fondo */
export function colorTextoSobre(hex: string): string {
  const n = Number.parseInt(hex.replace('#', ''), 16)
  if (!Number.isFinite(n)) return '#ffffff'
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  // Luminancia percibida (ITU-R BT.601): sobre 150 el fondo es claro
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#111827' : '#ffffff'
}
