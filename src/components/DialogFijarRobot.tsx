import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { publicarConfigRobot } from '../lib/storage'
import type { Project } from '../types/config'

interface DialogFijarRobotProps {
  proyecto: Project
  onCerrar: () => void
}

/** Diálogos "Fijar proyecto a robot" + confirmación del mockup */
export function DialogFijarRobot({ proyecto, onCerrar }: DialogFijarRobotProps) {
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  const fijar = useMutation({
    mutationFn: async () => {
      const serialLimpio = serial.trim()

      // 1. Asignar el robot a este proyecto
      const { error: errorRobot } = await supabase
        .from('robots')
        .upsert({ serial: serialLimpio, project_id: proyecto.id })
      if (errorRobot) throw errorRobot

      // 2. Publicar el JSON que el robot descargará al reiniciar
      await publicarConfigRobot(serialLimpio, proyecto.config)

      // 3. Marcar este proyecto como activo (y desmarcar los demás)
      await supabase.from('projects').update({ activo: false }).neq('id', proyecto.id)
      await supabase.from('projects').update({ activo: true }).eq('id', proyecto.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onCerrar()
    },
    onError: (e) => {
      console.error(e)
      setError('No se pudo fijar el proyecto. Revisa que el bucket "configs" exista y sea público.')
    },
  })

  return (
    <Modal
      titulo="Fijar proyecto a robot"
      onCancelar={onCerrar}
      onAceptar={() => fijar.mutate()}
      aceptarDeshabilitado={serial.trim().length < 4 || fijar.isPending}
      textoAceptar={fijar.isPending ? 'Fijando...' : 'Aceptar'}
    >
      <p className="mb-2 font-medium text-slate-800">ID del robot</p>
      <div className="flex items-center rounded-lg border border-slate-300 px-4 py-3">
        <span className="mr-2 text-slate-400">#</span>
        <input
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          placeholder="Ej: 0016004060"
          className="w-full focus:outline-none"
        />
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-slate-700">
        <span className="text-indigo-600">ⓘ</span>
        <p>
          Al fijar este proyecto, la configuración de este se sincronizará automáticamente con la
          aplicación instalada en el robot en el próximo reinicio.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
