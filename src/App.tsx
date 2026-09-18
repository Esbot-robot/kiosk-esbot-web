import { lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Galeria } from './pages/Galeria'

/**
 * Las páginas del panel se cargan solo cuando alguien entra a ellas.
 * Quien abre /galeria desde el celular en un evento no descarga el editor
 * ni el generador de PDF de Analítica, que son lo más pesado del proyecto.
 * lazy() va aquí afuera: si estuviera dentro del componente, React crearía
 * un componente nuevo en cada dibujado y volvería a montar la página.
 */
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })))
const Editor = lazy(() => import('./pages/Editor').then((m) => ({ default: m.Editor })))
const Analitica = lazy(() => import('./pages/Analitica').then((m) => ({ default: m.Analitica })))
const Robots = lazy(() => import('./pages/Robots').then((m) => ({ default: m.Robots })))

export default function App() {
  return (
    <Routes>
      {/* Públicas: sin sesión */}
      <Route path="/login" element={<Login />} />
      <Route path="/galeria" element={<Galeria />} />

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
        <Route path="/robots" element={<Robots />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<Navigate to="/proyectos" replace />} />
      </Route>
    </Routes>
  )
}
