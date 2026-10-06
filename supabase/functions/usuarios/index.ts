// ─────────────────────────────────────────────────────────────────────────
// Edge Function "usuarios"
//
// Crear, editar y eliminar usuarios del panel, y el acceso "Entrar como".
// Necesita la clave de servicio de Supabase (crear cuentas, cambiar
// contraseñas), que no puede estar en el navegador: por eso vive aquí, y
// antes de hacer nada revisa quién la llama y qué rol tiene.
//
// Reglas (ver supabase/roles.sql):
//   - crear lector: superadmin y admin       - crear admin: solo superadmin
//   - un admin solo ve, edita y elimina clientes lectores
//   - el superadmin edita a todos y elimina admins y lectores
//   - nadie elimina al superadmin ni se elimina a sí mismo
//   - entrar como: el superadmin a cualquiera; un admin solo a clientes lectores
//   - entrar como: solo superadmin
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

type Rol = 'superadmin' | 'admin' | 'lector'

interface Perfil {
  user_id: string
  nombre: string
  rol: Rol
}

/** Clave de servicio: la nueva (sb_secret_...) si existe; si no, la antigua */
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

const CORREO = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/

function validarDatos(datos: { nombre?: string; correo?: string; contrasena?: string }, crear: boolean) {
  if (crear || datos.nombre !== undefined) {
    if (!datos.nombre || datos.nombre.trim().length < 2) throw new Rechazo('Escribe el nombre.')
  }
  if (crear || datos.correo !== undefined) {
    if (!datos.correo || !CORREO.test(datos.correo.trim())) throw new Rechazo('Revisa el correo.')
  }
  if (crear || datos.contrasena) {
    if (!datos.contrasena || datos.contrasena.length < 8) {
      throw new Rechazo('La contraseña debe tener al menos 8 caracteres.')
    }
  }
}

/** Lo que hace un admin queda en la actividad que ve el superadmin */
async function registrar(admin: SupabaseClient, yo: Perfil, texto: string, objetivo: string) {
  if (yo.rol !== 'admin') return
  await admin.from('actividad').insert({
    actor_id: yo.user_id,
    actor_nombre: yo.nombre,
    accion: 'usuario',
    texto,
    objetivo,
  })
}

function nombreRol(rol: Rol) {
  return rol === 'admin' ? 'administrador' : rol === 'lector' ? 'cliente lector' : 'super administrador'
}

