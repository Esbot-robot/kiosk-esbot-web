import { Routes, Route, Navigate } from 'react-router-dom'
import { RequireAuth } from './components/RequireAuth'
import { Layout } from './components/Layout'
import { Login } from './pages/Login'
import { Projects } from './pages/Projects'
import { Editor } from './pages/Editor'
import { Analitica } from './pages/Analitica'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/proyectos" element={<Projects />} />
        <Route path="/analitica" element={<Analitica />} />
        <Route path="/editor/:projectId" element={<Editor />} />
        <Route path="*" element={<Navigate to="/proyectos" replace />} />
      </Route>
    </Routes>
  )
}
