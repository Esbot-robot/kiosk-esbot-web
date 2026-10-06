import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'
import { esAdmin, PerfilContext, usePerfil, type PerfilActual } from '../lib/perfil'
import { Cargando } from './Cargando'

/**
 * Exige sesión y carga el perfil del usuario (rol y nombre). Todo lo que va
 * adentro puede usar usePerfil() sabiendo que el perfil ya está.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  // undefined = todavía consultando; null = sin sesión
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const { data: perfil, isLoading, error, refetch } = useQuery({
    queryKey: ['mi-perfil', userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PerfilActual | null> => {
      const { data, error } = await supabase
        .from('perfiles')
        .select('user_id, nombre, rol')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data as PerfilActual | null
    },
  })

  if (session === undefined || (userId && isLoading)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Cargando className="" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />

  if (error || !perfil) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="max-w-md text-slate-700">
          {error
            ? `No se pudo cargar tu perfil. ${describirError(error)}`
            : 'Tu usuario no tiene un perfil asignado. Pide a un administrador que lo revise.'}
        </p>
        <div className="flex gap-3">
          {error && (
            <button
              onClick={() => void refetch()}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Reintentar
            </button>
          )}
          <button
            onClick={() => navigate('/login', { state: { cerrarSesion: true } })}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    )
  }

  return <PerfilContext.Provider value={perfil}>{children}</PerfilContext.Provider>
}

/** Páginas solo para administradores: el cliente lector vuelve a Proyectos */
export function SoloAdmin({ children }: { children: React.ReactNode }) {
  const perfil = usePerfil()
  if (!esAdmin(perfil)) return <Navigate to="/proyectos" replace />
  return <>{children}</>
}
