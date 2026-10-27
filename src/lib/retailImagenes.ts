import type { CuponRetail, ImagenRetail } from '../types/config'
import { claveTexto } from './catalogo'

/**
 * Imágenes de cupones subidas al panel, para quien no tiene dónde publicarlas.
 *
 * En la plantilla, la columna de la imagen lleva una URL o el nombre del archivo.
 * Con un nombre, el cupón se asocia con la imagen subida que se llame EXACTAMENTE
 * igual: mayúsculas, tildes y espacios cuentan (Cupon.png y cupon.png pueden ser
 * dos cupones distintos). La única tolerancia es la extensión, que Windows oculta:
 * «cupon_bebidas» se asocia con «cupon_bebidas.png» si es la única con ese nombre.
 */

export const MAX_MB_IMAGEN = 2
export const TIPOS_IMAGEN = ['image/png', 'image/jpeg', 'image/webp']

const EXTENSION = /\.[a-z0-9]{2,5}$/i

export function quitarExtension(nombre: string): string {
  return nombre.replace(EXTENSION, '')
}

/** ¿El valor de la columna es un nombre de archivo (y no una URL)? */
export function esNombreDeArchivo(valor: string): boolean {
  return !/^https?:\/\//i.test(valor)
}

export interface Resolucion {
  /** dirección de la imagen subida; vacía si no se encontró */
  url: string
  /** por qué no se encontró (para mostrarlo en la fila del cupón) */
  problema?: string
}

/** Busca la imagen subida que corresponde a un nombre de la plantilla */
export function resolverImagen(nombre: string, imagenes: ImagenRetail[]): Resolucion {
  const exacta = imagenes.find((i) => i.nombre === nombre)
  if (exacta) return { url: exacta.url }

  if (!EXTENSION.test(nombre)) {
    const conExtension = imagenes.filter((i) => quitarExtension(i.nombre) === nombre)
    if (conExtension.length === 1) return { url: conExtension[0].url }
    if (conExtension.length > 1) {
      return {
        url: '',
        problema: `hay varias imágenes llamadas «${nombre}» (${conExtension.map((i) => i.nombre).join(', ')}): escriba el nombre con su extensión.`,
      }
    }
  }

  // No está: se sugieren las que se parecen (otra mayúscula, tilde o espacio), sin asociarlas
  const clave = claveTexto(quitarExtension(nombre))
  const parecida = imagenes.find((i) => claveTexto(quitarExtension(i.nombre)) === clave)
  return {
    url: '',
    problema: `falta subir la imagen «${nombre}».${parecida ? ` ¿Quiso decir «${parecida.nombre}»?` : ''}`,
  }
}

/** Vuelve a asociar los cupones que nombran un archivo, con las imágenes subidas hasta ahora */
export function resolverCupones(cupones: CuponRetail[], imagenes: ImagenRetail[]): CuponRetail[] {
  return cupones.map((c) => (c.imagen_archivo ? { ...c, imagen_url: resolverImagen(c.imagen_archivo, imagenes).url } : c))
}

/** Cupones que esperan su imagen, con el motivo */
export function cuponesSinImagen(cupones: CuponRetail[], imagenes: ImagenRetail[]): { cupon: CuponRetail; problema: string }[] {
  return cupones
    .filter((c) => c.imagen_archivo && !c.imagen_url)
    .map((c) => ({ cupon: c, problema: resolverImagen(c.imagen_archivo!, imagenes).problema ?? 'falta la imagen.' }))
}
