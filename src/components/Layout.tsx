import { Suspense, useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { IconoCarpeta, IconoCerrar, IconoContactos, IconoGrafica, IconoMenu, IconoRobotLinea, IconoSalir, IconoUsuarios } from './iconos'
import { esAdmin, nombreRol, usePerfil } from '../lib/perfil'
import { Notificaciones } from './Notificaciones'
import { sesionPrestada, supabase } from '../lib/supabase'
import { Cargando } from './Cargando'
import { configVacia } from '../types/config'
import { describirError } from '../lib/errores'
import { avisoError } from '../lib/alertas'

const navItemClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-6 py-3 text-base transition-colors ${
    isActive
      ? 'bg-slate-600/40 text-white border-l-4 border-indigo-500'
      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white border-l-4 border-transparent'
  }`

/** Proyectos recientes: un poco más compactos que las opciones del menú */
const recienteClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
    isActive
      ? 'bg-slate-600/40 text-white border-l-4 border-indigo-500'
      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white border-l-4 border-transparent'
  }`

/** Título de cada sección del menú (MENÚ, OTROS, PROYECTOS RECIENTES) */
function TituloSeccion({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-6 pb-1 pt-5">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-slate-500">{children}</p>
      {accion}
    </div>
  )
}

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
  const perfil = usePerfil()
  const admin = esAdmin(perfil)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const cerrarMenu = () => setMenuAbierto(false)
  const queryClient = useQueryClient()

  // Los 3 últimos editados (el lector solo ve los suyos: lo filtra la base).
  // La clave empieza por 'projects': al guardar, crear o borrar un proyecto
  // ya se refresca esa clave, y la lista se actualiza sola.
  const { data: recientes } = useQuery({
    queryKey: ['projects', 'recientes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, nombre')
        .order('updated_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data as { id: string; nombre: string }[]
    },
  })

  const crearProyecto = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .insert({ nombre: 'Nuevo proyecto', config: configVacia() })
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: ({ id }) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
      cerrarMenu()
      navigate(`/editor/${id}`)
    },
    onError: (e) => void avisoError('No se pudo crear el proyecto', describirError(e)),
  })

  // "En línea": cada 10 s el panel avisa que sigue abierto (página Usuarios).
  // La pestaña de "Entrar como" no avisa: sería el superadmin, no el cliente.
  useEffect(() => {
    if (sesionPrestada) return
    const avisar = () => {
      // .then(): las consultas de supabase-js solo se envían al esperar su respuesta
      if (document.visibilityState === 'visible') void supabase.rpc('marcar_visto').then(() => undefined)
    }
    avisar()
    const id = setInterval(avisar, 10_000)
    document.addEventListener('visibilitychange', avisar)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', avisar)
    }
  }, [])

  // Esc cierra el menú (solo se escucha mientras está abierto)
  useEffect(() => {
    if (!menuAbierto) return
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [menuAbierto])

  /**
   * Primero se navega y la sesión la cierra el login al abrirse. Al revés, con
   * cambios sin guardar en el editor, el aviso saldría con la sesión ya cerrada
   * y "Cancelar" dejaría el editor abierto sin poder guardar.
   */
  function cerrarSesion() {
    navigate('/login', { state: { cerrarSesion: true } })
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
        <div className="flex-1">
          <p className="text-lg font-bold leading-tight text-white">Kiosk Esbot</p>
          <p className="text-xs text-slate-400">{nombreRol(perfil.rol)}</p>
        </div>
        {perfil.rol === 'superadmin' && <Notificaciones oscuro />}
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
        {/* min-h-0 + overflow: en pantallas bajas el menú se desplaza y "Cerrar Sesión" no se sale */}
        <nav className="min-h-0 flex-1 overflow-y-auto">
          <TituloSeccion>Menú</TituloSeccion>
          <NavLink to="/proyectos" className={navItemClass} onClick={cerrarMenu}>
            <IconoCarpeta /> Proyectos
          </NavLink>
          <NavLink to="/analitica" className={navItemClass} onClick={cerrarMenu}>
            <IconoGrafica /> Analítica
          </NavLink>
          <NavLink to="/contactos" className={navItemClass} onClick={cerrarMenu}>
            <IconoContactos /> Contactos
          </NavLink>
          {admin && (
            <NavLink to="/robots" className={navItemClass} onClick={cerrarMenu}>
              <IconoRobotLinea /> Robots
            </NavLink>
          )}

          {admin && (
            <>
              <TituloSeccion>Otros</TituloSeccion>
              <NavLink to="/usuarios" className={navItemClass} onClick={cerrarMenu}>
                <IconoUsuarios /> Usuarios
              </NavLink>
            </>
          )}

          {(recientes ?? []).length > 0 || admin ? (
            <>
              <TituloSeccion
                accion={
                  admin && (
                    <button
                      type="button"
                      onClick={() => crearProyecto.mutate()}
                      disabled={crearProyecto.isPending}
                      aria-label="Nuevo proyecto"
                      title="Nuevo proyecto"
                      className="flex h-6 w-6 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                  )
                }
              >
                Proyectos recientes
              </TituloSeccion>
              {(recientes ?? []).map((p) => (
                <NavLink key={p.id} to={`/editor/${p.id}`} className={recienteClass} onClick={cerrarMenu}>
                  <IconoCarpeta className="h-4 w-4 shrink-0" />
                  <span className="truncate">{p.nombre}</span>
                </NavLink>
              ))}
            </>
          ) : null}
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
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Barra superior en computador: campana (solo superadmin) y quién tiene
            la sesión. Es una barra propia y no algo que flota: así no tapa las
            pestañas del editor ni los filtros de Analítica. En teléfono la
            campana va en la barra oscura de arriba. */}
        <header className="relative z-30 hidden shrink-0 items-center justify-end gap-3 border-b border-slate-200 bg-white px-12 py-2.5 md:flex">
          {perfil.rol === 'superadmin' && <Notificaciones />}
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-xs font-medium text-indigo-400">
              {perfil.nombre
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((p) => p[0]!.toUpperCase())
                .join('')}
            </span>
            <span className="text-sm font-medium text-slate-700">{perfil.nombre}</span>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={<Cargando className="py-24" />}>
            <Outlet />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
