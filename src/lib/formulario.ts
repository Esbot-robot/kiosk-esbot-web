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
