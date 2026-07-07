import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconoCarpeta, IconoSalir } from './iconos'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-6 py-4 text-base transition-colors ${
    isActive
      ? 'bg-slate-600/40 text-white border-l-4 border-indigo-500'
      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white border-l-4 border-transparent'
  }`

export function Layout() {
  const navigate = useNavigate()

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar — estilo mockup Kiosk Esbot */}
      <aside className="flex w-72 flex-col bg-slate-800">
        <div className="px-6 py-8">
          <h1 className="text-2xl font-bold text-white">Kiosk Esbot</h1>
          <p className="mt-1 text-sm text-slate-400">Admin</p>
        </div>

        <nav className="mt-4 flex-1">
          <NavLink to="/proyectos" className={navItemClass}>
            <IconoCarpeta /> Proyectos
          </NavLink>
        </nav>

        <div className="border-t border-slate-600 px-6 py-6">
          <button
            onClick={cerrarSesion}
            className="flex items-center gap-3 text-slate-300 transition-colors hover:text-white"
          >
            <IconoSalir /> Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
