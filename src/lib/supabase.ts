import { createClient } from '@supabase/supabase-js'

/** exportadas para la subida con progreso, que llama a Storage sin supabase-js */
export const url = import.meta.env.VITE_SUPABASE_URL as string
export const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anonKey) {
  throw new Error(
    'Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copia .env.example a .env y completa los valores.'
  )
}

/**
 * Con wifi conectado pero sin salida a internet, una petición puede quedarse
 * esperando más de un minuto y la pantalla en "Cargando...". Pasado este
 * tiempo se corta y se muestra el error. Las subidas de archivos no pasan por
 * aquí (van por XHR con su propio control de avance).
 */
const LIMITE_PETICION_MS = 20_000

const fetchConLimite: typeof fetch = (entrada, opciones = {}) => {
  const limite = AbortSignal.timeout(LIMITE_PETICION_MS)
  const signal = opciones.signal ? AbortSignal.any([opciones.signal, limite]) : limite
  return fetch(entrada, { ...opciones, signal })
}

export const supabase = createClient(url, anonKey, { global: { fetch: fetchConLimite } })
