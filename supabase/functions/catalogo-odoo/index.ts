// ─────────────────────────────────────────────────────────────────────────
// Edge Function "catalogo-odoo"
//
// Trae los productos del catálogo desde el Odoo del cliente (Odoo 19, API
// JSON-2) en vez de un archivo. Vive en el servidor por dos razones: Odoo no
// acepta llamadas desde otra página web, y la clave API del cliente no puede
// estar en el navegador. La clave se guarda cifrada en el Vault (ver
// supabase/catalogo_conexion.sql) y solo se lee aquí.
//
// Acciones (solo superadmin y admin):
//   - conectar:     guarda dirección, base de datos y clave; prueba la conexión
//   - categorias:   lista las categorías de productos de Odoo con su cantidad
//   - sincronizar:  trae los productos con los filtros y los devuelve ya en el
//                   formato del catálogo; las imágenes quedan en nuestro
//                   almacenamiento. NO guarda el proyecto: el panel los muestra
//                   y se guardan con «Guardar», igual que al cargar un archivo
//   - desconectar:  borra la conexión y su clave
//
// La verificación del token la hace la función misma (getUser), así que al
// desplegarla se puede desactivar "Verify JWT".
// ─────────────────────────────────────────────────────────────────────────
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Mismos límites que el CSV del catálogo (src/lib/catalogo.ts)
const MAX_PRODUCTOS = 500
const MAX_NOMBRE = 120
const MAX_DESCRIPCION = 600
const MAX_CATEGORIA = 40
/** imágenes por llamada a Odoo y subidas en paralelo */
const TANDA_IMAGENES = 10
/** la función tiene un tiempo máximo: pasado esto deja imágenes para la siguiente sincronización */
const TIEMPO_IMAGENES_MS = 100_000

type Orden = 'nombre' | 'precio_asc' | 'precio_desc' | 'recientes'
const ORDENES: Record<Orden, string> = {
  nombre: 'name asc',
  precio_asc: 'list_price asc',
  precio_desc: 'list_price desc',
  recientes: 'create_date desc',
}

interface Filtros {
  /** ids de product.category; cada una trae sus subcategorías y es un filtro en el robot */
  categorias: number[]
  /** cuántos productos trae cada categoría elegida (por id) */
  cantidades: Record<string, number>
  solo_stock: boolean
  solo_imagen: boolean
  maximo: number
  orden: Orden
}

interface Conexion {
  project_id: string
  url: string
  base_datos: string
  clave_id: string | null
  filtros: Partial<Filtros>
}

interface ProductoCatalogo {
  nombre: string
  precio: number
  stock: number | null
  imagen_url: string
  precio_anterior: number | null
  descripcion: string
  categoria: string
}

function claveServicio(): string {
  try {
    const nuevas = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
    const primera = Object.values(nuevas)[0]
    if (primera) return primera
  } catch {
    // formato inesperado: se usa la antigua
  }
  const antigua = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!antigua) throw new Error('No hay clave de servicio disponible en la función')
  return antigua
}

