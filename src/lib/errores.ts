/**
 * Traduce cualquier error del panel (red, Supabase, subida) a un mensaje que
 * diga la causa. Lo importante es separar "no hay internet" de un error real:
 * sin eso, cada fallo en un evento termina en la duda de si fue la red.
 */
export function describirError(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sin conexión a internet. Revisa la red e intenta de nuevo.'
  }

  const err = (e ?? {}) as { message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown; name?: unknown }
  const mensaje = typeof err.message === 'string' ? err.message : typeof e === 'string' ? e : ''
  const estado = Number(err.status ?? err.statusCode) || 0
  const codigo = typeof err.code === 'string' ? err.code : ''
  const texto = mensaje.toLowerCase()

  // corte por LIMITE_PETICION_MS (lib/supabase.ts)
  if (err.name === 'TimeoutError' || texto.includes('timed out') || texto.includes('timeout')) {
    return 'El servidor tardó demasiado en responder. Revisa el internet e intenta de nuevo.'
  }
  // fetch caído: el navegador dice "online" pero la petición no llegó al servidor
  if (
    err.name === 'AuthRetryableFetchError' ||
    texto.includes('failed to fetch') ||
    texto.includes('networkerror') ||
    texto.includes('load failed') ||
    texto.includes('network request failed')
  ) {
    return 'No se pudo conectar con el servidor. Revisa el internet e intenta de nuevo.'
  }
  if (estado === 401 || codigo === 'PGRST301' || texto.includes('jwt')) {
    return 'Tu sesión expiró. Cierra sesión y vuelve a entrar.'
  }
  if (estado === 403 || texto.includes('row-level security') || texto.includes('row level security')) {
    return 'No tienes permiso para esta acción. Cierra sesión y vuelve a entrar.'
  }
  if (estado === 413 || texto.includes('maximum allowed size') || texto.includes('too large')) {
    return 'El archivo es más grande de lo que permite el servidor.'
  }
  if (estado >= 500) {
    return 'El servidor no responde en este momento. Intenta de nuevo en unos minutos.'
  }
  return mensaje || 'Ocurrió un error inesperado. Intenta de nuevo.'
}
