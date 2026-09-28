import { useEffect, useRef, useState } from 'react'
import { anonKey, url } from '../lib/supabase'

type Estado = 'ok' | 'sin-red' | 'sin-servidor'

/** cada cuánto se comprueba que el servidor responde */
const INTERVALO_MS = 15_000
const LIMITE_MS = 8_000

/** true si Supabase responde; falla con wifi conectado pero sin internet */
async function servidorResponde(): Promise<boolean> {
  try {
    const respuesta = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anonKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(LIMITE_MS),
    })
    return respuesta.ok
  } catch {
    return false
  }
}

/**
 * Franja fija arriba cuando no hay conexión. Responde de una vez la duda de
 * "¿falló el panel o es el internet?": si la franja está, es la red.
 *
 * navigator.onLine solo sabe si el equipo está conectado a una red, no si esa
 * red llega a internet (wifi de eventos, hoteles). Por eso además se consulta
 * al servidor cada 15 s. Al volver la conexión avisa unos segundos y se va.
 */
export function AvisoSinConexion() {
  const [estado, setEstado] = useState<Estado>(() => (navigator.onLine ? 'ok' : 'sin-red'))
  const [recuperada, setRecuperada] = useState(false)
  const actual = useRef(estado)

  useEffect(() => {
    let vigente = true
    let temporizador: ReturnType<typeof setTimeout> | undefined

    const cambiar = (nuevo: Estado) => {
      const anterior = actual.current
      if (anterior === nuevo) return
      actual.current = nuevo
      clearTimeout(temporizador)
      setRecuperada(nuevo === 'ok')
      if (nuevo === 'ok') temporizador = setTimeout(() => setRecuperada(false), 3000)
      setEstado(nuevo)
    }
    const comprobar = async () => {
      if (!navigator.onLine) return cambiar('sin-red')
      const ok = await servidorResponde()
      if (vigente) cambiar(ok ? 'ok' : 'sin-servidor')
    }
    const alPerder = () => cambiar('sin-red')
    const alVolver = () => void comprobar()

    void comprobar()
    const intervalo = setInterval(() => void comprobar(), INTERVALO_MS)
    window.addEventListener('offline', alPerder)
    window.addEventListener('online', alVolver)
    return () => {
      vigente = false
      clearInterval(intervalo)
      clearTimeout(temporizador)
      window.removeEventListener('offline', alPerder)
      window.removeEventListener('online', alVolver)
    }
  }, [])

  if (estado === 'ok' && !recuperada) return null

  const mensaje =
    estado === 'ok'
      ? 'Conexión restablecida'
      : estado === 'sin-red'
        ? 'Sin conexión a internet. Los cambios no se guardarán hasta que vuelva la red.'
        : 'Sin conexión con el servidor: la red está conectada pero no llega a internet. Los cambios no se guardarán.'

  return (
    <div
      role="status"
      className={`fixed inset-x-0 top-0 z-[60] px-4 py-2 text-center text-sm font-semibold text-white shadow-md ${
        estado === 'ok' ? 'bg-emerald-600' : 'bg-rose-600'
      }`}
    >
      {mensaje}
    </div>
  )
}
