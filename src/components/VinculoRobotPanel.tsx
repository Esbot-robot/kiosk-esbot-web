import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { Modal } from './Modal'

/** el código de vinculación vence a los 15 minutos (igual que en la base) */
const VALIDEZ_CODIGO_MS = 15 * 60 * 1000

interface Vinculo {
  serial: string
  vinculado: boolean
  vinculado_at: string | null
  codigo_vigente: boolean
}

/**
 * Estado del vínculo de cada robot con el panel (ver supabase/token_robot.sql).
 * Si la base todavía no tiene las funciones, devuelve undefined y la fila no se muestra.
 */
function useVinculos() {
  return useQuery({
    queryKey: ['vinculos-robots'],
    refetchInterval: 5_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('listar_vinculos')
      if (error) throw error
      return new Map((data as Vinculo[]).map((v) => [v.serial, v]))
    },
  })
}

function minutosSegundos(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Línea de la tarjeta del robot: estado del vínculo y sus acciones */
export function FilaVinculo({ serial }: { serial: string }) {
  const queryClient = useQueryClient()
  const { data: vinculos } = useVinculos()
  const vinculo = vinculos?.get(serial)
  const [codigo, setCodigo] = useState<{ texto: string; creado: number } | null>(null)

  const generar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('crear_codigo_vinculacion', { p_serial: serial })
      if (error) throw error
      return data as string
    },
    onSuccess: (texto) => {
      setCodigo({ texto, creado: Date.now() })
      void queryClient.invalidateQueries({ queryKey: ['vinculos-robots'] })
    },
    onError: (e) => void avisoError('No se pudo generar el código', describirError(e)),
  })

  const revocar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('revocar_vinculo', { p_serial: serial })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vinculos-robots'] })
      void avisoGuardado('Vínculo revocado')
    },
    onError: (e) => void avisoError('No se pudo revocar el vínculo', describirError(e)),
  })

  if (!vinculo) return null

  async function pedirRevocar() {
    const ok = await avisoConfirmar(
      '¿Revocar el vínculo?',
      'El robot dejará de poder reportar su estado y registrar eventos hasta que se vuelva a vincular con un código nuevo.'
    )
    if (ok) revocar.mutate()
  }

  const botonClase = 'font-semibold text-[#1d293d] hover:underline disabled:opacity-50'

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: vinculo.vinculado ? '#1baf7a' : '#e5a100' }}
        />
        <span className={vinculo.vinculado ? 'text-slate-700' : 'text-slate-500'}>
          {vinculo.vinculado ? 'Vinculado' : 'Sin vincular'}
        </span>
        <button type="button" onClick={() => generar.mutate()} disabled={generar.isPending} className={botonClase}>
          {vinculo.vinculado ? 'Volver a vincular' : 'Vincular'}
        </button>
        {vinculo.vinculado && (
          <button type="button" onClick={() => void pedirRevocar()} disabled={revocar.isPending} className="text-slate-400 hover:text-red-600 hover:underline disabled:opacity-50">
            Revocar
          </button>
        )}
      </p>

      {codigo && (
        <DialogCodigo
          codigo={codigo.texto}
          creado={codigo.creado}
          vinculado={vinculo.vinculado && !!vinculo.vinculado_at && new Date(vinculo.vinculado_at).getTime() >= codigo.creado - 5_000}
          onCerrar={() => setCodigo(null)}
        />
      )}
    </>
  )
}

function DialogCodigo({
  codigo,
  creado,
  vinculado,
  onCerrar,
}: {
  codigo: string
  creado: number
  vinculado: boolean
  onCerrar: () => void
}) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const restante = creado + VALIDEZ_CODIGO_MS - ahora

  return (
    <Modal titulo="Vincular robot" onCancelar={onCerrar} onAceptar={onCerrar} textoAceptar="Listo" ancho="max-w-lg">
      {vinculado ? (
        <p className="py-6 text-center text-lg font-semibold text-emerald-700">El robot quedó vinculado.</p>
      ) : (
        <>
          <p className="text-slate-600">
            En la pantalla de administración del robot, en «Vínculo con el panel», escriba este código:
          </p>
          <p
            className="my-6 select-all text-center font-mono text-4xl font-bold tracking-[0.3em] text-[#1d293d]"
            aria-label="Código de vinculación"
          >
            {codigo}
          </p>
          <p className="text-center text-sm text-slate-500">
            {restante > 0 ? `Vence en ${minutosSegundos(restante)}. Se puede usar una sola vez.` : 'El código venció. Genere uno nuevo.'}
          </p>
          <p className="mt-4 text-center text-xs text-slate-400">Esta ventana se actualiza sola cuando el robot queda vinculado.</p>
        </>
      )}
    </Modal>
  )
}
