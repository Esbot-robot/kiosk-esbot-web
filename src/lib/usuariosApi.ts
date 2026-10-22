import { supabase } from './supabase'
import { describirError } from './errores'

/**
 * Llama a la Edge Function "usuarios" (crear, editar, eliminar, entrar como).
 * Si responde con error, el mensaje es el que la función explica.
 */
export async function llamarUsuarios<T = { ok: true }>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('usuarios', { body: cuerpo })
  if (error) {
    let mensaje = describirError(error)
    try {
      const respuesta = (error as { context?: Response }).context
      const json = respuesta ? await respuesta.json() : null
      if (json?.error) mensaje = json.error
    } catch {
      // sin cuerpo legible: queda el mensaje general
    }
    throw new Error(mensaje)
  }
  return data as T
}
