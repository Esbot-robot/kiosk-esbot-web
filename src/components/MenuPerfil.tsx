import { useEffect, useRef, useState } from 'react'
import { IconoSalir } from './iconos'
import { supabase } from '../lib/supabase'

/** Dos primeras iniciales del nombre ("Ana María Pérez" → "AM") */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}

/**
 * Perfil de la barra superior: círculo con iniciales, nombre y una flecha.
 * Al tocarlo se abre un popup con nombre, correo y "Cerrar sesión".
 * En la barra oscura del teléfono (`oscuro`) solo se ven el círculo y la flecha.
 */
export function MenuPerfil({
  nombre,
  onCerrarSesion,
  oscuro = false,
}: {
  nombre: string
  onCerrarSesion: () => void
  oscuro?: boolean
}) {
  const [abierto, setAbierto] = useState(false)
  const [correo, setCorreo] = useState('')
  const caja = useRef<HTMLDivElement>(null)

  // El correo sale de la sesión guardada en el navegador (no consulta la red)
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setCorreo(data.session?.user.email ?? ''))
  }, [])

  // Se cierra al tocar fuera o con Esc
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', fuera)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', fuera)
      document.removeEventListener('keydown', esc)
    }
  }, [abierto])

  const circulo = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-400">
      {iniciales(nombre)}
    </span>
  )

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="menu"
        aria-label="Menú de perfil"
        className={`-mr-1.5 flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors ${
          oscuro ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
        }`}
      >
        {circulo}
        {!oscuro && <span className="text-sm font-medium text-slate-700">{nombre}</span>}
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 transition-transform ${abierto ? 'rotate-180' : ''} ${oscuro ? 'text-slate-300' : 'text-slate-500'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-max min-w-64 max-w-[calc(100vw-2rem)] border border-slate-200 bg-white shadow-xl"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            {circulo}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{nombre}</p>
              {/* el correo se ve completo: el popup se ensancha (y solo parte la línea si no cabe en pantalla) */}
              {correo && <p className="text-xs text-slate-500 [overflow-wrap:anywhere]">{correo}</p>}
            </div>
          </div>
          <div className="border-t border-slate-100 p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false)
                onCerrarSesion()
              }}
              className="flex w-full items-center gap-3 px-2.5 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <IconoSalir /> Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
