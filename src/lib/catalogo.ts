import type { ProductoCatalogo } from '../types/config'

/**
 * Lectura y validación del CSV del catálogo.
 *
 * Todo se valida aquí, al subir el archivo: el robot solo recibe productos ya
 * limpios. Un problema en una fila la omite y se reporta con su número (el mismo
 * que muestra Excel: la fila 1 es el encabezado); solo faltar una columna
 * obligatoria rechaza el archivo completo.
 */

export const MAX_PRODUCTOS = 500
/** a partir de aquí se avisa: el catálogo ya es grande para la config y las imágenes */
export const PRODUCTOS_AVISO = 300
const MAX_NOMBRE = 120
const MAX_DESCRIPCION = 600
const MAX_CATEGORIA = 40

export interface FilaOmitida {
  fila: number
  motivo: string
}

export interface CategoriaDetectada {
  nombre: string
  cantidad: number
}

export interface ResultadoCsv {
  productos: ProductoCatalogo[]
  omitidas: FilaOmitida[]
  /** cosas que no impiden cargar el producto pero conviene revisar */
  advertencias: string[]
  categorias: CategoriaDetectada[]
  sinCategoria: number
  /** categorías que parecen la misma escrita distinto: ["Cafe", "Café"] */
  similares: string[][]
  /** el archivo no se puede usar (falta una columna, está vacío, etc.) */
  errorGeneral?: string
}

/** Columnas aceptadas y los nombres alternativos que se reconocen para cada una */
const COLUMNAS: Record<string, string[]> = {
  nombre: ['nombre', 'producto'],
  precio: ['precio', 'valor'],
  url_imagen: ['url_imagen', 'imagen', 'url_de_imagen', 'foto'],
  stock: ['stock', 'inventario', 'existencias'],
  precio_anterior: ['precio_anterior', 'precio_antes', 'precio_antiguo'],
  descripcion: ['descripcion'],
  categoria: ['categoria'],
}
const OBLIGATORIAS = ['nombre', 'precio', 'url_imagen']

/** Sin mayúsculas, tildes ni espacios sobrantes; los espacios internos pasan a "_" */
function claveTexto(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
}

/** UTF-8 si el archivo lo es; si no (Excel antiguo), Windows-1252 para que las tildes no salgan raras */
export function decodificarArchivo(buffer: ArrayBuffer): string {
  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    texto = new TextDecoder('windows-1252').decode(buffer)
  }
  return texto.replace(/^\uFEFF/, '')
}

/** Separador más usado en la primera línea (fuera de comillas): ";", "," o tabulador */
function detectarSeparador(texto: string): string {
  const cuentas: Record<string, number> = { ';': 0, ',': 0, '\t': 0 }
  let enComillas = false
  for (const c of texto) {
    if (c === '"') enComillas = !enComillas
    else if (!enComillas && (c === '\n' || c === '\r')) break
    else if (!enComillas && c in cuentas) cuentas[c]++
  }
  return Object.entries(cuentas).sort((a, b) => b[1] - a[1])[0][0]
}

/** CSV con comillas: admite separadores y saltos de línea dentro de un campo entre comillas */
export function parsearCsv(texto: string): string[][] {
  const separador = detectarSeparador(texto)
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ''
  let enComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"'
          i++
        } else enComillas = false
      } else campo += c
    } else if (c === '"') enComillas = true
    else if (c === separador) {
      fila.push(campo)
      campo = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && texto[i + 1] === '\n') i++
      fila.push(campo)
      campo = ''
      filas.push(fila)
      fila = []
    } else campo += c
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo)
    filas.push(fila)
  }
  return filas
}

/**
 * Valor en pesos, con centavos si los trae. Acepta "$ 12.500", "12,500", "12500",
 * "94,790.41" (formato inglés), "94.790,41" (formato colombiano) y "12500.00".
 * Con los dos separadores, el último es el decimal. Con uno solo, un punto o coma
 * seguido de exactamente tres cifras es separador de miles; en cualquier otro caso
 * es decimal. Los centavos se conservan (hasta 2 decimales).
 */
