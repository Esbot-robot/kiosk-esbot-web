import { LIMITES, type CuponRetail } from '../types/config'
import { claveTexto, decodificarArchivo, esEnlaceDeCompartir, parsearCsv } from './catalogo'
import { fechaValida } from './retail'

/**
 * Lectura y validación de la plantilla de cupones del Retail (CSV o Excel).
 *
 * Igual que el catálogo: todo se valida aquí, al cargar el archivo, y el robot
 * solo recibe cupones limpios. Un problema en una fila la omite y se reporta con
 * su número (el de Excel: la fila 1 es el encabezado); faltar una columna
 * rechaza el archivo completo. La plantilla es la única fuente de los cupones:
 * cargarla reemplaza la lista entera.
 */

export const MAX_CUPONES = 200

export interface FilaOmitida {
  fila: number
  /** producto (o zona) de la fila, para reconocerla: «Fila 5 (Jabón): …» */
  nombre: string
  motivo: string
}

export interface ResultadoPlantilla {
  cupones: CuponRetail[]
  /** fila de Excel de cada cupón (mismo orden), para reportar después la imagen que no carga */
  filas: number[]
  omitidas: FilaOmitida[]
  /** el archivo no se puede usar (falta una columna, está vacío, etc.) */
  errorGeneral?: string
}

/** Columnas de la plantilla y los nombres que se reconocen para cada una (sin tildes ni mayúsculas) */
const COLUMNAS: Record<keyof Omit<CuponRetail, 'id'>, string[]> = {
  zona: ['zona_de_la_tienda', 'zona'],
  producto: ['producto'],
  frase_detectar: ['frase_al_detectar', 'frase_detectar'],
  frase_mostrar: ['frase_al_mostrar_el_cupon', 'frase_al_mostrar', 'frase_mostrar'],
  frase_despedida: ['frase_de_despedida', 'frase_despedida', 'despedida'],
  vigencia_desde: ['vigencia_desde', 'desde'],
  vigencia_hasta: ['vigencia_hasta', 'hasta'],
  imagen_url: ['url_de_la_imagen_del_cupon', 'url_de_la_imagen', 'cupon:_url_de_la_imagen', 'url_imagen', 'imagen'],
}

/** Nombres que se muestran al pedir una columna que falta (los de la plantilla) */
const NOMBRE_COLUMNA: Record<keyof typeof COLUMNAS, string> = {
  zona: 'Zona de la tienda',
  producto: 'Producto',
  frase_detectar: 'Frase al detectar',
  frase_mostrar: 'Frase al mostrar el cupón',
  frase_despedida: 'Frase de despedida',
  vigencia_desde: 'Vigencia desde',
  vigencia_hasta: 'Vigencia hasta',
  imagen_url: 'URL de la imagen del cupón',
}

const dos = (n: number) => String(n).padStart(2, '0')

/**
 * Una fecha de la plantilla como AAAA-MM-DD. Excel la entrega como fecha (o como
 * número de serie); un CSV como texto: se aceptan 2026-11-01 y 01/11/2026 (día
 * primero, como se escribe en Colombia). Devuelve '' si no se entiende.
 */
