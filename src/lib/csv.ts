/**
 * Neutraliza el texto que Excel interpretaría como fórmula (empieza por =, +, - o @):
 * un visitante podría escribir una en el formulario y ejecutarse al abrir el CSV.
 * Los números y teléfonos (+57 300…) pasan sin cambios.
 */
export function neutralizarFormula(texto: string): string {
  if (/^[\t\r]/.test(texto)) return `'${texto}`
  if (!/^[=+\-@]/.test(texto)) return texto
  if (/^[+-]?[\d\s().-]+$/.test(texto)) return texto
  return `'${texto}`
}
