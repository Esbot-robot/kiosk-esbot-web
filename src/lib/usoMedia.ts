/** Dónde se usa un archivo del bucket media: en qué proyecto y en qué parte de su pantalla */
export interface UsoArchivo {
  proyecto: string
  lugar: string
}

type Json = unknown
type Clave = string | number

const objeto = (v: Json): Record<string, Json> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Json>) : null

/** "Botón «Texto»" o solo "Botón" si el botón no tiene texto */
function nombreBoton(base: string, boton: Json): string {
  const texto = objeto(boton)?.texto
  return typeof texto === 'string' && texto.trim() ? `${base} («${texto.trim()}»)` : base
}

/** Texto formal del lugar de la configuración al que apunta una ruta de claves */
function describirLugar(ruta: Clave[], config: Json): string {
  const inicial = objeto(objeto(config)?.pantalla_inicial)
  const ruleta = objeto(config) && objeto(objeto(config)!.pantalla_ruleta)
  const [raiz, a, b, c] = ruta

  if (raiz === 'pantalla_ruleta') return ruleta && a === 'fondo_url' ? 'Fondo de la ruleta de preguntas' : 'Ruleta de preguntas'
  if (raiz !== 'pantalla_inicial') return 'Configuración del proyecto'

  if (a === 'video_patrullaje_url') return 'Video de patrullaje'
  if (a === 'fondo_url') return 'Imagen de fondo de la pantalla inicial'
  if (a === 'logo_url') return 'Logo de la pantalla inicial'

  const imagenOIcono = (clave: Clave | undefined) => (clave === 'icono_url' ? 'ícono' : 'imagen')

  if (a === 'boton') return `Botón Jugar: ${imagenOIcono(b)}`
  if (a === 'botones_adicionales' && typeof b === 'number') {
    const boton = Array.isArray(inicial?.botones_adicionales) ? inicial!.botones_adicionales[b] : null
    const nombre = nombreBoton(`Botón adicional ${b + 1}`, objeto(boton)?.boton)
    if (c === 'video_url') return `${nombre}: video`
    if (c === 'video_trayecto_url') return `${nombre}: video durante el trayecto`
    return `${nombre}: ${imagenOIcono(ruta[4])}`
  }
  if (a === 'boton_foto') {
    if (b === 'marco_url') return 'Botón «Tomar foto»: marco de la promoción'
    return `Botón «Tomar foto»: ${imagenOIcono(c)}`
  }
  if (a === 'boton_registro') return `Botón de registro: ${imagenOIcono(c)}`
  if (a === 'boton_catalogo') return b === 'productos' ? 'Catálogo: imagen de un producto' : `Botón de catálogo: ${imagenOIcono(c)}`
  return 'Pantalla inicial'
}

/** Recorre la configuración y devuelve la ruta de claves de cada texto que contenga `ruta` */
function buscar(valor: Json, ruta: string, camino: Clave[], salida: Clave[][]) {
  if (typeof valor === 'string') {
    if (valor.includes(ruta)) salida.push(camino)
  } else if (Array.isArray(valor)) {
    valor.forEach((v, i) => buscar(v, ruta, [...camino, i], salida))
  } else if (valor && typeof valor === 'object') {
    for (const [k, v] of Object.entries(valor)) buscar(v, ruta, [...camino, k], salida)
  }
}

/** Todos los usos de un archivo en los proyectos dados (la config guarda la ruta dentro de la URL) */
export function usosDeArchivo(ruta: string, proyectos: { nombre: string; config: unknown }[]): UsoArchivo[] {
  const usos: UsoArchivo[] = []
  for (const p of proyectos) {
    const encontrados: Clave[][] = []
    buscar(p.config, ruta, [], encontrados)
    for (const camino of encontrados) usos.push({ proyecto: p.nombre, lugar: describirLugar(camino, p.config) })
  }
  return usos
}
