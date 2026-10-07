/** Archivo del bucket media (solo su ficha: nombre, tamaño y fecha; nunca el contenido) */
export interface ArchivoMedia {
  /** ruta completa dentro del bucket: {id del proyecto}/{archivo} */
  ruta: string
  carpeta: string
  nombre: string
  tamano: number
  tipo: string
  creado: string | null
}

export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const unidades = ['KB', 'MB', 'GB', 'TB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < unidades.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('es-CO', { maximumFractionDigits: v < 10 ? 1 : 0 })} ${unidades[i]}`
}

/** Videos que ninguna configuración menciona (la config guarda la ruta del archivo) */
export function videosSinUso(archivos: ArchivoMedia[], configs: unknown[]): ArchivoMedia[] {
  const enUso = JSON.stringify(configs)
  return archivos
    .filter((a) => a.tipo.startsWith('video/') && !enUso.includes(a.ruta))
    .sort((a, b) => b.tamano - a.tamano)
}
