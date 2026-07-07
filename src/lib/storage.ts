import { supabase } from './supabase'
import type { EventConfig } from '../types/config'

/** Sube un archivo a un bucket público y devuelve su URL pública */
export async function subirArchivo(
  bucket: 'media' | 'configs',
  path: string,
  archivo: File | Blob,
  contentType?: string
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, archivo, { upsert: true, contentType })
  if (error) throw error
  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Nombre seguro para archivos subidos por el panel */
export function rutaMedia(projectId: string, nombreArchivo: string): string {
  const limpio = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${projectId}/${Date.now()}_${limpio}`
}

/**
 * Publica el JSON que el robot descargará con un GET simple:
 * https://.../storage/v1/object/public/configs/{serial}.json
 */
export async function publicarConfigRobot(serial: string, config: EventConfig): Promise<string> {
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
  return subirArchivo('configs', `${serial}.json`, blob, 'application/json')
}
