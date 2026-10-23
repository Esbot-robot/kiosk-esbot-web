import { url as supabaseUrl } from './supabase'
import { existeArchivo } from './storage'
import type { EventConfig } from '../types/config'

export interface ArchivoProyecto {
  nombre: string
  url: string
}

/** existe, falta (el almacenamiento dice que no está) o no se pudo comprobar (sin internet, error del servidor) */
export type EstadoArchivo = 'existe' | 'falta' | 'desconocido'

export interface ResultadoArchivo extends ArchivoProyecto {
  estado: EstadoArchivo
}

/** Solo se comprueban los archivos del almacenamiento del panel; una imagen de otra web no es asunto de aquí */
const PREFIJO = `${supabaseUrl}/storage/v1/object/public/`

/**
 * Los archivos que baja el robot al actualizarse: la MISMA lista de ConfigRepository.downloadAssets
 * en la app. Cuenta lo que la configuración referencia, esté o no activo el botón, porque el robot
 * lo baja igual y un solo archivo que falte frena toda la actualización.
 * Un campo vacío no es un archivo que falta: no aparece aquí.
 */
export function archivosDeConfig(config: EventConfig): ArchivoProyecto[] {
  const ini = config.pantalla_inicial
  const rul = config.pantalla_ruleta
  const lista: Array<[string, string | undefined]> = [
    ['Video de patrullaje', ini.video_patrullaje_url],
    ['Fondo de la pantalla inicial', ini.fondo_url],
    ['Logo', ini.logo_url],
    ['Fondo del quiz', rul.fondo_url],
    ['Imagen del botón Jugar', ini.boton.imagen_url],
    ['Marco de la foto', ini.boton_foto.marco_url],
    ['Imagen del botón de foto', ini.boton_foto.boton.imagen_url],
    ['Imagen del botón de registro', ini.boton_registro.boton.imagen_url],
    ['Imagen del botón de catálogo', ini.boton_catalogo?.boton.imagen_url],
    ['Ícono del botón Jugar', ini.boton.icono_url],
    ['Ícono del botón de foto', ini.boton_foto.boton.icono_url],
    ['Ícono del botón de registro', ini.boton_registro.boton.icono_url],
    ['Ícono del botón de catálogo', ini.boton_catalogo?.boton.icono_url],
  ]
  ini.botones_adicionales.forEach((b, i) => {
    lista.push(
      [`Imagen del botón adicional ${i + 1}`, b.boton.imagen_url],
      [`Ícono del botón adicional ${i + 1}`, b.boton.icono_url],
      [`Video del botón adicional ${i + 1}`, b.video_url],
      [`Video de trayecto del botón ${i + 1}`, b.video_trayecto_url]
    )
  })
  return lista
    .filter((par): par is [string, string] => !!par[1] && par[1].startsWith(PREFIJO))
    .map(([nombre, url]) => ({ nombre, url }))
}

/** Pregunta al almacenamiento por cada archivo (una consulta corta, sin descargarlo), de a pocos a la vez */
export async function comprobarArchivos(archivos: ArchivoProyecto[]): Promise<ResultadoArchivo[]> {
  const direcciones = [...new Set(archivos.map((a) => a.url))]
  const estados = new Map<string, EstadoArchivo>()
  const TANDA = 5
  for (let i = 0; i < direcciones.length; i += TANDA) {
    await Promise.all(
      direcciones.slice(i, i + TANDA).map(async (direccion) => {
        const existe = await existeArchivo(direccion)
        estados.set(direccion, existe === true ? 'existe' : existe === false ? 'falta' : 'desconocido')
      })
    )
  }
  return archivos.map((a) => ({ ...a, estado: estados.get(a.url) ?? 'desconocido' }))
}
