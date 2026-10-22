import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { avisoGuardado } from '../lib/alertas'
import { llamarUsuarios } from '../lib/usuariosApi'
import { nombreRol, usePerfil } from '../lib/perfil'

/** Dos primeras iniciales del nombre ("Ana María Pérez" → "AM") */
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

const campo = 'w-full rounded-lg border px-4 py-2.5 text-slate-800'

/** Una fila: el nombre del dato a la izquierda y el campo, largo, a la derecha */
function Fila({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 py-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-center sm:gap-6">
      <p className="whitespace-nowrap font-medium text-slate-900">{titulo}</p>
      {children}
    </div>
  )
}

/**
 * Ajustes del perfil propio. Solo el nombre se puede cambiar: el correo lo
 * administra el super administrador y el rol no lo cambia la propia persona.
 */
export function AjustesPerfil({ correo, onCerrar }: { correo: string; onCerrar: () => void }) {
  const perfil = usePerfil()
  const queryClient = useQueryClient()
  const [nombre, setNombre] = useState(perfil.nombre)
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const limpio = nombre.trim()
  const cambio = limpio !== perfil.nombre
  const valido = limpio.length >= 2

  async function guardar() {
    if (!cambio || !valido || guardando) return
    setGuardando(true)
    setError('')
    try {
      await llamarUsuarios({ accion: 'mi_nombre', nombre: limpio })
      await queryClient.invalidateQueries({ queryKey: ['mi-perfil'] })
      void avisoGuardado()
      onCerrar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No fue posible guardar el nombre.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Modal
      titulo="Ajustes"
      ancho="max-w-3xl"
      onCancelar={onCerrar}
      onAceptar={() => void guardar()}
      aceptarDeshabilitado={!cambio || !valido || guardando}
      textoAceptar={guardando ? 'Guardando…' : 'Guardar'}
      aviso={error || undefined}
    >
      <div className="flex items-center gap-4 pb-5">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xl font-medium text-indigo-400">
          {iniciales(perfil.nombre)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-slate-900">{perfil.nombre}</p>
          <p className="truncate text-sm text-slate-500">{correo}</p>
          <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-700">
            {nombreRol(perfil.rol)}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100 border-t border-slate-100">
        <Fila titulo="Nombre completo">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value.slice(0, 80))}
            className={`${campo} border-slate-200 bg-white focus:border-[#1d293d] focus:outline-none`}
          />
        </Fila>
        <Fila titulo="Correo electrónico">
          <input value={correo} disabled readOnly className={`${campo} cursor-not-allowed border-transparent bg-slate-50 text-slate-500`} />
        </Fila>
        <Fila titulo="Rol">
          <input value={nombreRol(perfil.rol)} disabled readOnly className={`${campo} cursor-not-allowed border-transparent bg-slate-50 text-slate-500`} />
        </Fila>
      </div>
    </Modal>
  )
}
