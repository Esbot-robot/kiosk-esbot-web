import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import { router } from './App.tsx'

/**
 * networkMode 'always': por defecto React Query PAUSA las consultas y los
 * guardados cuando el navegador está sin red, y la pantalla se queda en
 * "Cargando..." o "Guardando..." para siempre, sin decir por qué. Así la
 * petición falla enseguida y se muestra el mensaje de "Sin conexión".
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { networkMode: 'always', retry: 1 },
    mutations: { networkMode: 'always' },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