export function leerPesos(bruto: string): { valor: number | null; nota?: string } {
  let t = bruto.replace(/cop/gi, '').replace(/[$\s]/g, '')
  if (t === '') return { valor: null }
  if (!/^[0-9.,]+$/.test(t)) return { valor: null }

  const puntos = (t.match(/\./g) ?? []).length
  const comas = (t.match(/,/g) ?? []).length
  let nota: string | undefined
  if (puntos > 0 && comas > 0) {
    // el último separador es el decimal
    const ultimo = Math.max(t.lastIndexOf('.'), t.lastIndexOf(','))
    const entero = t.slice(0, ultimo).replace(/[.,]/g, '')
    t = `${entero}.${t.slice(ultimo + 1)}`
  } else if (puntos + comas > 1) {
    t = t.replace(/[.,]/g, '')
  } else if (puntos + comas === 1) {
    const sep = puntos === 1 ? '.' : ','
    const [antes, despues] = t.split(sep)
    if (despues.length === 3 && antes.length >= 1) t = antes + despues
    else {
      t = `${antes}.${despues}`
      // más de 2 decimales no son centavos: se redondea y se avisa
      if (despues.length > 2) nota = `se leyó "${bruto.trim()}" como ${(Math.round(Number(t) * 100) / 100).toFixed(2)}`
    }
  }
  const numero = Number(t)
  if (!Number.isFinite(numero) || numero < 0) return { valor: null }
  return { valor: Math.round(numero * 100) / 100, nota }
}

/** $94.790,41 con centavos; $289.000 si son cero (formato colombiano) */
export function formatearPesos(valor: number): string {
  const conCentavos = Math.round(valor * 100) % 100 !== 0
  const digitos = conCentavos ? 2 : 0
  return `$${new Intl.NumberFormat('es-CO', { minimumFractionDigits: digitos, maximumFractionDigits: digitos }).format(valor)}`
}

function limpiarTexto(valor: string | undefined): string {
  return (valor ?? '').replace(/\s+/g, ' ').trim()
}

/** Enlaces de "compartir" de Drive o Dropbox: abren una página, no la imagen */
function esEnlaceDeCompartir(url: string): boolean {
  return /drive\.google\.com|dropbox\.com\/s\/|dropbox\.com\/scl\/|onedrive\.live\.com|1drv\.ms/i.test(url)
}

export function analizarCsv(texto: string): ResultadoCsv {
  return analizarFilas(parsearCsv(texto))
}

/** Una celda de Excel como texto: los números llegan como número, no como "289.000" */
function celdaATexto(valor: unknown): string {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : ''
  if (typeof valor === 'string') return valor
  return ''
}

/** Lee el archivo que subió el usuario: CSV o Excel (.xlsx, primera hoja) */
export async function analizarArchivo(archivo: File): Promise<ResultadoCsv> {
  const nombre = archivo.name.toLowerCase()
  if (nombre.endsWith('.xlsx')) {
    // se carga solo cuando hace falta: la librería no pesa en el resto del panel
    const { readSheet } = await import('read-excel-file/browser')
    const hoja = await readSheet(archivo)
    return analizarFilas(hoja.map((fila) => fila.map(celdaATexto)))
  }
  if (nombre.endsWith('.xls')) {
    return {
      productos: [],
      omitidas: [],
      advertencias: [],
      categorias: [],
      sinCategoria: 0,
      similares: [],
      errorGeneral: 'Los archivos .xls (Excel antiguo) no se pueden leer. Guárdalo como .xlsx o como CSV UTF-8.',
    }
  }
  return analizarCsv(decodificarArchivo(await archivo.arrayBuffer()))
}

