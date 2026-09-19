import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { IconoCarpeta, IconoCerrar, IconoGrafica, IconoMenu, IconoRobotLinea, IconoSalir } from './iconos'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-6 py-4 text-base transition-colors ${
    isActive
      ? 'bg-slate-600/40 text-white border-l-4 border-indigo-500'
      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white border-l-4 border-transparent'
  }`

/**
 * Estructura del panel: menú lateral + contenido.
 *
 * - Computador y tablet (md, 768 px o más): el menú es una columna fija a la
 *   izquierda, igual que siempre.
 * - Teléfono (menos de 768 px): arriba queda una barra con el nombre y el
 *   botón ☰. El menú sale deslizándose desde la izquierda por encima del
 *   contenido, con un fondo oscuro detrás, y se cierra al elegir una opción,
 *   al tocar el fondo o con la tecla Esc.
 *
 * Es el mismo <aside> en los dos casos: en teléfono es `fixed` y se esconde
 * con translate-x; desde md vuelve a ser `static` y siempre visible. Así hay
 * un solo menú que mantener, no dos.
 */
export function Layout() {
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const cerrarMenu = () => setMenuAbierto(false)

  // Esc cierra el menú (solo se escucha mientras está abierto)
  useEffect(() => {
    if (!menuAbierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menuAbierto])

  async function cerrarSesion() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50 md:flex-row">
      {/* Barra superior: solo en teléfono. El ☰ va a la izquierda porque el
          menú sale por la izquierda: el botón queda donde aparece el menú. */}
      <header className="flex shrink-0 items-center gap-3 bg-slate-800 px-4 py-3 md:hidden">
        <button
          type="button"
          onClick={() => setMenuAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={menuAbierto}
          className="-ml-2 rounded-lg p-2 text-slate-200 transition-colors hover:bg-slate-700"
        >
          <IconoMenu />
        </button>
        <div>
          <p className="text-lg font-bold leading-tight text-white">Kiosk Esbot</p>
          <p className="text-xs text-slate-400">Admin</p>
        </div>
      </header>

      {/* Fondo oscuro detrás del menú abierto: tocarlo lo cierra */}
      {menuAbierto && (
        <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={cerrarMenu} aria-hidden="true" />
      )}

      {/* Sidebar — estilo mockup Kiosk Esbot */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-slate-800 transition-transform duration-200 md:static md:max-w-none md:translate-x-0 ${
          menuAbierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between px-6 py-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Kiosk Esbot</h1>
            <p className="mt-1 text-sm text-slate-400">Admin</p>
          </div>
          <button
            type="button"
            onClick={cerrarMenu}
            aria-label="Cerrar menú"
            className="rounded-lg p-1 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white md:hidden"
          >
            <IconoCerrar />
          </button>
        </div>

        {/* Elegir una opción cierra el menú en teléfono (en computador no hace nada) */}
        <nav className="mt-4 flex-1">
          <NavLink to="/proyectos" className={navItemClass} onClick={cerrarMenu}>
            <IconoCarpeta /> Proyectos
          </NavLink>
          <NavLink to="/analitica" className={navItemClass} onClick={cerrarMenu}>
            <IconoGrafica /> Analítica
          </NavLink>
          <NavLink to="/robots" className={navItemClass} onClick={cerrarMenu}>
            <IconoRobotLinea /> Robots
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

      {/* Contenido. El Suspense va aquí, alrededor del Outlet, y no en App:
          así la barra lateral no desaparece mientras se descarga la página. */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Suspense fallback={<p className="p-6 text-slate-500 md:p-12">Cargando...</p>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  )
}
