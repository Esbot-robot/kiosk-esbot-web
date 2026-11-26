import type { CamposFormulario, FormularioRegistro } from '../types/config'

/** largo máximo de las despedidas del robot */
export const MAX_DESPEDIDA = 200

/**
 * Los campos que pide el formulario. Lo que falte cuenta como activo (proyectos
 * guardados antes de poder quitarlos), y si quedaran todos apagados se piden
 * los tres: un formulario sin campos no registra a nadie.
 */
export function camposDe(f: Partial<FormularioRegistro> | undefined): CamposFormulario {
  const c = f?.campos
  const campos = { nombre: c?.nombre !== false, correo: c?.correo !== false, celular: c?.celular !== false }
  return campos.nombre || campos.correo || campos.celular ? campos : { nombre: true, correo: true, celular: true }
}

/** Error de validación del formulario, o '' si está completo */
export function validarFormulario(f: FormularioRegistro, conNombre: string): string {
  if (!f.titulo.trim()) return 'Ingrese el título del formulario.'
  const c = f.campos
  if (c && !c.nombre && !c.correo && !c.celular) return 'El formulario debe pedir al menos un dato.'
  if (!f.texto_autorizacion.trim()) return 'Ingrese el texto de autorización de datos.'
  if (!/^#[0-9a-fA-F]{6}$/.test(f.color)) return 'Seleccione el color del formulario (6 dígitos hexadecimales).'
  if (f.politica_url.trim() && !/^https?:\/\/\S+$/.test(f.politica_url.trim())) {
    return 'La URL de la política debe iniciar con https://'
  }
  // Sin el campo Nombre el robot siempre usa la despedida sin nombre
  if (camposDe(f).nombre && !conNombre.includes('{nombre}')) {
    return 'El mensaje de despedida con nombre debe incluir {nombre}.'
  }
  return ''
}

export function limpiarFormulario(f: FormularioRegistro): FormularioRegistro {
  return {
    titulo: f.titulo.trim(),
    subtitulo: f.subtitulo.trim(),
    color: f.color,
    texto_autorizacion: f.texto_autorizacion.trim(),
    politica_url: f.politica_url.trim(),
    campos: camposDe(f),
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