export function analizarFilas(todas: string[][]): ResultadoCsv {
  const vacio: ResultadoCsv = { productos: [], omitidas: [], advertencias: [], categorias: [], sinCategoria: 0, similares: [] }
  const filas = todas.filter((f) => f.some((c) => c.trim() !== ''))
  if (filas.length === 0) return { ...vacio, errorGeneral: 'El archivo está vacío.' }

  // Cada columna se busca por el nombre del encabezado, sin importar el orden
  const encabezado = filas[0].map(claveTexto)
  const indice: Record<string, number> = {}
  for (const [columna, alias] of Object.entries(COLUMNAS)) {
    const pos = encabezado.findIndex((e) => alias.includes(e))
    if (pos >= 0) indice[columna] = pos
  }
  const faltan = OBLIGATORIAS.filter((c) => indice[c] === undefined)
  if (faltan.length > 0) {
    const encontradas = filas[0].map((c) => c.trim()).filter(Boolean).join(', ')
    return {
      ...vacio,
      errorGeneral:
        `Falta la columna ${faltan.map((c) => `"${c}"`).join(', ')}. ` +
        `El archivo trae: ${encontradas || 'ninguna columna con nombre'}. ` +
        'Usa la plantilla para no equivocarte con los nombres.',
    }
  }
  if (filas.length === 1) return { ...vacio, errorGeneral: 'El archivo solo tiene el encabezado, sin productos.' }

  const celda = (fila: string[], columna: string) => (indice[columna] === undefined ? '' : (fila[indice[columna]] ?? ''))

  const productos: ProductoCatalogo[] = []
  const omitidas: FilaOmitida[] = []
  const advertencias: string[] = []
  const nombresVistos = new Map<string, number>()

  filas.slice(1).forEach((fila, i) => {
    const numero = i + 2 // igual que Excel: la fila 1 es el encabezado
    const nombre = limpiarTexto(celda(fila, 'nombre'))
    if (!nombre) {
      omitidas.push({ fila: numero, motivo: 'falta el nombre' })
      return
    }
    const precio = leerPesos(celda(fila, 'precio'))
    if (precio.valor === null) {
      omitidas.push({
        fila: numero,
        motivo: celda(fila, 'precio').trim()
          ? `"${nombre}": el precio "${celda(fila, 'precio').trim()}" no es un número`
          : `"${nombre}": falta el precio`,
      })
      return
    }
    if (precio.nota) advertencias.push(`Fila ${numero} ("${nombre}"): ${precio.nota}. Revisa el precio.`)

    // stock: vacío = disponible
    let stock: number | null = null
    const stockBruto = celda(fila, 'stock').trim()
    if (stockBruto) {
      const n = Number(stockBruto.replace(/[.,]/g, ''))
      if (Number.isFinite(n) && n >= 0) stock = Math.round(n)
      else advertencias.push(`Fila ${numero} ("${nombre}"): el stock "${stockBruto}" no es un número; se tomó como disponible.`)
    }

    let precioAnterior: number | null = null
    const anteriorBruto = celda(fila, 'precio_anterior').trim()
    if (anteriorBruto) {
      const ant = leerPesos(anteriorBruto)
      if (ant.valor === null) advertencias.push(`Fila ${numero} ("${nombre}"): el precio anterior "${anteriorBruto}" no es un número y se ignoró.`)
      else if (ant.valor > precio.valor && precio.valor > 0) precioAnterior = ant.valor
      else if (ant.valor > 0 && precio.valor > 0) {
        // Un "antes" menor o igual al precio no es un descuento: no se tacha, pero se avisa porque suele ser un error del archivo
        advertencias.push(
          `Fila ${numero} ("${nombre}"): el precio anterior (${formatearPesos(ant.valor)}) no es mayor que el precio (${formatearPesos(precio.valor)}), así que no se mostrará tachado. ¿Están al revés?`
        )
      }
    }

    let imagen = celda(fila, 'url_imagen').trim()
    if (imagen) {
      if (!/^https?:\/\//i.test(imagen)) {
        advertencias.push(`Fila ${numero} ("${nombre}"): el enlace de la imagen no empieza por http:// o https://; saldrá sin imagen.`)
        imagen = ''
      } else if (esEnlaceDeCompartir(imagen)) {
        advertencias.push(
          `Fila ${numero} ("${nombre}"): parece un enlace para compartir (Drive, Dropbox…), no una imagen directa; probablemente saldrá sin imagen.`
        )
      }
    }

    const categoria = limpiarTexto(celda(fila, 'categoria')).slice(0, MAX_CATEGORIA)
    const previo = nombresVistos.get(claveTexto(nombre))
    if (previo !== undefined) advertencias.push(`Fila ${numero}: "${nombre}" ya aparece en la fila ${previo}.`)
    else nombresVistos.set(claveTexto(nombre), numero)

    productos.push({
      nombre: nombre.slice(0, MAX_NOMBRE),
      precio: precio.valor,
      stock,
      imagen_url: imagen,
      precio_anterior: precioAnterior,
      descripcion: limpiarTexto(celda(fila, 'descripcion')).slice(0, MAX_DESCRIPCION),
      categoria,
    })
  })

  if (productos.length === 0) {
    return { ...vacio, omitidas, advertencias, errorGeneral: 'Ninguna fila tiene un producto válido (nombre y precio).' }
  }
  if (productos.length > MAX_PRODUCTOS) {
    return {
      ...vacio,
      omitidas,
      advertencias,
      errorGeneral: `El archivo tiene ${productos.length} productos y el máximo es ${MAX_PRODUCTOS}. Divídelo en varios proyectos o reduce el catálogo.`,
    }
  }

  // Categorías en el orden en que aparecen; se avisa de las que se parecen
  const conteo = new Map<string, number>()
  let sinCategoria = 0
  for (const p of productos) {
    if (!p.categoria) sinCategoria++
    else conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1)
  }
  const categorias = [...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
  const grupos = new Map<string, string[]>()
  for (const c of categorias) {
    const clave = claveTexto(c.nombre)
    grupos.set(clave, [...(grupos.get(clave) ?? []), c.nombre])
  }
  const similares = [...grupos.values()].filter((g) => g.length > 1)

  return { productos, omitidas, advertencias, categorias, sinCategoria, similares }
}