export function leerFecha(valor: unknown): string {
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${valor.getUTCFullYear()}-${dos(valor.getUTCMonth() + 1)}-${dos(valor.getUTCDate())}`
  }
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    // número de serie de Excel: días desde el 30 de diciembre de 1899
    return leerFecha(new Date(Date.UTC(1899, 11, 30) + Math.round(valor) * 86_400_000))
  }
  const t = String(valor ?? '').trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t)
  if (m) return `${m[1]}-${dos(+m[2])}-${dos(+m[3])}`
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (m) return `${m[3]}-${dos(+m[2])}-${dos(+m[1])}`
  return ''
}

/** Una celda como texto; las fechas se dejan tal cual para leerFecha */
function celda(valor: unknown): unknown {
  if (valor === null || valor === undefined) return ''
  if (valor instanceof Date) return valor
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : ''
  return String(valor)
}

const texto = (v: unknown) => (v instanceof Date ? '' : String(v ?? '')).replace(/\s+/g, ' ').trim()

/**
 * Identificador estable del cupón: zona + producto. Así, al volver a cargar la
 * plantilla, el mismo cupón conserva su identificador y la analítica lo sigue
 * contando como el mismo.
 */
function idDe(zona: string, producto: string, usados: Set<string>): string {
  const base = `${claveTexto(zona)}__${claveTexto(producto)}`.replace(/[^a-z0-9_]/g, '').slice(0, 80) || 'cupon'
  let id = base
  for (let n = 2; usados.has(id); n++) id = `${base}_${n}`
  usados.add(id)
  return id
}

export function analizarFilasPlantilla(todas: unknown[][]): ResultadoPlantilla {
  const vacio: ResultadoPlantilla = { cupones: [], filas: [], omitidas: [] }
  const filas = todas.map((f) => f.map(celda)).filter((f) => f.some((c) => texto(c) !== '' || c instanceof Date || typeof c === 'number'))
  if (filas.length === 0) return { ...vacio, errorGeneral: 'El archivo está vacío.' }

  // Cada columna se busca por el nombre del encabezado, sin importar el orden
  const encabezado = filas[0].map((c) => claveTexto(texto(c)))
  const indice: Partial<Record<keyof typeof COLUMNAS, number>> = {}
  for (const [columna, alias] of Object.entries(COLUMNAS) as [keyof typeof COLUMNAS, string[]][]) {
    const pos = encabezado.findIndex((e) => alias.includes(e))
    if (pos >= 0) indice[columna] = pos
  }
  const faltan = (Object.keys(COLUMNAS) as (keyof typeof COLUMNAS)[]).filter((c) => indice[c] === undefined)
  if (faltan.length > 0) {
    return {
      ...vacio,
      errorGeneral:
        `${faltan.length === 1 ? 'Falta la columna' : 'Faltan las columnas'} ${faltan.map((c) => `«${NOMBRE_COLUMNA[c]}»`).join(', ')}. ` +
        'Se recomienda usar la plantilla descargable para evitar diferencias en los nombres de las columnas.',
    }
  }
  if (filas.length === 1) return { ...vacio, errorGeneral: 'El archivo solo contiene el encabezado y no incluye cupones.' }

  const valor = (fila: unknown[], columna: keyof typeof COLUMNAS) => fila[indice[columna]!]
  const cupones: CuponRetail[] = []
  const numeros: number[] = []
  const omitidas: FilaOmitida[] = []
  const usados = new Set<string>()

  filas.slice(1).forEach((fila, i) => {
    const numero = i + 2 // igual que Excel: la fila 1 es el encabezado
    const zona = texto(valor(fila, 'zona'))
    const producto = texto(valor(fila, 'producto'))
    const nombre = producto || zona
    const omitir = (motivo: string) => omitidas.push({ fila: numero, nombre, motivo })

    if (!zona) return omitir('falta la zona.')
    if (!producto) return omitir('falta el producto.')
    const frases = {
      frase_detectar: texto(valor(fila, 'frase_detectar')),
      frase_mostrar: texto(valor(fila, 'frase_mostrar')),
      frase_despedida: texto(valor(fila, 'frase_despedida')),
    }
    if (!frases.frase_detectar) return omitir('falta la frase al detectar.')
    if (!frases.frase_mostrar) return omitir('falta la frase al mostrar el cupón.')
    if (!frases.frase_despedida) return omitir('falta la frase de despedida.')
    const larga = Object.values(frases).find((f) => f.length > LIMITES.TTS_MAX)
    if (larga) return omitir(`una de las frases supera los ${LIMITES.TTS_MAX} caracteres.`)

    const desde = leerFecha(valor(fila, 'vigencia_desde'))
    const hasta = leerFecha(valor(fila, 'vigencia_hasta'))
    if (!fechaValida(desde)) return omitir('la fecha «Vigencia desde» no es válida (formato esperado: 2026-11-01 o 01/11/2026).')
    if (!fechaValida(hasta)) return omitir('la fecha «Vigencia hasta» no es válida (formato esperado: 2026-11-30 o 30/11/2026).')
    if (hasta < desde) return omitir('la fecha «Vigencia hasta» es anterior a «Vigencia desde».')

    const imagen = texto(valor(fila, 'imagen_url'))
    if (!/^https?:\/\//i.test(imagen)) return omitir('la URL de la imagen está vacía o no comienza por https://.')
    if (esEnlaceDeCompartir(imagen)) return omitir('la URL corresponde a un enlace para compartir (Drive, Dropbox) y no a la imagen.')

    if (cupones.length >= MAX_CUPONES) return omitir(`se alcanzó el máximo de ${MAX_CUPONES} cupones por proyecto.`)
    numeros.push(numero)
    cupones.push({
      id: idDe(zona, producto, usados),
      zona,
      producto,
      ...frases,
      vigencia_desde: desde,
      vigencia_hasta: hasta,
      imagen_url: imagen,
    })
  })

  return { cupones, filas: numeros, omitidas }
}

/** Lee el archivo que subió el usuario: CSV o Excel (.xlsx, primera hoja) */
export async function analizarPlantilla(archivo: File): Promise<ResultadoPlantilla> {
  const nombre = archivo.name.toLowerCase()
  if (nombre.endsWith('.xlsx')) {
    // se carga solo cuando hace falta: la librería no pesa en el resto del panel
    const { readSheet } = await import('read-excel-file/browser')
    return analizarFilasPlantilla(await readSheet(archivo))
  }
  if (nombre.endsWith('.xls')) {
    return {
      cupones: [],
      filas: [],
      omitidas: [],
      errorGeneral: 'No es posible leer archivos .xls (formato antiguo de Excel). Guárdelo como .xlsx o CSV UTF-8.',
    }
  }
  return analizarFilasPlantilla(parsearCsv(decodificarArchivo(await archivo.arrayBuffer())))
}

/**
 * Comprueba que cada imagen cargue de verdad, como la verá el robot. Va de a
 * pocas a la vez y espera hasta 15 s por imagen. Devuelve las URL que fallaron.
 */
export async function comprobarImagenes(urls: string[], onAvance?: (hechas: number, total: number) => void): Promise<Set<string>> {
  const unicas = [...new Set(urls)]
  const fallidas = new Set<string>()
  let hechas = 0
  const carga = (url: string) =>
    new Promise<boolean>((resolver) => {
      const img = new Image()
      const limite = setTimeout(() => resolver(false), 15_000)
      img.onload = () => {
        clearTimeout(limite)
        resolver(img.naturalWidth > 0)
      }
      img.onerror = () => {
        clearTimeout(limite)
        resolver(false)
      }
      img.referrerPolicy = 'no-referrer'
      img.src = url
    })
  for (let i = 0; i < unicas.length; i += 5) {
    await Promise.all(
      unicas.slice(i, i + 5).map(async (url) => {
        if (!(await carga(url))) fallidas.add(url)
        onAvance?.(++hechas, unicas.length)
      })
    )
  }
  return fallidas
}

/** Plantilla descargable: separador ";" y BOM para que Excel en español la abra bien */
export function plantillaCuponesCsv(): string {
  const filas = [
    'Zona de la tienda;Producto;Frase al detectar;Frase al mostrar el cupón;Frase de despedida;Vigencia desde;Vigencia hasta;URL de la imagen del cupón',
    'Bebidas;Gaseosas de 400 ml;¡Hola! Hoy las gaseosas de 400 ml están 2x1 en esta zona.;¡Aquí está tu cupón! Muéstralo en caja.;¡Gracias por elegirnos!;2026-11-01;2026-11-30;https://ejemplo.com/cupones/bebidas.png',
    'Lácteos;Yogur griego;¿Ya probaste nuestro yogur griego? Hoy tiene descuento.;Este es tu cupón, preséntalo al pagar.;¡Que disfrutes tu compra!;2026-11-01;2026-11-15;https://ejemplo.com/cupones/yogur.png',
  ]
  return '﻿' + filas.join('\r\n') + '\r\n'
}

export function descargarPlantillaCupones() {
  const blob = new Blob([plantillaCuponesCsv()], { type: 'text/csv;charset=utf-8' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = 'plantilla_cupones.csv'
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}
