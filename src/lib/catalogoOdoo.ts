import { supabase } from './supabase'
import { describirError } from './errores'
import type { ProductoCatalogo } from '../types/config'

/**
 * Catálogo conectado a Odoo: llamadas a la Edge Function "catalogo-odoo".
 * La clave API se envía solo al conectar; después la función la lee del Vault
 * y el panel nunca la vuelve a ver.
 */

export type OrdenOdoo = 'nombre' | 'precio_asc' | 'precio_desc' | 'recientes'

export const ORDENES_ODOO: { id: OrdenOdoo; nombre: string }[] = [
  { id: 'nombre', nombre: 'Nombre (A–Z)' },
  { id: 'precio_asc', nombre: 'Precio: menor a mayor' },
  { id: 'precio_desc', nombre: 'Precio: mayor a menor' },
  { id: 'recientes', nombre: 'Más recientes primero' },
]

/** productos que trae una categoría recién elegida */
export const CANTIDAD_CATEGORIA_DEFECTO = 20

export interface FiltrosOdoo {
  /** ids de product.category; cada una trae sus subcategorías y es un filtro en el robot; vacío = todas */
  categorias: number[]
  /** cuántos productos trae cada categoría elegida (por id); con «todas» se usa maximo */
  cantidades: Record<string, number>
  solo_stock: boolean
  solo_imagen: boolean
  maximo: number
  orden: OrdenOdoo
}

export const FILTROS_ODOO_DEFECTO: FiltrosOdoo = {
  categorias: [],
  cantidades: {},
  solo_stock: false,
  solo_imagen: false,
  maximo: 100,
  orden: 'nombre',
}

/** Fila de la tabla catalogo_conexiones (sin la clave, que vive en el Vault) */
export interface ConexionCatalogo {
  project_id: string
  plataforma: 'odoo'
  url: string
  base_datos: string
  clave_id: string | null
  filtros: Partial<FiltrosOdoo>
  ultima_sincronizacion: string | null
  ultimo_resultado: { productos: number; omitidos: number; total: number; avisos: string[] } | null
}

export interface CategoriaOdoo {
  id: number
  nombre: string
  productos: number
}

export interface SincronizacionOdoo {
  productos: ProductoCatalogo[]
  omitidos: { nombre: string; motivo: string }[]
  avisos: string[]
  total: number
}

async function llamar<T>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('catalogo-odoo', { body: cuerpo })
  if (error) {
    let mensaje = describirError(error)
    try {
      const respuesta = (error as { context?: Response }).context
      const json = respuesta ? await respuesta.json() : null
      if (json?.error) mensaje = json.error
    } catch {
      // sin cuerpo legible: queda el mensaje general
    }
    throw new Error(mensaje)
  }
  return data as T
}

export async function leerConexion(projectId: string): Promise<ConexionCatalogo | null> {
  const { data, error } = await supabase.from('catalogo_conexiones').select('*').eq('project_id', projectId).maybeSingle()
  if (error) throw error
  return data as ConexionCatalogo | null
}

export const conectarOdoo = (projectId: string, url: string, baseDatos: string, clave: string) =>
  llamar<{ ok: true; usuario: string; login: string }>({ accion: 'conectar', project_id: projectId, url, base_datos: baseDatos, clave })

export const categoriasOdoo = (projectId: string) =>
  llamar<{ categorias: CategoriaOdoo[] }>({ accion: 'categorias', project_id: projectId }).then((r) => r.categorias)

export const sincronizarOdoo = (projectId: string, filtros: FiltrosOdoo) =>
  llamar<SincronizacionOdoo>({ accion: 'sincronizar', project_id: projectId, filtros })

export const desconectarOdoo = (projectId: string) => llamar<{ ok: true }>({ accion: 'desconectar', project_id: projectId })

/** «comfer-test.dev.odoo.com»: lo que se muestra como origen del catálogo */
export function nombreOrigenOdoo(url: string): string {
  try {
    return `Odoo · ${new URL(url).hostname}`
  } catch {
    return 'Odoo'
  }
}
