import type { FormularioRegistro } from '../types/config'

/** largo máximo de las despedidas del robot */
export const MAX_DESPEDIDA = 200

/** Error de validación del formulario, o '' si está completo */
export function validarFormulario(f: FormularioRegistro, conNombre: string): string {
  if (!f.titulo.trim()) return 'Escribe el título del formulario.'
  if (!f.texto_autorizacion.trim()) return 'Escribe el texto de autorización de datos.'
  if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) return 'Elige el color del formulario (6 dígitos hexadecimales).'
  if (f.politica_url.trim() && !/^https?:\/\/\S+$/.test(f.politica_url.trim())) {
    return 'El enlace de la política debe empezar por https://'
  }
  if (!conNombre.includes('{nombre}')) return 'La despedida con nombre debe incluir {nombre}.'
  return ''
}

export function limpiarFormulario(f: FormularioRegistro): FormularioRegistro {
  return {
    titulo: f.titulo.trim(),
    subtitulo: f.subtitulo.trim(),
    color: f.color,
    texto_autorizacion: f.texto_autorizacion.trim(),
    politica_url: f.politica_url.trim(),
  }
}

/**
 * Enlace de vista previa del formulario: los textos y el color viajan dentro
 * de la dirección (después del #), así se ve lo que está en el diálogo aunque
 * no se haya guardado. No consulta la base ni guarda nada.
 */
export function enlaceVistaPrevia(origen: 'foto' | 'registro', formulario: FormularioRegistro): string {
  const bytes = new TextEncoder().encode(JSON.stringify({ o: origen, f: formulario }))
  let binario = ''
  bytes.forEach((b) => (binario += String.fromCharCode(b)))
  const datos = btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${window.location.origin}/registro#vista.${datos}`
}

/** Lee un enlace de vista previa; null si la clave no es de vista previa o está dañada */
export function leerVistaPrevia(clave: string): { origen: 'foto' | 'registro'; formulario: Partial<FormularioRegistro> } | null {
  if (!clave.startsWith('vista.')) return null
  try {
    const datos = clave.slice('vista.'.length).replace(/-/g, '+').replace(/_/g, '/')
    const binario = atob(datos)
    const json = new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)))
    const { o, f } = JSON.parse(json) as { o: string; f: Partial<FormularioRegistro> }
    return { origen: o === 'foto' ? 'foto' : 'registro', formulario: f ?? {} }
  } catch {
    return null
  }
}
