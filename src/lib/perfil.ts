import { createContext, useContext } from 'react'

export type Rol = 'superadmin' | 'admin' | 'lector'

/** Perfil del usuario con sesión (tabla perfiles, ver supabase/roles.sql) */
export interface PerfilActual {
  user_id: string
  nombre: string
  rol: Rol
}

export const PerfilContext = createContext<PerfilActual | null>(null)

/** Solo dentro del panel (RequireAuth garantiza que el perfil ya cargó) */
export function usePerfil(): PerfilActual {
  const perfil = useContext(PerfilContext)
  if (!perfil) throw new Error('usePerfil fuera de RequireAuth')
  return perfil
}

/** Administrador o super administrador: todo el panel */
export function esAdmin(perfil: PerfilActual): boolean {
  return perfil.rol === 'admin' || perfil.rol === 'superadmin'
}

export function nombreRol(rol: Rol): string {
  return rol === 'superadmin' ? 'Super administrador' : rol === 'admin' ? 'Administrador' : 'Cliente lector'
}

/**
 * Editor en solo lectura (cliente lector): los diálogos se abren para ver la
 * configuración, pero sin poder escribir, subir archivos ni guardar.
 */
export const SoloLecturaContext = createContext(false)

export function useSoloLectura(): boolean {
  return useContext(SoloLecturaContext)
}