async function guardarProyectos(admin: SupabaseClient, userId: string, rol: Rol, proyectos: string[] | undefined) {
  // Solo los lectores tienen lista; un admin ve todo
  if (rol !== 'lector') {
    await admin.from('perfil_proyectos').delete().eq('user_id', userId)
    return
  }
  if (proyectos === undefined) return
  await admin.from('perfil_proyectos').delete().eq('user_id', userId)
  const filas = [...new Set(proyectos)].map((project_id) => ({ user_id: userId, project_id }))
  if (filas.length > 0) {
    const { error } = await admin.from('perfil_proyectos').insert(filas)
    if (error) throw new Rechazo('No se pudieron guardar los proyectos del usuario.')
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, claveServicio(), {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // ¿Quién llama?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: sesion, error: errorSesion } = await admin.auth.getUser(token)
    if (errorSesion || !sesion.user) throw new Rechazo('Tu sesión venció. Vuelve a iniciar sesión.', 401)
    const { data: yo } = await admin
      .from('perfiles')
      .select('user_id, nombre, rol')
      .eq('user_id', sesion.user.id)
      .single<Perfil>()
    if (!yo || (yo.rol !== 'admin' && yo.rol !== 'superadmin')) {
      throw new Rechazo('No tienes permiso para administrar usuarios.', 403)
    }

    const cuerpo = await req.json()
    const accion = cuerpo?.accion as string

    // ── Crear ──
    if (accion === 'crear') {
      const { nombre, correo, contrasena, rol, proyectos } = cuerpo as {
        nombre: string
        correo: string
        contrasena: string
        rol: Rol
        proyectos?: string[]
      }
      validarDatos({ nombre, correo, contrasena }, true)
      if (rol !== 'admin' && rol !== 'lector') throw new Rechazo('Rol no válido.')
      if (rol === 'admin' && yo.rol !== 'superadmin') {
        throw new Rechazo('Solo el super administrador puede crear administradores.', 403)
      }

      const { data: creado, error } = await admin.auth.admin.createUser({
        email: correo.trim().toLowerCase(),
        password: contrasena,
        email_confirm: true,
        user_metadata: { nombre: nombre.trim() },
      })
      if (error || !creado.user) {
        const repetido = /already|registered|exists/i.test(error?.message ?? '')
        throw new Rechazo(repetido ? 'Ya existe un usuario con ese correo.' : 'No se pudo crear el usuario.')
      }
      const userId = creado.user.id
      const { error: errorPerfil } = await admin
        .from('perfiles')
        .insert({ user_id: userId, nombre: nombre.trim(), rol, creado_por: yo.user_id })
      if (errorPerfil) {
        // Sin perfil la cuenta no sirve: se deshace para no dejarla a medias
        await admin.auth.admin.deleteUser(userId)
        throw new Rechazo('No se pudo crear el perfil del usuario.')
      }
      await guardarProyectos(admin, userId, rol, proyectos ?? [])
      await registrar(admin, yo, `creó el ${nombreRol(rol)} ${nombre.trim()}`, nombre.trim())
      return respuesta({ ok: true, user_id: userId })
    }

    // Las demás acciones son sobre un usuario existente
    const userId = cuerpo?.user_id as string
    const { data: objetivo } = await admin
      .from('perfiles')
      .select('user_id, nombre, rol')
      .eq('user_id', userId)
      .single<Perfil>()
    if (!objetivo) throw new Rechazo('Ese usuario ya no existe.', 404)
    // Un administrador solo gestiona clientes lectores (no ve a otros admins)
    if (yo.rol === 'admin' && objetivo.rol !== 'lector') {
      throw new Rechazo('Solo puedes gestionar clientes lectores.', 403)
    }

    // ── Editar ──
    if (accion === 'editar') {
      const { nombre, correo, contrasena, rol, proyectos } = cuerpo as {
        nombre?: string
        correo?: string
        contrasena?: string
        rol?: Rol
        proyectos?: string[]
      }
      if (objetivo.rol === 'superadmin' && yo.rol !== 'superadmin') {
        throw new Rechazo('No puedes editar al super administrador.', 403)
      }
      validarDatos({ nombre, correo, contrasena }, false)
      const nuevoRol = rol ?? objetivo.rol
      if (objetivo.rol === 'superadmin' && nuevoRol !== 'superadmin') {
        throw new Rechazo('El super administrador no puede cambiar de rol.')
      }
      if (objetivo.rol !== 'superadmin' && nuevoRol !== 'admin' && nuevoRol !== 'lector') {
        throw new Rechazo('Rol no válido.')
      }
      if (nuevoRol === 'admin' && objetivo.rol !== 'admin' && yo.rol !== 'superadmin') {
        throw new Rechazo('Solo el super administrador puede crear administradores.', 403)
      }

      const cambiosCuenta: { email?: string; password?: string; user_metadata?: Record<string, string> } = {}
      if (correo) cambiosCuenta.email = correo.trim().toLowerCase()
      if (contrasena) cambiosCuenta.password = contrasena
      if (nombre) cambiosCuenta.user_metadata = { nombre: nombre.trim() }
      if (Object.keys(cambiosCuenta).length > 0) {
        const { error } = await admin.auth.admin.updateUserById(userId, { ...cambiosCuenta, email_confirm: true })
        if (error) {
          const repetido = /already|registered|exists/i.test(error.message)
          throw new Rechazo(repetido ? 'Ya existe un usuario con ese correo.' : 'No se pudo actualizar la cuenta.')
        }
      }
      const { error: errorPerfil } = await admin
        .from('perfiles')
        .update({ nombre: nombre?.trim() ?? objetivo.nombre, rol: nuevoRol })
        .eq('user_id', userId)
      if (errorPerfil) throw new Rechazo('No se pudo actualizar el perfil.')
      await guardarProyectos(admin, userId, nuevoRol, proyectos)

      const nombreFinal = nombre?.trim() || objetivo.nombre
      await registrar(admin, yo, `editó al ${nombreRol(nuevoRol)} ${nombreFinal}`, nombreFinal)
      return respuesta({ ok: true })
    }

    // ── Eliminar ──
    if (accion === 'eliminar') {
      if (objetivo.rol === 'superadmin') throw new Rechazo('El super administrador no se puede eliminar.', 403)
      if (objetivo.user_id === yo.user_id) throw new Rechazo('No puedes eliminar tu propio usuario.')
      const { error } = await admin.auth.admin.deleteUser(userId)
      if (error) throw new Rechazo('No se pudo eliminar el usuario.')
      await registrar(admin, yo, `eliminó al ${nombreRol(objetivo.rol)} ${objetivo.nombre}`, objetivo.nombre)
      return respuesta({ ok: true })
    }

    // ── Entrar como ──
    if (accion === 'entrar_como') {
      // (un admin ya pasó el filtro de arriba: el objetivo es un cliente lector)
      if (objetivo.user_id === yo.user_id) throw new Rechazo('Ya estás en tu propia cuenta.')
      const { data: cuenta } = await admin.auth.admin.getUserById(userId)
      const correo = cuenta.user?.email
      if (!correo) throw new Rechazo('Ese usuario no tiene correo.')
      // Enlace de un solo uso: no se envía por correo, solo vuelve aquí
      const { data, error } = await admin.auth.admin.generateLink({
        type: 'magiclink',
        email: correo,
        options: { redirectTo: cuerpo?.redirectTo },
      })
      if (error || !data.properties?.action_link) throw new Rechazo('No se pudo generar el acceso.')
      await registrar(admin, yo, `entró como el ${nombreRol(objetivo.rol)} ${objetivo.nombre}`, objetivo.nombre)
      return respuesta({ ok: true, url: data.properties.action_link })
    }

    throw new Rechazo('Acción no válida.')
  } catch (e) {
    if (e instanceof Rechazo) return respuesta({ error: e.message }, e.estado)
    console.error('usuarios:', e)
    return respuesta({ error: 'Error inesperado en el servidor.' }, 500)
  }
})