function respuesta(cuerpo: unknown, estado = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status: estado,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/** Error con el texto que verá el panel */
class Rechazo extends Error {
  constructor(mensaje: string, public estado = 400) {
    super(mensaje)
  }
}

/** Solo la dirección base (https://empresa.odoo.com), sin rutas como /odoo/sales */
function normalizarUrl(valor: unknown): string {
  let url: URL
  try {
    url = new URL(String(valor ?? '').trim())
  } catch {
    throw new Rechazo('Revise la dirección de Odoo (por ejemplo https://empresa.odoo.com).')
  }
  if (url.protocol !== 'https:') throw new Rechazo('La dirección de Odoo debe empezar por https://')
  const host = url.hostname
  if (host === 'localhost' || /^[\d.]+$/.test(host) || host.includes(':')) {
    throw new Rechazo('Use la dirección pública de Odoo, no una IP ni localhost.')
  }
  return url.origin
}

/** cantidad de una categoría elegida si no se indicó */
const CANTIDAD_DEFECTO = 20

const entre1yMax = (n: unknown, defecto: number) => Math.min(MAX_PRODUCTOS, Math.max(1, Math.round(Number(n) || defecto)))

function normalizarFiltros(f: Partial<Filtros> | undefined): Filtros {
  const maximo = Math.round(Number(f?.maximo) || MAX_PRODUCTOS)
  const categorias = Array.isArray(f?.categorias) ? [...new Set(f!.categorias.filter((x) => Number.isInteger(x)))] : []
  const cantidades: Record<string, number> = {}
  for (const id of categorias) cantidades[String(id)] = entre1yMax(f?.cantidades?.[String(id)], CANTIDAD_DEFECTO)
  return {
    categorias,
    cantidades,
    solo_stock: !!f?.solo_stock,
    solo_imagen: !!f?.solo_imagen,
    maximo: Math.min(MAX_PRODUCTOS, Math.max(1, maximo)),
    orden: f?.orden && f.orden in ORDENES ? f.orden : 'nombre',
  }
}

/** Llamada a la API JSON-2 de Odoo 19: POST /json/2/<modelo>/<método> */
async function odoo<T>(url: string, base: string, clave: string, modelo: string, metodo: string, args: Record<string, unknown> = {}): Promise<T> {
  let r: Response
  try {
    r = await fetch(`${url}/json/2/${modelo}/${metodo}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `bearer ${clave}`,
        ...(base ? { 'X-Odoo-Database': base } : {}),
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new Rechazo('No fue posible comunicarse con Odoo. Revise la dirección.')
  }
  if (r.status === 401) throw new Rechazo('Odoo rechazó la clave API. Revise que sea correcta y que no haya vencido.')
  if (r.status === 404) throw new Rechazo('Esa dirección no responde como Odoo 19. Revise la dirección (la integración requiere Odoo 19 o superior).')
  if (r.status === 403) throw new Rechazo('El usuario de la clave API no tiene permiso para leer los productos.')
  if (!r.ok) {
    const detalle = (await r.text()).slice(0, 300)
    console.error('odoo', modelo, metodo, r.status, detalle)
    throw new Rechazo(`Odoo respondió con un error (${r.status}).`)
  }
  return (await r.json()) as T
}

async function leerConexion(admin: SupabaseClient, projectId: string): Promise<{ conexion: Conexion; clave: string }> {
  const { data: conexion } = await admin
    .from('catalogo_conexiones')
    .select('project_id, url, base_datos, clave_id, filtros')
    .eq('project_id', projectId)
    .maybeSingle<Conexion>()
  if (!conexion) throw new Rechazo('Este proyecto no tiene una conexión con Odoo.')
  const { data: clave, error } = await admin.rpc('catalogo_leer_clave', { p_project: projectId })
  if (error || !clave) throw new Rechazo('La conexión no tiene clave API. Vuelva a conectar.')
  return { conexion, clave: clave as string }
}

/** Último nivel de la categoría: «Todos / Hogar / Grifería» → «Grifería» */
function categoriaCorta(categ: unknown): string {
  if (!Array.isArray(categ) || typeof categ[1] !== 'string') return ''
  return (categ[1].split(' / ').pop() ?? '').trim().slice(0, MAX_CATEGORIA)
}

/** Tipo de imagen por sus primeros bytes (Odoo guarda la imagen tal como se subió) */
function tipoImagen(bytes: Uint8Array): string | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return 'image/webp'
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, claveServicio(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ¿Quién llama? Solo superadmin y admin configuran el catálogo
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: sesion, error: errorSesion } = await admin.auth.getUser(token)
    if (errorSesion || !sesion.user) throw new Rechazo('Su sesión venció. Vuelva a iniciar sesión.', 401)
    const { data: yo } = await admin.from('perfiles').select('user_id, rol').eq('user_id', sesion.user.id).maybeSingle()
    if (!yo || (yo.rol !== 'admin' && yo.rol !== 'superadmin')) {
      throw new Rechazo('No tiene permiso para configurar el catálogo.', 403)
    }

    const cuerpo = await req.json()
    const accion = cuerpo?.accion as string
    const projectId = String(cuerpo?.project_id ?? '')
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) throw new Rechazo('Proyecto no válido.')
    const { data: proyecto } = await admin.from('projects').select('id').eq('id', projectId).maybeSingle()
    if (!proyecto) throw new Rechazo('El proyecto no existe.', 404)

    // ── Conectar: guarda y prueba ──
    if (accion === 'conectar') {
      const url = normalizarUrl(cuerpo?.url)
      const base = String(cuerpo?.base_datos ?? '').trim()
      const claveNueva = typeof cuerpo?.clave === 'string' ? cuerpo.clave.trim() : ''

      const { data: previa } = await admin.from('catalogo_conexiones').select('clave_id').eq('project_id', projectId).maybeSingle()
      let clave = claveNueva
      if (!clave) {
        if (!previa?.clave_id) throw new Rechazo('Ingrese la clave API.')
        const { data } = await admin.rpc('catalogo_leer_clave', { p_project: projectId })
        clave = (data as string) ?? ''
      }

      // Se prueba antes de guardar: una conexión que no funciona no queda guardada
      const contexto = await odoo<{ uid?: number }>(url, base, clave, 'res.users', 'context_get')
      if (!contexto?.uid) throw new Rechazo('Odoo no devolvió el usuario de la clave API.')
      const usuario = await odoo<{ name: string; login: string }[]>(url, base, clave, 'res.users', 'read', {
        ids: [contexto.uid],
        fields: ['name', 'login'],
      })
      await odoo(url, base, clave, 'product.template', 'search_count', { domain: [] })

      const { error } = await admin.from('catalogo_conexiones').upsert({
        project_id: projectId,
        plataforma: 'odoo',
        url,
        base_datos: base,
        actualizado_por: yo.user_id,
        actualizado_at: new Date().toISOString(),
      })
      if (error) throw new Rechazo('No se pudo guardar la conexión.')
      if (claveNueva) {
        const { error: errorClave } = await admin.rpc('catalogo_guardar_clave', { p_project: projectId, p_clave: claveNueva })
        if (errorClave) throw new Rechazo('No se pudo guardar la clave API.')
      }
      return respuesta({ ok: true, usuario: usuario?.[0]?.name ?? '', login: usuario?.[0]?.login ?? '' })
    }

    // ── Desconectar ──
    if (accion === 'desconectar') {
      const { error } = await admin.rpc('catalogo_borrar_conexion', { p_project: projectId })
      if (error) throw new Rechazo('No se pudo borrar la conexión.')
      return respuesta({ ok: true })
    }

    const { conexion, clave } = await leerConexion(admin, projectId)
    const llamar = <T,>(modelo: string, metodo: string, args?: Record<string, unknown>) =>
      odoo<T>(conexion.url, conexion.base_datos, clave, modelo, metodo, args)

    // ── Categorías ──
    if (accion === 'categorias') {
      const categorias = await llamar<{ id: number; complete_name: string; product_count: number }[]>(
        'product.category',
        'search_read',
        { domain: [], fields: ['id', 'complete_name', 'product_count'], order: 'complete_name asc' }
      )
      return respuesta({
        categorias: categorias.map((c) => ({ id: c.id, nombre: c.complete_name, productos: c.product_count })),
      })
    }

    // ── Sincronizar ──
    if (accion === 'sincronizar') {
      const inicio = Date.now()
      const filtros = normalizarFiltros(cuerpo?.filtros ?? conexion.filtros)
      await admin.from('catalogo_conexiones').update({ filtros }).eq('project_id', projectId)

      // Campos que dependen de los módulos instalados en ese Odoo
      const campos = await llamar<Record<string, unknown>>('product.template', 'fields_get', { attributes: ['type'] })
      const hay = (c: string) => c in campos
      const conStock = hay('qty_available') && hay('is_storable')

      const base: unknown[] = [['sale_ok', '=', true]]
      if (filtros.solo_imagen) base.push(['image_1920', '!=', false])
      // Solo con stock: los productos sin inventario (servicios, consumibles) siempre entran
      if (filtros.solo_stock && conStock) base.push('|', ['is_storable', '=', false], ['qty_available', '>', 0])

      const leer = ['id', 'name', 'list_price', 'description_sale', 'categ_id', 'write_date']
      if (hay('compare_list_price')) leer.push('compare_list_price')
      if (conStock) leer.push('qty_available', 'is_storable')
      const buscar = (dominio: unknown[], limite: number) =>
        Promise.all([
          llamar<number>('product.template', 'search_count', { domain: dominio }),
          llamar<Record<string, unknown>[]>('product.template', 'search_read', {
            domain: dominio,
            fields: leer,
            order: ORDENES[filtros.orden],
            limit: limite,
          }),
        ])

      const avisos: string[] = []
      let total = 0
      let filas: Record<string, unknown>[] = []
      /** filtro del robot de cada producto (id → nombre de la categoría elegida) */
      const categoriaElegida = new Map<number, string>()

      if (filtros.categorias.length === 0) {
        // Todas las categorías: un solo tope; cada producto con su categoría de Odoo
        ;[total, filas] = await buscar(base, filtros.maximo)
        if (total > filas.length) {
          avisos.push(`Odoo tiene ${total} productos con estos filtros; se trajeron los primeros ${filas.length} según el orden elegido.`)
        }
      } else {
        // Cada categoría elegida trae su propia cantidad y es un filtro en el robot,
        // con los productos de sus subcategorías dentro
        const suma = filtros.categorias.reduce((n, id) => n + filtros.cantidades[String(id)], 0)
        if (suma > MAX_PRODUCTOS) {
          throw new Rechazo(`La suma de las cantidades (${suma}) supera el máximo de ${MAX_PRODUCTOS} productos.`)
        }
        const categorias = await llamar<{ id: number; complete_name: string }[]>('product.category', 'read', {
          ids: filtros.categorias,
          fields: ['complete_name'],
        })
        // La más específica primero: si se eligieron «CEMENTO» y «CEMENTO / BLANCO», los
        // de BLANCO van a BLANCO y no se repiten en CEMENTO
        const profundidad = (c: { complete_name: string }) => c.complete_name.split(' / ').length
        const porId = new Map<number, Record<string, unknown>[]>()
        for (const c of [...categorias].sort((a, b) => profundidad(b) - profundidad(a))) {
          const nombre = categoriaCorta([c.id, c.complete_name])
          const dominio = [...base, ['categ_id', 'child_of', c.id]]
          const yaTraidos = [...categoriaElegida.keys()]
          if (yaTraidos.length > 0) dominio.push(['id', 'not in', yaTraidos])
          const pedidos = filtros.cantidades[String(c.id)]
          const [cuantos, lote] = await buscar(dominio, pedidos)
          total += cuantos
          porId.set(c.id, lote)
          for (const f of lote) categoriaElegida.set(f.id as number, nombre)
          if (cuantos > lote.length) avisos.push(`${nombre}: Odoo tiene ${cuantos} productos; se trajeron ${lote.length}.`)
          else if (lote.length < pedidos) {
            avisos.push(
              lote.length === 0
                ? `${nombre}: no hay productos con estos filtros.`
                : `${nombre}: solo hay ${lote.length} ${lote.length === 1 ? 'producto' : 'productos'} con estos filtros (se pidieron ${pedidos}).`
            )
          }
        }
        // En el catálogo, las categorías quedan en el orden en que se eligieron
        filas = filtros.categorias.flatMap((id) => porId.get(id) ?? [])
      }
      const conImagen = new Set(
        await llamar<number[]>('product.template', 'search', {
          domain: [['id', 'in', filas.map((f) => f.id)], ['image_1920', '!=', false]],
        })
      )

      // Imágenes: una por producto y por versión (id + fecha de modificación);
      // solo se bajan de Odoo las que no estén ya en nuestro almacenamiento
      const carpeta = `${projectId}/odoo`
      const existentes = new Set<string>()
      for (let desde = 0; ; desde += 1000) {
        const { data: pagina } = await admin.storage.from('media').list(carpeta, { limit: 1000, offset: desde })
        for (const o of pagina ?? []) existentes.add(o.name)
        if (!pagina || pagina.length < 1000) break
      }
      const nombreImagen = (f: Record<string, unknown>) => `${f.id}_${String(f.write_date ?? '').replace(/\D/g, '')}`
      const urlImagen = (nombre: string) => `${supabaseUrl}/storage/v1/object/public/media/${carpeta}/${nombre}`

      const faltan = filas.filter((f) => conImagen.has(f.id as number) && !existentes.has(nombreImagen(f)))
      let pendientes = 0
      for (let i = 0; i < faltan.length; i += TANDA_IMAGENES) {
        if (Date.now() - inicio > TIEMPO_IMAGENES_MS) {
          pendientes = faltan.length - i
          break
        }
        const tanda = faltan.slice(i, i + TANDA_IMAGENES)
        const imagenes = await llamar<{ id: number; image_1024: string | false }[]>('product.template', 'read', {
          ids: tanda.map((f) => f.id),
          fields: ['image_1024'],
        })
        await Promise.all(
          imagenes.map(async (img) => {
            if (!img.image_1024) return
            const bytes = Uint8Array.from(atob(img.image_1024), (c) => c.charCodeAt(0))
            const tipo = tipoImagen(bytes)
            if (!tipo) return
            const fila = tanda.find((f) => f.id === img.id)!
            const nombre = nombreImagen(fila)
            const { error } = await admin.storage
              .from('media')
              .upload(`${carpeta}/${nombre}`, bytes, { contentType: tipo, upsert: true })
            if (!error) existentes.add(nombre)
          })
        )
      }

      const omitidos: { nombre: string; motivo: string }[] = []
      const productos: ProductoCatalogo[] = []
      for (const f of filas) {
        const nombre = String(f.name ?? '').trim()
        const precio = Number(f.list_price)
        if (!nombre) {
          omitidos.push({ nombre: `Producto ${f.id}`, motivo: 'no tiene nombre.' })
          continue
        }
        if (!Number.isFinite(precio) || precio < 0) {
          omitidos.push({ nombre, motivo: 'el precio no es válido.' })
          continue
        }
        const anterior = Number(f.compare_list_price)
        const imagen = nombreImagen(f)
        productos.push({
          nombre: nombre.slice(0, MAX_NOMBRE),
          precio: Math.round(precio * 100) / 100,
          stock: conStock && f.is_storable ? Math.max(0, Math.floor(Number(f.qty_available) || 0)) : null,
          imagen_url: existentes.has(imagen) ? urlImagen(imagen) : '',
          precio_anterior: Number.isFinite(anterior) && anterior > precio ? Math.round(anterior * 100) / 100 : null,
          descripcion: typeof f.description_sale === 'string' ? f.description_sale.trim().slice(0, MAX_DESCRIPCION) : '',
          categoria: categoriaElegida.get(f.id as number) ?? categoriaCorta(f.categ_id),
        })
      }

      if (pendientes > 0) {
        avisos.push(`${pendientes} imágenes quedaron pendientes por tiempo: pulse «Sincronizar ahora» de nuevo para completarlas.`)
      }
      if (filtros.solo_stock && !conStock) avisos.push('Este Odoo no maneja inventario: el filtro «Solo con stock» no se aplicó.')

      const resultado = { productos: productos.length, omitidos: omitidos.length, total, avisos }
      await admin
        .from('catalogo_conexiones')
        .update({ ultima_sincronizacion: new Date().toISOString(), ultimo_resultado: resultado })
        .eq('project_id', projectId)

      return respuesta({ productos, omitidos, avisos, total })
    }

    throw new Rechazo('Acción no válida.')
  } catch (e) {
    if (e instanceof Rechazo) return respuesta({ error: e.message }, e.estado)
    console.error('catalogo-odoo:', e)
    return respuesta({ error: 'Error inesperado en el servidor.' }, 500)
  }
})
