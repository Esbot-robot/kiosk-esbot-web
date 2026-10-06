import { anonKey, supabase, url as supabaseUrl } from './supabase'
import type { EventConfig } from '../types/config'

export interface ProgresoSubida {
  enviados: number
  total: number
  /** bytes por segundo, medido desde el inicio de la subida */
  velocidad: number
}

interface OpcionesSubida {
  contentType?: string
  onProgreso?: (progreso: ProgresoSubida) => void
  /** permite cancelar la subida (botón Cancelar del diálogo) */
  signal?: AbortSignal
}

/**
 * Si pasa este tiempo sin que avance un solo byte, la subida se da por caída.
 * No es un límite al total: un video grande con internet lento puede tardar
 * varios minutos y está bien, mientras siga avanzando.
 */
const SIN_AVANCE_MS = 45_000

/**
 * Sube un archivo a un bucket público y devuelve su URL pública.
 *
 * Usa XMLHttpRequest contra la API de Storage en vez de supabase-js porque
 * fetch no informa el avance de la subida, y sin porcentaje no se distingue
 * un video pesado con internet lento de una subida colgada.
 */
export async function subirArchivo(
  bucket: 'media' | 'configs',
  path: string,
  archivo: File | Blob,
  { contentType, onProgreso, signal }: OpcionesSubida = {}
): Promise<string> {
  const { data: sesion } = await supabase.auth.getSession()
  const token = sesion.session?.access_token ?? anonKey

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const inicio = Date.now()
    let vigilante: ReturnType<typeof setTimeout> | undefined

    const terminar = (error?: unknown) => {
      clearTimeout(vigilante)
      signal?.removeEventListener('abort', cancelar)
      if (error) reject(error)
      else resolve()
    }
    const vigilar = () => {
      clearTimeout(vigilante)
      vigilante = setTimeout(() => {
        xhr.abort()
        terminar(new Error('La subida se detuvo: el internet está muy lento o se cayó. Intenta de nuevo.'))
      }, SIN_AVANCE_MS)
    }
    const cancelar = () => {
      xhr.abort()
      terminar(new DOMException('Subida cancelada', 'AbortError'))
    }

    if (signal?.aborted) return cancelar()
    signal?.addEventListener('abort', cancelar)

    xhr.open('POST', `${supabaseUrl}/storage/v1/object/${bucket}/${path}`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('cache-control', 'max-age=3600')
    xhr.setRequestHeader('Content-Type', contentType || archivo.type || 'application/octet-stream')

    xhr.upload.onprogress = (e) => {
      vigilar()
      if (!e.lengthComputable) return
      const segundos = Math.max((Date.now() - inicio) / 1000, 0.001)
      onProgreso?.({ enviados: e.loaded, total: e.total, velocidad: e.loaded / segundos })
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return terminar()
      // Storage responde {statusCode, error, message}; describirError lo traduce
      let detalle: { message?: string } = {}
      try {
        detalle = JSON.parse(xhr.responseText)
      } catch {
        // respuesta sin JSON (ej. un proxy): basta con el código
      }
      terminar({ status: xhr.status, message: detalle.message || `Error ${xhr.status} al subir el archivo` })
    }
    xhr.onerror = () => terminar(new Error('Failed to fetch'))

    vigilar()
    xhr.send(archivo)
  })

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return data.publicUrl
}

/** Nombre seguro para archivos subidos por el panel */
export function rutaMedia(projectId: string, nombreArchivo: string): string {
  const limpio = nombreArchivo.replace(/[^a-zA-Z0-9._-]/g, '_')
  return `${projectId}/${Date.now()}_${limpio}`
}

/**
 * Nombre del archivo a partir de su URL pública: quita la carpeta del proyecto
 * y el número que rutaMedia pone al inicio. Los espacios y tildes del nombre
 * original quedan como "_", porque así se guardó.
 */
export function nombreDesdeUrl(urlPublica: string): string {
  const ultimo = decodeURIComponent(urlPublica.split('?')[0].split('/').pop() ?? '')
  return ultimo.replace(/^\d+_/, '')
}

/** "37.3MB": el mismo formato que muestra el diálogo al elegir el archivo */
export function formatoMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/** Peso en bytes de un archivo ya subido, o null si no se pudo consultar */
export async function pesoDesdeUrl(urlPublica: string): Promise<number | null> {
  try {
    const respuesta = await fetch(urlPublica, { method: 'HEAD' })
    const largo = Number(respuesta.headers.get('content-length'))
    return respuesta.ok && largo > 0 ? largo : null
  } catch {
    return null
  }
}

/**
 * Dirección pública del panel, donde vive el formulario de registro. Fija y no
 * window.location.origin: si se guarda desde localhost, los QR del robot
 * apuntarían al computador de quien guardó.
 */
export const URL_PUBLICA = (import.meta.env.VITE_URL_PUBLICA as string | undefined) || 'https://kiosk-esbot-web.pages.dev'

/**
 * Publica el JSON que el robot descargará con un GET simple:
 * https://.../storage/v1/object/public/configs/{serial}.json
 *
 * Además de la config va lo que el robot necesita para armar el QR del
 * formulario: el token del proyecto (columna aparte en projects) y la
 * dirección del formulario.
 */
export async function publicarConfigRobot(
  serial: string,
  config: EventConfig,
  registroToken?: string | null,
  /** el robot lo envía con cada evento de analítica (lo que ve cada cliente) */
  projectId?: string
): Promise<string> {
  const publicada = {
    ...config,
    project_id: projectId ?? '',
    registro_token: registroToken ?? '',
    formulario_url: `${URL_PUBLICA}/registro`,
  }
  const blob = new Blob([JSON.stringify(publicada, null, 2)], { type: 'application/json' })
  return subirArchivo('configs', `${serial}.json`, blob, { contentType: 'application/json' })
}

/** Borra el JSON de un robot al desfijarlo (para que no siga descargando config vieja) */
export async function eliminarConfigRobot(serial: string): Promise<void> {
  await supabase.storage.from('configs').remove([`${serial}.json`])
}
