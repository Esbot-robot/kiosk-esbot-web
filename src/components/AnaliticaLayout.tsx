import { NavLink, Outlet } from 'react-router-dom'
import { IconoCarpeta, IconoGrafica, IconoRobotLinea } from './iconos'
import { IconoVideo } from './iconosPopup'
import { esAdmin, usePerfil } from '../lib/perfil'

const IconoAlmacenamiento = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="12" cy="6" rx="8" ry="3" />
    <path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6" />
    <path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
  </svg>
)

const itemClass = ({ isActive }: { isActive: boolean }) =>
  `flex shrink-0 items-center gap-3 whitespace-nowrap rounded-xl px-4 py-3 text-sm transition-colors ${
    isActive ? 'bg-slate-100 font-semibold text-[#1d293d]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
  }`

/** Marco de Analítica: submenú propio a la izquierda de la vista (arriba en teléfono) */
export function AnaliticaLayout() {
  const perfil = usePerfil()
  const admin = esAdmin(perfil)
  const superadmin = perfil.rol === 'superadmin'

  return (
    <div className="flex flex-col md:flex-row">
      <aside className="shrink-0 border-b border-slate-200 bg-white md:sticky md:top-14 md:min-h-[calc(100vh-3.5rem)] md:w-60 md:self-start md:border-b-0 md:border-r">
        <p className="hidden px-6 pb-3 pt-8 text-lg font-bold text-[#1d293d] md:block">Analítica</p>
        <nav className="flex gap-1 overflow-x-auto px-3 py-2 md:flex-col md:overflow-visible md:py-0">
          <NavLink to="/analitica/interacciones" className={itemClass}>
            <IconoGrafica className="h-5 w-5" /> Interacciones
          </NavLink>
          <NavLink to="/analitica/proyectos" className={itemClass}>
            <IconoCarpeta className="h-5 w-5" /> Proyectos
          </NavLink>
          {admin && (
            <NavLink to="/analitica/robots" className={itemClass}>
              <IconoRobotLinea className="h-5 w-5" /> Robots
            </NavLink>
          )}
          {superadmin && (
            <>
              <NavLink to="/analitica/videollamadas" className={itemClass}>
                <IconoVideo className="h-5 w-5" /> Videollamadas
              </NavLink>
              <NavLink to="/analitica/almacenamiento" className={itemClass}>
                <IconoAlmacenamiento /> Almacenamiento
              </NavLink>
            </>
          )}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  )
}
