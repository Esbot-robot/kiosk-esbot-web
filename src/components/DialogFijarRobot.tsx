import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { eliminarConfigRobot, publicarConfigRobot } from '../lib/storage'
import type { Project } from '../types/config'

interface DialogFijarRobotProps {
  proyecto: Project
  onCerrar: () => void
}

/** Fija el proyecto a uno o varios robots por su serial (cada robot, un proyecto) */
export function DialogFijarRobot({ proyecto, onCerrar }: DialogFijarRobotProps) {
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()

  // Robots que ya tienen fijado ESTE proyecto
  const { data: robotsFijados } = useQuery({
    queryKey: ['robots-proyecto', proyecto.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('robots')
        .select('serial')
        .eq('project_id', proyecto.id)
        .order('serial')
      if (error) throw error
      return (data as { serial: string }[]).map((r) => r.serial)
    },
  })

  function invalidar() {
    queryClient.invalidateQueries({ queryKey: ['robots-proyecto', proyecto.id] })
    queryClient.invalidateQueries({ queryKey: ['robots'] })
    queryClient.invalidateQueries({ queryKey: ['projects'] })
  }

  const fijar = useMutation({
    mutationFn: async () => {
      const s = serial.trim()

      // ¿Ya está tomado por OTRO proyecto?
      const { data: existente } = await supabase
        .from('robots')
        .select('serial, project_id')
        .eq('serial', s)
        .maybeSingle()

      if (existente && existente.project_id !== proyecto.id) {
        const { data: dueno } = await supabase
          .from('projects')
          .select('nombre')
          .eq('id', existente.project_id)
          .maybeSingle()
        throw new Error(
          `Ese robot ya está fijado al proyecto "${dueno?.nombre ?? 'otro'}". Quítalo de allá primero.`
        )
      }

      // Asignar y publicar el JSON que el robot descargará
      const { error: e1 } = await supabase
        .from('robots')
        .upsert({ serial: s, project_id: proyecto.id })
      if (e1) throw e1
      await publicarConfigRobot(s, proyecto.config)
    },
    onSuccess: () => {
      setSerial('')
      setError('')
      invalidar()
    },
    onError: (e) => setError(e instanceof Error ? e.message : 'No se pudo fijar el proyecto.'),
  })

  const quitar = useMutation({
    mutationFn: async (s: string) => {
      const { error } = await supabase.from('robots').delete().eq('serial', s)
      if (error) throw error
      await eliminarConfigRobot(s)
    },
    onSuccess: invalidar,
  })

  return (
    <Modal
      titulo="Fijar proyecto a robot"
      onCancelar={onCerrar}
      onAceptar={onCerrar}
      textoAceptar="Listo"
    >
      {/* Robots ya fijados a este proyecto */}
      {(robotsFijados?.length ?? 0) > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Fijado actualmente a {robotsFijados!.length === 1 ? 'el robot' : 'los robots'}:
          </p>
          <div className="flex flex-wrap gap-2">
            {robotsFijados!.map((s) => (
              <span
                key={s}
                className="flex items-center gap-2 rounded-full bg-indigo-50 py-1.5 pl-4 pr-2 text-sm font-medium text-indigo-700"
              >
                # {s}
                <button
                  onClick={() => quitar.mutate(s)}
                  disabled={quitar.isPending}
                  title="Quitar de este robot"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-indigo-400 transition-colors hover:bg-indigo-200 hover:text-indigo-800"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mb-2 font-medium text-slate-800">Agregar robot (ID del robot)</p>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center rounded-lg border border-slate-300 px-4 py-3">
          <span className="mr-2 text-slate-400">#</span>
          <input
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && serial.trim().length >= 4) fijar.mutate()
            }}
            placeholder="Ej: 0016004060"
            className="w-full focus:outline-none"
          />
        </div>
        <button
          onClick={() => fijar.mutate()}
          disabled={serial.trim().length < 4 || fijar.isPending}
          className="rounded-lg bg-indigo-600 px-6 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {fijar.isPending ? 'Fijando...' : 'Fijar'}
        </button>
      </div>

      <div className="mt-6 flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-slate-700">
        <span className="text-indigo-600">ⓘ</span>
        <p>
          Cada robot puede tener un solo proyecto. Al fijarlo, la configuración se sincroniza con la
          app del robot en su próximo reinicio.
        </p>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
