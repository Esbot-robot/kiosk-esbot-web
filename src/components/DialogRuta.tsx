import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from './Modal'
import { supabase } from '../lib/supabase'
import { describirError } from '../lib/errores'

interface DialogRutaProps {
  serial: string
  nombre: string
  /** lo que el robot reportó de su mapa; null si su app aún no lo envía */
  ubicacionesMapa: string[] | null
  rutaActual: string[]
  enServicio: boolean
  onCerrar: () => void
}

/**
 * Ruta de patrullaje de un robot. Solo se puede elegir de las ubicaciones que
 * el robot reportó de su mapa, así nadie escribe mal un nombre. Una ubicación
 * se puede repetir (ej. stand → entrada → stand → salida), igual que en el
 * admin del robot. Viaja por el latido (supabase/ruta_panel.sql).
 */
export function DialogRuta({ serial, nombre, ubicacionesMapa, rutaActual, enServicio, onCerrar }: DialogRutaProps) {
  const queryClient = useQueryClient()
  const [ruta, setRuta] = useState<string[]>(rutaActual)
  const mapa = ubicacionesMapa ?? []
  const enMapa = new Set(mapa)

  const guardar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('fijar_ruta', { p_serial: serial, p_ruta: ruta })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['robot-status'] })
      onCerrar()
    },
  })

  function mover(i: number, paso: -1 | 1) {
    setRuta((actual) => {
      const j = i + paso
      if (j < 0 || j >= actual.length) return actual
      const copia = [...actual]
      ;[copia[i], copia[j]] = [copia[j], copia[i]]
      return copia
    })
  }

  return (
    <Modal
      titulo={`Ruta de ${nombre}`}
      ayuda="El robot recorre estas ubicaciones en orden y vuelve a empezar. También se puede cambiar desde el admin del robot: los dos lados ven el último cambio guardado."
      onCancelar={onCerrar}
      onAceptar={() => guardar.mutate()}
      aceptarDeshabilitado={ruta.length === 0 || guardar.isPending}
      textoAceptar={guardar.isPending ? 'Guardando...' : 'Guardar ruta'}
    >
      <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
        {/* Ruta elegida, en orden */}
        <div>
          <p className="mb-2 font-medium text-slate-800">Recorrido (en orden)</p>
          {ruta.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
              Agrega al menos una ubicación desde la lista de abajo.
            </p>
          ) : (
            <ol className="space-y-2">
              {ruta.map((ubicacion, i) => (
                <li
                  key={`${ubicacion}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-slate-800">{ubicacion}</span>
                    {!enMapa.has(ubicacion) && mapa.length > 0 && (
                      <span className="text-xs font-medium text-amber-700">Ya no existe en el mapa del robot</span>
                    )}
                  </span>
                  <BotonIcono titulo="Subir" disabled={i === 0} onClick={() => mover(i, -1)}>
                    ↑
                  </BotonIcono>
                  <BotonIcono titulo="Bajar" disabled={i === ruta.length - 1} onClick={() => mover(i, 1)}>
                    ↓
                  </BotonIcono>
                  <BotonIcono titulo="Quitar" onClick={() => setRuta((actual) => actual.filter((_, k) => k !== i))}>
                    ✕
                  </BotonIcono>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* Ubicaciones disponibles en el mapa del robot */}
        <div>
          <p className="mb-2 font-medium text-slate-800">Ubicaciones del mapa</p>
          {mapa.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Este robot todavía no ha enviado las ubicaciones de su mapa. Abre en el robot la app Kiosk
              Esbot actualizada y espera unos segundos.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {mapa.map((ubicacion) => (
                <button
                  key={ubicacion}
                  type="button"
                  onClick={() => setRuta((actual) => [...actual, ubicacion])}
                  className="rounded-full border border-indigo-300 px-3 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-indigo-50"
                >
                  + {ubicacion}
                </button>
              ))}
            </div>
          )}
        </div>

        {!enServicio && (
          <p className="text-sm text-amber-700">
            Este robot no está en línea: la ruta se aplicará cuando vuelva a conectarse.
          </p>
        )}
        {guardar.error && (
          <p className="text-sm font-medium text-rose-600">No se pudo guardar la ruta. {describirError(guardar.error)}</p>
        )}
      </div>
    </Modal>
  )
}

function BotonIcono({
  titulo,
  disabled,
  onClick,
  children,
}: {
  titulo: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  )
}
