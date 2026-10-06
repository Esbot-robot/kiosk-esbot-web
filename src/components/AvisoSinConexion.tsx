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
 * Aviso fijo arriba (tarjeta flotante) cuando no hay conexión. Responde de una vez la duda de
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

  const { titulo, detalle } =
    estado === 'ok'
      ? { titulo: 'Conexión restablecida', detalle: 'Ya puedes seguir trabajando con normalidad.' }
      : estado === 'sin-red'
        ? { titulo: 'Sin conexión a internet', detalle: 'Los cambios no se guardarán hasta que vuelva la red.' }
        : {
            titulo: 'Sin conexión con el servidor',
            detalle: 'Los cambios no se guardarán.',
          }

  // Tarjeta flotante arriba al centro (no una franja de lado a lado)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex justify-center px-4">
      <div
        role="status"
        className={`pointer-events-auto flex w-full max-w-md items-center gap-4 rounded-lg px-5 py-4 text-white shadow-lg ${
          estado === 'ok' ? 'bg-emerald-600' : 'bg-[#F4511E]'
        }`}
      >
        {/* Nube con ✕ (sin conexión) o con ✓ (conexión restablecida) */}
        <svg viewBox="0 0 48 48" className="h-10 w-10 shrink-0" aria-hidden="true">
          <path
            d="M14 38h22a9 9 0 0 0 1.6-17.86A12 12 0 0 0 14.3 17.1 10.5 10.5 0 0 0 14 38z"
            fill="white"
          />
          {estado === 'ok' ? (
            <path d="M19 28.5l4 4 7.5-8" fill="none" stroke="#059669" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M20 23l9 9M29 23l-9 9" fill="none" stroke="#F4511E" strokeWidth="3.2" strokeLinecap="round" />
          )}
        </svg>
        <div className="min-w-0 text-sm leading-snug">
          <p className="font-semibold">{titulo}</p>
          <p className="text-white/90">{detalle}</p>
        </div>
      </div>
    </div>
  )
}
