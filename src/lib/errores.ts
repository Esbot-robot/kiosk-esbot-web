/**
 * Traduce cualquier error del panel (red, Supabase, subida) a un mensaje que
 * diga la causa. Lo importante es separar "no hay internet" de un error real:
 * sin eso, cada fallo en un evento termina en la duda de si fue la red.
 */
export function describirError(e: unknown): string {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sin conexión a internet. Verifique la red e intente nuevamente.'
  }

  const err = (e ?? {}) as { message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown; name?: unknown }
  const mensaje = typeof err.message === 'string' ? err.message : typeof e === 'string' ? e : ''
  const estado = Number(err.status ?? err.statusCode) || 0
  const codigo = typeof err.code === 'string' ? err.code : ''
  const texto = mensaje.toLowerCase()

  // corte por LIMITE_PETICION_MS (lib/supabase.ts)
  if (err.name === 'TimeoutError' || texto.includes('timed out') || texto.includes('timeout')) {
    return 'El servidor tardó demasiado en responder. Verifique la conexión a internet e intente nuevamente.'
  }
  // fetch caído: el navegador dice "online" pero la petición no llegó al servidor
  if (
    err.name === 'AuthRetryableFetchError' ||
    texto.includes('failed to fetch') ||
    texto.includes('networkerror') ||
    texto.includes('load failed') ||
    texto.includes('network request failed')
  ) {
    return 'No fue posible conectar con el servidor. Verifique la conexión a internet e intente nuevamente.'
  }
  if (estado === 401 || codigo === 'PGRST301' || texto.includes('jwt')) {
    return 'La sesión expiró. Cierre sesión e ingrese nuevamente.'
  }
  if (estado === 403 || texto.includes('row-level security') || texto.includes('row level security')) {
    return 'No tiene permiso para realizar esta acción. Cierre sesión e ingrese nuevamente.'
  }
  if (estado === 413 || texto.includes('maximum allowed size') || texto.includes('too large')) {
    return 'El archivo supera el tamaño máximo permitido por el servidor.'
  }
  if (estado >= 500) {
    return 'El servidor no responde en este momento. Intente nuevamente en unos minutos.'
  }
  return mensaje || 'Ocurrió un error inesperado. Intente nuevamente.'
}
