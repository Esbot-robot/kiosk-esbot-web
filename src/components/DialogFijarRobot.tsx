import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { eliminarConfigRobot, publicarConfigRobot } from '../lib/storage'
import { archivosDeConfig, comprobarArchivos } from '../lib/archivosProyecto'
import { useArchivosFaltantes } from '../lib/useArchivosFaltantes'
import { describirError } from '../lib/errores'
import { tipoDe, type Project } from '../types/config'
import { Advertencia } from './Advertencia'

interface DialogFijarRobotProps {
  proyecto: Project
  onCerrar: () => void
}

/** Fija el proyecto a uno o varios robots por su serial (cada robot, un proyecto) */
export function DialogFijarRobot({ proyecto, onCerrar }: DialogFijarRobotProps) {
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')
  const queryClient = useQueryClient()
  // Archivos del proyecto que ya no están en el almacenamiento: si falta alguno, no se fija
  const { faltantes, comprobando } = useArchivosFaltantes(proyecto.config)
  // La app de los robots todavía no tiene el modo Retail (llega en una versión
  // nueva): un robot fijado a un proyecto Retail mostraría una pantalla de evento vacía
  const retailSinSoporte = tipoDe(proyecto.config) === 'retail'

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

  const LARGO_SERIAL = 11
  const serialValido = serial.trim().length === LARGO_SERIAL

  const fijar = useMutation({
    mutationFn: async () => {
      const s = serial.trim()

      // Comprobación fresca justo antes de fijar (la de la pantalla puede tener unos minutos)
      const revision = await comprobarArchivos(archivosDeConfig(proyecto.config))
      const sinArchivo = revision.filter((a) => a.estado === 'falta')
      if (sinArchivo.length > 0) {
        throw new Error(
          `Faltan archivos del proyecto en el almacenamiento: ${sinArchivo.map((a) => a.nombre).join(', ')}. ` +
            'Súbalos de nuevo en el editor y guarde el proyecto antes de fijar el robot.'
        )
      }

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
          `Este robot ya está asignado al proyecto «${dueno?.nombre ?? 'otro'}». Retírelo de ese proyecto antes de continuar.`
        )
      }

      // Asignar y publicar el JSON que el robot descargará
      const { error: e1 } = await supabase
        .from('robots')
        .upsert({ serial: s, project_id: proyecto.id })
      if (e1) throw e1
      await publicarConfigRobot(s, proyecto.config, proyecto.registro_token, proyecto.id)
    },
    onSuccess: () => {
      setSerial('')
      setError('')
      invalidar()
    },
    onError: (e) => setError(`No se pudo fijar el proyecto. ${describirError(e)}`),
  })

  const quitar = useMutation({
    mutationFn: async (s: string) => {
      const { error } = await supabase.from('robots').delete().eq('serial', s)
      if (error) throw error
      await eliminarConfigRobot(s)
    },
    onSuccess: invalidar,
    onError: (e) => setError(`No se pudo quitar el robot. ${describirError(e)}`),
  })

  return (
    <Modal
      titulo="Fijar proyecto a robot"
      onCancelar={onCerrar}
      onAceptar={onCerrar}
      textoAceptar="Aceptar"
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
              if (e.key === 'Enter' && serialValido) fijar.mutate()
            }}
            placeholder="Ej: 00125190031"
            className="w-full focus:outline-none"
          />
        </div>
        <button
          onClick={() => fijar.mutate()}
          disabled={!serialValido || fijar.isPending || comprobando || faltantes.length > 0 || retailSinSoporte}
          className="rounded-lg bg-indigo-600 px-6 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {fijar.isPending ? 'Fijando...' : comprobando ? 'Comprobando...' : 'Fijar'}
        </button>
      </div>
      {serial.trim().length > 0 && !serialValido && (
        <Advertencia className="mt-2">
          El ID del robot debe tener {LARGO_SERIAL} caracteres (se ingresaron {serial.trim().length}).
        </Advertencia>
      )}

      {retailSinSoporte && (
        <Advertencia className="mt-4">
          Los proyectos Retail todavía no se pueden fijar a un robot: la app de los robots aún no tiene el modo Retail.
        </Advertencia>
      )}
      {faltantes.length > 0 && (
        <div className="mt-4">
          <Advertencia>
            Este proyecto usa archivos que ya no están en el almacenamiento, así que todavía no se puede fijar a un robot:
          </Advertencia>
          <ul className="mt-1 list-disc pl-10 text-sm text-slate-700">
            {faltantes.map((a, i) => (
              <li key={`${a.url}-${i}`}>{a.nombre}</li>
            ))}
          </ul>
          <p className="mt-1 pl-6 text-sm text-slate-500">Súbalos de nuevo en el editor, guarde el proyecto y vuelva aquí.</p>
        </div>
      )}
      {!proyecto.config.pantalla_inicial.video_patrullaje_url && (
        <Advertencia className="mt-3">
          Este proyecto no tiene video de patrullaje: el robot mostrará la pantalla sin video.
        </Advertencia>
      )}

      <div className="mt-6 flex gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-slate-700">
        <span className="text-indigo-600">ⓘ</span>
        <p>
          Cada robot puede tener un solo proyecto. Al fijarlo, la configuración se sincroniza con la
          app del robot en su próximo reinicio.
        </p>
      </div>

      {error && <Advertencia className="mt-3">{error}</Advertencia>}
    </Modal>
  )
}
