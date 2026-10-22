import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route } from 'react-router-dom'
import { PaginaPorDefecto, RequireAuth, SoloAdmin, SoloSuperadmin } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { AnaliticaLayout } from './components/AnaliticaLayout'
import { Galeria } from './pages/Galeria'
import { Registro } from './pages/Registro'
import { Analitica, AnaliticaAlmacenamiento, AnaliticaProyectos, AnaliticaRobots, AnaliticaVideollamadas, Contactos, Editor, Projects, Robots, Usuarios } from './paginas'

/**
 * Router "de datos" (createBrowserRouter) y no <BrowserRouter>: es el único
 * que permite useBlocker, con el que el editor frena la salida a Analítica o
 * Robots cuando hay cambios sin guardar.
 */
export const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<Outlet />}>
      {/* Públicas: sin sesión */}
      <Route path="/login" element={<Login />} />
      <Route path="/galeria" element={<Galeria />} />
      <Route path="/registro" element={<Registro />} />

      {/* Panel: todo lo de adentro exige sesión */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/proyectos" element={<Projects />} />
        <Route path="/analitica" element={<AnaliticaLayout />}>
          <Route index element={<Navigate to="/analitica/interacciones" replace />} />
          <Route path="/analitica/interacciones" element={<Analitica />} />
          <Route path="/analitica/proyectos" element={<AnaliticaProyectos />} />
          <Route path="/analitica/robots" element={<SoloAdmin><AnaliticaRobots /></SoloAdmin>} />
          <Route path="/analitica/videollamadas" element={<SoloSuperadmin><AnaliticaVideollamadas /></SoloSuperadmin>} />
          <Route path="/analitica/almacenamiento" element={<SoloSuperadmin><AnaliticaAlmacenamiento /></SoloSuperadmin>} />
        </Route>
        <Route path="/contactos" element={<Contactos />} />
        <Route path="/robots" element={<SoloAdmin><Robots /></SoloAdmin>} />
        <Route path="/usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<PaginaPorDefecto />} />
      </Route>
    </Route>
  )
)