/** Plantilla descargable: separador ";" y BOM para que Excel en español la abra bien */
export function plantillaCsv(): string {
  const filas = [
    'nombre;precio;stock;url_imagen;precio_anterior;descripcion;categoria',
    'Audífonos inalámbricos;289000;30;https://ejemplo.com/img/audifonos.jpg;329000;Audífonos con cancelación de ruido y 30 horas de batería.;Audio',
    'Teclado mecánico;195000;12;https://ejemplo.com/img/teclado.jpg;;Teclado de aluminio con interruptores silenciosos.;Escritorio',
    'Lámpara de cerámica;142000;0;https://ejemplo.com/img/lampara.jpg;175000;Lámpara para escritorio con luz cálida.;Hogar',
  ]
  return '\uFEFF' + filas.join('\r\n') + '\r\n'
}

export function descargarPlantilla() {
  const blob = new Blob([plantillaCsv()], { type: 'text/csv;charset=utf-8' })
  const enlace = document.createElement('a')
  enlace.href = URL.createObjectURL(blob)
  enlace.download = 'plantilla_catalogo.csv'
  enlace.click()
  URL.revokeObjectURL(enlace.href)
}

/**
 * Porcentaje de descuento entero (1 a 99) entre el precio anterior y el precio; null si no hay descuento.
 * Se trunca y no se redondea (13,8 % es 13 %): así coincide con las tiendas en línea y nunca se anuncia
 * más descuento del real. Igual que EventConfig.kt en la app.
 */
export function porcentajeDescuento(p: ProductoCatalogo): number | null {
  if (!p.precio_anterior || p.precio <= 0 || p.precio_anterior <= p.precio) return null
  const pct = Math.floor(((p.precio_anterior - p.precio) * 100) / p.precio_anterior)
  return pct >= 1 ? Math.min(pct, 99) : null
}

/** Agotado: precio 0 o stock 0 */
export function estaAgotado(p: ProductoCatalogo): boolean {
  return p.precio === 0 || p.stock === 0
}
