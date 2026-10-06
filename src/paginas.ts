import { lazy } from 'react'

/**
 * Las páginas del panel se cargan solo cuando alguien entra a ellas.
 * Quien abre /galeria desde el celular en un evento no descarga el editor
 * ni el generador de PDF de Analítica, que son lo más pesado del proyecto.
 * lazy() va aquí afuera: si estuviera dentro del componente, React crearía
 * un componente nuevo en cada dibujado y volvería a montar la página.
 */
export const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })))
export const Editor = lazy(() => import('./pages/Editor').then((m) => ({ default: m.Editor })))
export const Analitica = lazy(() => import('./pages/Analitica').then((m) => ({ default: m.Analitica })))
export const Contactos = lazy(() => import('./pages/Contactos').then((m) => ({ default: m.Contactos })))
export const Usuarios = lazy(() => import('./pages/Usuarios').then((m) => ({ default: m.Usuarios })))
export const Robots = lazy(() => import('./pages/Robots').then((m) => ({ default: m.Robots })))
