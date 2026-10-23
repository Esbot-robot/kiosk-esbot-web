import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { archivosDeConfig, comprobarArchivos, type ResultadoArchivo } from './archivosProyecto'
import type { EventConfig } from '../types/config'

/**
 * Archivos que la configuración referencia y que ya no están en el almacenamiento (por ejemplo,
 * porque alguien los borró a mano en Supabase). La comprobación se repite solo si cambian las
 * direcciones o pasaron 5 minutos, nunca con cada cambio de la pantalla.
 */
export function useArchivosFaltantes(config: EventConfig | null | undefined): {
  faltantes: ResultadoArchivo[]
  comprobando: boolean
} {
  const archivos = useMemo(() => (config ? archivosDeConfig(config) : []), [config])
  const clave = useMemo(() => archivos.map((a) => a.url).sort().join('|'), [archivos])
  const consulta = useQuery({
    queryKey: ['archivos-proyecto', clave],
    enabled: archivos.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => comprobarArchivos(archivos),
  })
  // El resultado trae cada archivo con su nombre; se filtra con la lista actual por si se renombró alguno
  const faltantes = useMemo(() => (consulta.data ?? []).filter((a) => a.estado === 'falta'), [consulta.data])
  return { faltantes, comprobando: consulta.isLoading && archivos.length > 0 }
}
