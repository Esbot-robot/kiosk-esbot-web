import { createBrowserRouter, createRoutesFromElements, Navigate, Outlet, Route } from 'react-router-dom'
import { RequireAuth, SoloAdmin } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Galeria } from './pages/Galeria'
import { Registro } from './pages/Registro'
import { Analitica, Contactos, Editor, Projects, Robots, Usuarios } from './paginas'

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
        <Route path="/analitica" element={<Analitica />} />
        <Route path="/contactos" element={<Contactos />} />
        <Route path="/robots" element={<SoloAdmin><Robots /></SoloAdmin>} />
        <Route path="/usuarios" element={<SoloAdmin><Usuarios /></SoloAdmin>} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<Navigate to="/proyectos" replace />} />
      </Route>
    </Route>
  )
)
