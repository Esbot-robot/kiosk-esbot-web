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

/** ¿El robot quedó vinculado después de generar este código? (con 5 s de margen entre relojes) */
function quedoVinculado(vinculo: Vinculo | undefined, creado: number): boolean {
  return !!vinculo?.vinculado && !!vinculo.vinculado_at && new Date(vinculo.vinculado_at).getTime() >= creado - 5_000
}

/** Línea de la tarjeta del robot: estado del vínculo y sus acciones */
export function FilaVinculo({ serial, enServicio }: { serial: string; enServicio: boolean }) {
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

  const quitar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('quitar_robot_sin_vincular', { p_serial: serial })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vinculos-robots'] })
      void queryClient.invalidateQueries({ queryKey: ['robot-status'] })
      void avisoGuardado('Robot quitado del panel')
    },
    onError: (e) => void avisoError('No se pudo quitar el robot', describirError(e)),
  })

  if (!vinculo) return null

  async function pedirQuitar() {
    const ok = await avisoConfirmar(
      '¿Quitar este robot del panel?',
      'Se borra su ficha. Si el robot vuelve a conectarse con la app anterior, aparecerá de nuevo.'
    )
    if (ok) quitar.mutate()
  }

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
        {!vinculo.vinculado && !enServicio && (
          <button type="button" onClick={() => void pedirQuitar()} disabled={quitar.isPending} className="text-slate-400 hover:text-red-600 hover:underline disabled:opacity-50">
            Quitar
          </button>
        )}
      </p>

      {codigo && (
        <DialogCodigo
          codigo={codigo.texto}
          creado={codigo.creado}
          vinculado={quedoVinculado(vinculo, codigo.creado)}
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

/** Alta manual: un administrador escribe el serial de un robot nuevo y obtiene su código de vinculación */
export function BotonAgregarRobot() {
  const queryClient = useQueryClient()
  const { data: vinculos } = useVinculos()
  const [abierto, setAbierto] = useState(false)
  const [serial, setSerial] = useState('')
  const [error, setError] = useState('')
  const [codigo, setCodigo] = useState<{ serial: string; texto: string; creado: number } | null>(null)

  const serialLimpio = serial.trim()
  const valido = /^[A-Za-z0-9]{11}$/.test(serialLimpio)

  const generar = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('crear_codigo_vinculacion', { p_serial: serialLimpio })
      if (error) throw error
      return data as string
    },
    onSuccess: (texto) => {
      setCodigo({ serial: serialLimpio, texto, creado: Date.now() })
      setAbierto(false)
      setSerial('')
      setError('')
      void queryClient.invalidateQueries({ queryKey: ['vinculos-robots'] })
      void queryClient.invalidateQueries({ queryKey: ['robot-status'] })
    },
    onError: (e) => setError(describirError(e)),
  })

  // Sin las funciones de la base (SQL sin aplicar) el botón no se muestra
  if (!vinculos) return null

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError('')
          setAbierto(true)
        }}
        className="h-10 bg-[#1d293d] px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Agregar robot
      </button>

      {abierto && (
        <Modal
          titulo="Agregar robot"
          ancho="max-w-lg"
          onCancelar={() => setAbierto(false)}
          onAceptar={() => generar.mutate()}
          aceptarDeshabilitado={!valido || generar.isPending}
          textoAceptar={generar.isPending ? 'Generando…' : 'Generar código'}
          aviso={error || undefined}
        >
          <label className="block">
            <span className="font-medium text-slate-800">Número de serie del robot</span>
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 11))}
              placeholder="00125190031"
              inputMode="numeric"
              autoFocus
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2.5 font-mono tracking-wider focus:border-[#1d293d] focus:outline-none"
            />
          </label>
          <p className="mt-3 text-sm text-slate-500">
            Son 11 caracteres. Es el número que aparece junto al símbolo # en la ficha de cada robot. Al continuar se crea la ficha
            del robot y se genera el código que se escribe en su pantalla de administración.
          </p>
        </Modal>
      )}

      {codigo && (
        <DialogCodigo
          codigo={codigo.texto}
          creado={codigo.creado}
          vinculado={quedoVinculado(vinculos.get(codigo.serial), codigo.creado)}
          onCerrar={() => setCodigo(null)}
        />
      )}
    </>
  )
}
