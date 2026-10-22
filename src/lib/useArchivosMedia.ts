import { useQuery } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { ArchivoMedia } from './media'

/**
 * Fichas de los archivos del bucket media (nombre, tamaño, tipo, fecha), nunca
 * el contenido, así que no suma egress. Cada proyecto tiene su propia carpeta.
 */
export function useArchivosMedia() {
  return useQuery({
    queryKey: ['media', 'archivos'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ArchivoMedia[]> => {
      type Item = { name: string; id: string | null; created_at: string | null; metadata: { size?: number; mimetype?: string } | null }
      const listar = async (carpeta: string) => {
        const items: Item[] = []
        for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.storage.from('media').list(carpeta, { limit: 1000, offset })
          if (error) throw error
          items.push(...((data ?? []) as Item[]))
          if (!data || data.length < 1000) break
        }
        return items
      }
      const aArchivo = (carpeta: string, i: Item): ArchivoMedia => ({
        ruta: carpeta ? `${carpeta}/${i.name}` : i.name,
        carpeta,
        nombre: i.name,
        tamano: i.metadata?.size ?? 0,
        tipo: i.metadata?.mimetype ?? '',
        creado: i.created_at,
      })
      const raiz = await listar('')
      // id null = carpeta; con id = archivo suelto en la raíz
      const archivos = raiz.filter((i) => i.id).map((i) => aArchivo('', i))
      const carpetas = raiz.filter((i) => !i.id).map((i) => i.name)
      const contenidos = await Promise.all(carpetas.map(async (c) => (await listar(c)).map((i) => aArchivo(c, i))))
      return archivos.concat(...contenidos)
    },
  })
}
