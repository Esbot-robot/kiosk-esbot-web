import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'
import { avisoCargando, avisoConfirmar, avisoError, avisoGuardado, cerrarAviso } from '../lib/alertas'
import { nombreRol, usePerfil, type Rol } from '../lib/perfil'
import { Modal } from '../components/Modal'
import { Cargando } from '../components/Cargando'

/** Fila que devuelve la función listar_usuarios (ver supabase/roles.sql) */
interface Usuario {
  user_id: string
  nombre: string
  correo: string
  rol: Rol
  ultimo_ingreso: string | null
  /** último aviso del panel abierto de esa persona */
  visto_at: string | null
  creado_at: string
  proyectos: string[]
}

interface ProyectoCorto {
  id: string
  nombre: string
}

/**
 * Llama a la Edge Function "usuarios" (crear, editar, eliminar, entrar como).
 * Si responde con error, el mensaje es el que la función explica.
 */
async function llamarUsuarios<T = { ok: true }>(cuerpo: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('usuarios', { body: cuerpo })
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

/** El panel avisa cada 10 s: sin aviso en 20 s, la persona ya no está */
const EN_LINEA_MS = 20_000

function enLinea(u: Usuario, ahora: number): boolean {
  return u.visto_at !== null && ahora - new Date(u.visto_at).getTime() < EN_LINEA_MS
}

function haceCuanto(iso: string | null): string {
  if (!iso) return '—'
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `Hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Ayer'
  if (dias < 30) return `Hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function iniciales(nombre: string): string {
  return (
    nombre
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || '?'
  )
}

/** Contraseña aleatoria de 12 caracteres, sin letras que se confunden (l, 1, O, 0) */
function generarContrasena(): string {
  const letras = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const valores = crypto.getRandomValues(new Uint32Array(12))
  return Array.from(valores, (v) => letras[v % letras.length]).join('')
}

export function Usuarios() {
  const yo = usePerfil()
  const queryClient = useQueryClient()
  const [editando, setEditando] = useState<Usuario | 'nuevo' | null>(null)
  const [menuAbierto, setMenuAbierto] = useState<string | null>(null)
  // Reloj para que "en línea" cambie solo, sin esperar datos nuevos
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 5_000)
    return () => clearInterval(id)
  }, [])

  const { data: usuarios, isLoading, error, refetch } = useQuery({
    queryKey: ['usuarios'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_usuarios')
      if (error) throw error
      return data as Usuario[]
    },
    refetchInterval: 10_000,
  })

  const { data: proyectos } = useQuery({
    queryKey: ['proyectos-nombres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, nombre').order('nombre')
      if (error) throw error
      return data as ProyectoCorto[]
    },
  })

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ['usuarios'] })

  async function eliminar(u: Usuario) {
    setMenuAbierto(null)
    const ok = await avisoConfirmar(
      '¿Eliminar usuario?',
      `${u.nombre} (${u.correo}) ya no podrá entrar al panel. No se puede deshacer.`
    )
    if (!ok) return
    try {
      void avisoCargando('Eliminando usuario…')
      await llamarUsuarios({ accion: 'eliminar', user_id: u.user_id })
      await refrescar()
      void cerrarAviso()
      void avisoGuardado('Usuario eliminado')
    } catch (e) {
      void avisoError('No se pudo eliminar', describirError(e))
    }
  }

  /** Abre la cuenta del usuario en otra pestaña, con su sesión solo ahí */
  async function entrarComo(u: Usuario) {
    setMenuAbierto(null)
    // La pestaña se abre ya, dentro del clic: si se abriera después de la
    // respuesta, el navegador la bloquearía como ventana emergente
    const pestana = window.open('about:blank', '_blank')
    try {
      const { url } = await llamarUsuarios<{ url: string }>({
        accion: 'entrar_como',
        user_id: u.user_id,
        redirectTo: `${window.location.origin}/proyectos?como=1`,
      })
      if (pestana) pestana.location.href = url
      else window.open(url, '_blank')
    } catch (e) {
      pestana?.close()
      void avisoError('No se pudo entrar como este usuario', describirError(e))
    }
  }

  return (
    <div className="px-4 py-6 sm:px-8 md:px-12 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 md:text-4xl">Usuarios</h2>
          <p className="mt-2 text-slate-600">
            {yo.rol === 'superadmin' ? 'Usuarios y permisos' : 'Clientes vinculados'}
          </p>
        </div>
        <button
          onClick={() => setEditando('nuevo')}
          className="bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          + Crear usuario
        </button>
      </div>

      <div className="mt-8 rounded-xl bg-white shadow-sm">
        {isLoading ? (
          <Cargando />
        ) : error ? (
          <div className="p-6">
            <p className="text-red-600">No se pudieron cargar los usuarios. {describirError(error)}</p>
            <button onClick={() => void refetch()} className="mt-3 text-sm font-semibold text-indigo-600">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Última vez</th>
                  <th className="w-12 px-4 py-3" aria-label="Acciones" />
                </tr>
              </thead>
              <tbody>
                {(usuarios ?? []).map((u) => {
                  const esYo = u.user_id === yo.user_id
                  const esSuper = u.rol === 'superadmin'
                  const puedeEditar = !esSuper || yo.rol === 'superadmin'
                  const motivoNoEliminar = esSuper
                    ? 'El super administrador no se puede eliminar'
                    : esYo
                      ? 'No puedes eliminar tu propio usuario'
                      : null
                  const nombresProyectos =
                    u.rol === 'lector'
                      ? u.proyectos.map((id) => proyectos?.find((p) => p.id === id)?.nombre).filter(Boolean).join(', ')
                      : ''
                  return (
                    <tr key={u.user_id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {iniciales(u.nombre)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">
                              {u.nombre}
                              {esYo && <span className="font-normal text-slate-400"> (tú)</span>}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {u.correo}
                              {nombresProyectos && ` · ${nombresProyectos}`}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{nombreRol(u.rol)}</td>
                      <td className="px-4 py-3">
                        {enLinea(u, ahora) ? (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            Activo
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                            Inactivo
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                        {enLinea(u, ahora) ? 'Ahora' : haceCuanto(u.visto_at ?? u.ultimo_ingreso)}
                      </td>
                      <td className="px-4 py-3">
                        <MenuAcciones
                          abierto={menuAbierto === u.user_id}
                          onAlternar={() => setMenuAbierto((actual) => (actual === u.user_id ? null : u.user_id))}
                          onCerrar={() => setMenuAbierto(null)}
                          opciones={[
                            {
                              texto: 'Editar',
                              deshabilitado: puedeEditar ? null : 'No puedes editar al super administrador',
                              accion: () => {
                                setMenuAbierto(null)
                                setEditando(u)
                              },
                            },
                            // Superadmin: a cualquiera. Admin: solo a clientes lectores
                            ...(!esYo && (yo.rol === 'superadmin' || u.rol === 'lector')
                              ? [{ texto: 'Entrar como este usuario', deshabilitado: null, accion: () => void entrarComo(u) }]
                              : []),
                            { texto: 'Eliminar', peligro: true, deshabilitado: motivoNoEliminar, accion: () => void eliminar(u) },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editando && (
        <DialogUsuario
          usuario={editando === 'nuevo' ? null : editando}
          proyectos={proyectos ?? []}
          puedeCrearAdmin={yo.rol === 'superadmin'}
          onCerrar={() => setEditando(null)}
          onGuardado={() => void refrescar()}
        />
      )}
    </div>
  )
}

interface OpcionMenu {
  texto: string
  accion: () => void
  /** motivo por el que no se puede (se muestra al pasar el mouse) */
  deshabilitado: string | null
  peligro?: boolean
}

/** Botón ⋯ con las acciones de una fila */
function MenuAcciones({
  abierto,
  onAlternar,
  onCerrar,
  opciones,
}: {
  abierto: boolean
  onAlternar: () => void
  onCerrar: () => void
  opciones: OpcionMenu[]
}) {
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const [posicion, setPosicion] = useState<{ top: number; right: number } | null>(null)

  // El menú flota fijo sobre la página, debajo del botón: dentro de la tabla
  // (que se desplaza de lado en teléfono) la estiraba y la hacía desplazar
  useEffect(() => {
    if (!abierto) return
    const ubicar = () => {
      const r = boton.current?.getBoundingClientRect()
      if (r) setPosicion({ top: r.bottom + 4, right: window.innerWidth - r.right })
    }
    ubicar()
    const clic = (e: MouseEvent) => {
      if (caja.current && !caja.current.contains(e.target as Node)) onCerrar()
    }
    // Al desplazar la página el botón se mueve: el menú se cierra
    const cerrar = () => onCerrar()
    document.addEventListener('mousedown', clic)
    window.addEventListener('scroll', cerrar, true)
    window.addEventListener('resize', cerrar)
    return () => {
      document.removeEventListener('mousedown', clic)
      window.removeEventListener('scroll', cerrar, true)
      window.removeEventListener('resize', cerrar)
    }
  }, [abierto, onCerrar])

  return (
    <div ref={caja}>
      <button
        ref={boton}
        type="button"
        onClick={onAlternar}
        aria-label="Acciones"
        aria-expanded={abierto}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>
      {abierto && posicion && (
        <div
          className="fixed z-50 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
          style={{ top: posicion.top, right: posicion.right }}
        >
          {opciones.map((o) => (
            <button
              key={o.texto}
              type="button"
              disabled={o.deshabilitado !== null}
              title={o.deshabilitado ?? undefined}
              onClick={o.accion}
              className={`block w-full rounded-md px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                o.peligro ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              {o.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Crear o editar un usuario */
function DialogUsuario({
  usuario,
  proyectos,
  puedeCrearAdmin,
  onCerrar,
  onGuardado,
}: {
  usuario: Usuario | null
  proyectos: ProyectoCorto[]
  puedeCrearAdmin: boolean
  onCerrar: () => void
  onGuardado: () => void
}) {
  const nuevo = usuario === null
  const esSuper = usuario?.rol === 'superadmin'
  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [correo, setCorreo] = useState(usuario?.correo ?? '')
  const [rol, setRol] = useState<Rol>(usuario?.rol ?? 'lector')
  const [seleccion, setSeleccion] = useState<string[]>(usuario?.proyectos ?? [])
  const [contrasena, setContrasena] = useState(nuevo ? generarContrasena() : '')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiada, setCopiada] = useState(false)

  // Un admin no puede convertir a nadie en administrador; si edita a uno que ya lo es, lo conserva
  const rolesPosibles: Rol[] = esSuper
    ? ['superadmin']
    : puedeCrearAdmin || usuario?.rol === 'admin'
      ? ['admin', 'lector']
      : ['lector']
  const disponibles = proyectos.filter((p) => !seleccion.includes(p.id))

  async function copiar() {
    try {
      await navigator.clipboard.writeText(contrasena)
      setCopiada(true)
      setTimeout(() => setCopiada(false), 1500)
    } catch {
      // sin portapapeles: se copia a mano del campo
    }
  }

  async function guardar() {
    setError('')
    if (nombre.trim().length < 2) return setError('Escribe el nombre.')
    if (!/^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/.test(correo.trim())) return setError('Revisa el correo.')
    if ((nuevo || contrasena) && contrasena.length < 8) {
      return setError('La contraseña debe tener al menos 8 caracteres.')
    }
    if (rol === 'lector' && seleccion.length === 0) return setError('Elige al menos un proyecto para el cliente.')

    setGuardando(true)
    try {
      if (nuevo) {
        await llamarUsuarios({
          accion: 'crear',
          nombre: nombre.trim(),
          correo: correo.trim(),
          contrasena,
          rol,
          proyectos: rol === 'lector' ? seleccion : [],
        })
      } else {
        await llamarUsuarios({
          accion: 'editar',
          user_id: usuario.user_id,
          nombre: nombre.trim(),
          correo: correo.trim() !== usuario.correo ? correo.trim() : undefined,
          contrasena: contrasena || undefined,
          rol,
          proyectos: rol === 'lector' ? seleccion : [],
        })
      }
      onGuardado()
      onCerrar()
      void avisoGuardado(nuevo ? 'Usuario creado' : 'Usuario actualizado')
    } catch (e) {
      setError(describirError(e))
    } finally {
      setGuardando(false)
    }
  }

  const campo = 'w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:outline-none'

  return (
    <Modal
      titulo={nuevo ? 'Crear usuario' : 'Editar usuario'}
      onCancelar={onCerrar}
      onAceptar={() => void guardar()}
      aceptarDeshabilitado={guardando}
      textoAceptar={guardando ? 'Guardando…' : 'Guardar'}
      aviso={error}
      ancho="max-w-[35rem]"
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-sm font-medium text-slate-800">Nombre</p>
          <input value={nombre} onChange={(e) => setNombre(e.target.value.slice(0, 80))} className={campo} />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-800">Correo</p>
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value.slice(0, 120))}
            placeholder="nombre@empresa.com"
            className={campo}
          />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-800">Rol</p>
          {/* Flecha propia: la del navegador quedaba pegada al borde */}
          <div className="relative">
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              disabled={rolesPosibles.length === 1}
              className={`${campo} appearance-none bg-white pr-10 disabled:bg-slate-50`}
            >
              {rolesPosibles.map((r) => (
                <option key={r} value={r}>
                  {nombreRol(r)}
                </option>
              ))}
            </select>
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {rol === 'lector' && (
          <div>
            <p className="mb-1 text-sm font-medium text-slate-800">Proyectos que puede ver</p>
            <div className="flex flex-wrap gap-2">
              {seleccion.map((id) => (
                <span
                  key={id}
                  className="flex items-center gap-1.5 rounded-full border border-slate-300 py-1 pl-3 pr-1 text-sm text-slate-700"
                >
                  {proyectos.find((p) => p.id === id)?.nombre ?? 'Proyecto'}
                  <button
                    type="button"
                    onClick={() => setSeleccion((s) => s.filter((x) => x !== id))}
                    aria-label="Quitar proyecto"
                    className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    ✕
                  </button>
                </span>
              ))}
              {disponibles.length > 0 && (
                <select
                  value=""
                  onChange={(e) => e.target.value && setSeleccion((s) => [...s, e.target.value])}
                  className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-sm text-slate-600"
                >
                  <option value="">+ Agregar proyecto</option>
                  {disponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1 text-sm font-medium text-slate-800">{nuevo ? 'Contraseña' : 'Nueva contraseña'}</p>
          <div className="flex gap-2">
            <input
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value.slice(0, 72))}
              placeholder={nuevo ? '' : 'Déjala vacía para no cambiarla'}
              className={campo}
            />
            <button
              type="button"
              onClick={() => setContrasena(generarContrasena())}
              className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Generar
            </button>
            {contrasena && (
              <button
                type="button"
                onClick={() => void copiar()}
                className="shrink-0 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copiada ? 'Copiada' : 'Copiar'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
