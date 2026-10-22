import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { subirArchivo, type ProgresoSubida } from '../lib/storage'
import { tamanoLegible } from '../lib/media'
import { avisoConfirmar, avisoError, avisoGuardado } from '../lib/alertas'
import { describirError } from '../lib/errores'
import { usePerfil } from '../lib/perfil'
import { Modal } from './Modal'
import { BarraSubida } from './BarraSubida'

/** el plan gratuito de Supabase Storage no admite archivos de más de 50 MB */
const MAX_APK_BYTES = 50 * 1024 * 1024

export interface VersionApp {
  version_code: number
  version_name: string
  tamano_bytes: number
  notas: string | null
  subida_por: string | null
  creado_at: string
}

/**
 * Versiones de la app subidas al panel, de la más nueva a la más antigua.
 * Si la base todavía no tiene la tabla (SQL sin aplicar), devuelve undefined y
 * lo que depende de ella no se muestra.
 */
function useVersionesApp() {
  return useQuery({
    queryKey: ['app-versiones'],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_versiones')
        .select('version_code, version_name, tamano_bytes, notas, subida_por, creado_at')
        .order('version_code', { ascending: false })
      if (error) throw error
      return data as VersionApp[]
    },
  })
}

/** Huella SHA-256 del archivo, en hexadecimal: con ella el robot comprueba que la APK no cambió */
async function huellaSha256(archivo: File): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', await archivo.arrayBuffer())
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/* ───────────── Línea de la tarjeta del robot: versión instalada y actualización ───────────── */

export function FilaAppRobot({
  serial,
  nombre,
  versionCode,
  versionName,
  estado,
  enServicio,
}: {
  serial: string
  nombre: string
  versionCode: number | null | undefined
  versionName: string | null | undefined
  /** estado de la actualización en curso que reporta el robot */
  estado: string | null | undefined
  enServicio: boolean
}) {
  const { data: versiones } = useVersionesApp()
  const esSuper = usePerfil().rol === 'superadmin'
  const [abierto, setAbierto] = useState(false)

  const instalada = versionCode ?? null
  // Sin la tabla de versiones y sin versión reportada no hay nada que mostrar
  if (!versiones && instalada === null) return null

  const ultima = versiones?.[0]
  const hayNueva = !!ultima && instalada !== null && ultima.version_code > instalada
  const color = instalada === null ? '#c3c2b7' : hayNueva ? '#e5a100' : '#1baf7a'

  return (
    <>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        <span className="text-slate-700">
          {instalada === null ? 'App sin versión reportada' : `App ${versionName || `código ${instalada}`}`}
        </span>
        {hayNueva && <span className="text-amber-700">· Disponible {ultima.version_name}</span>}
        {esSuper && !!ultima && (
          <button type="button" onClick={() => setAbierto(true)} className="font-semibold text-[#1d293d] hover:underline">
            Actualizar app
          </button>
        )}
      </p>
      {estado && <p className="pl-4 text-xs text-slate-500">{estado}</p>}

      {abierto && versiones && (
        <DialogActualizarApp
          serial={serial}
          nombre={nombre}
          instalada={instalada}
          versiones={versiones}
          enServicio={enServicio}
          onCerrar={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function DialogActualizarApp({
  serial,
  nombre,
  instalada,
  versiones,
  enServicio,
  onCerrar,
}: {
  serial: string
  nombre: string
  instalada: number | null
  versiones: VersionApp[]
  enServicio: boolean
  onCerrar: () => void
}) {
  const queryClient = useQueryClient()
  // Android no permite instalar una versión menor encima de una mayor
  const candidatas = versiones.filter((v) => v.version_code > (instalada ?? 0))
  const [codigo, setCodigo] = useState<number | null>(candidatas[0]?.version_code ?? null)

  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('enviar_comando', { p_serial: serial, p_comando: `actualizar_app:${codigo}` })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['robot-status'] })
      void avisoGuardado('Orden de actualización enviada')
      onCerrar()
    },
    onError: (e) => void avisoError('No se pudo enviar la orden', describirError(e)),
  })

  return (
    <Modal
      titulo="Actualizar la app del robot"
      ancho="max-w-lg"
      onCancelar={onCerrar}
      onAceptar={() => enviar.mutate()}
      aceptarDeshabilitado={codigo === null || enviar.isPending}
      textoAceptar={enviar.isPending ? 'Enviando…' : 'Enviar orden'}
    >
      <p className="font-medium text-slate-800">{nombre}</p>
      {candidatas.length === 0 ? (
        <p className="mt-3 text-slate-600">No hay una versión más reciente que la instalada en este robot.</p>
      ) : (
        <>
          <label className="mt-4 block">
            <span className="text-sm text-slate-600">Versión a instalar</span>
            <select
              value={codigo ?? ''}
              onChange={(e) => setCodigo(Number(e.target.value))}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-[#1d293d] focus:outline-none"
            >
              {candidatas.map((v) => (
                <option key={v.version_code} value={v.version_code}>
                  {v.version_name} ({tamanoLegible(v.tamano_bytes)})
                </option>
              ))}
            </select>
          </label>
          <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-slate-600">
            <li>El robot descargará la versión y comprobará que el archivo no esté alterado.</li>
            <li>
              Después, Android mostrará en su pantalla la confirmación de instalación: <strong>alguien debe pulsar «Instalar»</strong>.
            </li>
            <li>Conviene hacerlo con una persona junto al robot y nunca durante un evento.</li>
            {!enServicio && <li className="text-amber-700">El robot está desconectado: la orden se ejecutará cuando se conecte.</li>}
          </ul>
        </>
      )}
    </Modal>
  )
}

/* ───────────── Administración de versiones (solo super administrador) ───────────── */

export function BotonVersionesApp() {
  const esSuper = usePerfil().rol === 'superadmin'
  const { data: versiones } = useVersionesApp()
  const [abierto, setAbierto] = useState(false)

  // Sin las tablas de la base (SQL sin aplicar) el botón no se muestra
  if (!esSuper || !versiones) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="h-10 border border-[#1d293d] bg-white px-5 text-sm font-semibold text-[#1d293d] transition-colors hover:bg-slate-100"
      >
        Versiones de la app
      </button>
      {abierto && <DialogVersiones versiones={versiones} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

function DialogVersiones({ versiones, onCerrar }: { versiones: VersionApp[]; onCerrar: () => void }) {
  const queryClient = useQueryClient()
  const [archivo, setArchivo] = useState<File | null>(null)
  const [nombre, setNombre] = useState('')
  const [codigo, setCodigo] = useState('')
  const [notas, setNotas] = useState('')
  const [etapa, setEtapa] = useState<'' | 'huella' | 'subiendo' | 'registrando'>('')
  const [progreso, setProgreso] = useState<ProgresoSubida | null>(null)
  const [error, setError] = useState('')

  const mayorCodigo = versiones[0]?.version_code ?? 0
  const codigoNumero = Number(codigo)
  const formularioValido =
    !!archivo &&
    /^[0-9]+(\.[0-9]+){1,3}$/.test(nombre.trim()) &&
    Number.isInteger(codigoNumero) &&
    codigoNumero > mayorCodigo

  async function subir() {
    if (!archivo || !formularioValido || etapa) return
    setError('')
    if (archivo.size > MAX_APK_BYTES) {
      setError(`La APK pesa ${tamanoLegible(archivo.size)} y el límite es 50 MB. Reduzca su tamaño antes de subirla.`)
      return
    }
    const ruta = `v${codigoNumero}/KioskEsbot_v${nombre.trim()}.apk`
    try {
      setEtapa('huella')
      const sha256 = await huellaSha256(archivo)
      setEtapa('subiendo')
      setProgreso(null)
      await subirArchivo('apks', ruta, archivo, {
        contentType: 'application/vnd.android.package-archive',
        onProgreso: setProgreso,
      })
      setEtapa('registrando')
      const { error: errorRegistro } = await supabase.rpc('registrar_version_app', {
        p_version_code: codigoNumero,
        p_version_name: nombre.trim(),
        p_apk_path: ruta,
        p_sha256: sha256,
        p_tamano_bytes: archivo.size,
        p_notas: notas,
      })
      if (errorRegistro) {
        // No queda un archivo suelto sin versión
        await supabase.storage.from('apks').remove([ruta])
        throw errorRegistro
      }
      await queryClient.invalidateQueries({ queryKey: ['app-versiones'] })
      void avisoGuardado('Versión subida')
      setArchivo(null)
      setNombre('')
      setCodigo('')
      setNotas('')
    } catch (e) {
      setError(describirError(e))
    } finally {
      setEtapa('')
      setProgreso(null)
    }
  }

  async function eliminar(v: VersionApp) {
    const ok = await avisoConfirmar(
      `¿Eliminar la versión ${v.version_name}?`,
      'Se borra el archivo del almacenamiento. Los robots que ya la instalaron no se ven afectados.'
    )
    if (!ok) return
    try {
      const { data, error: errorBorrado } = await supabase.rpc('eliminar_version_app', { p_version_code: v.version_code })
      if (errorBorrado) throw errorBorrado
      await supabase.storage.from('apks').remove([data as string])
      await queryClient.invalidateQueries({ queryKey: ['app-versiones'] })
      void avisoGuardado('Versión eliminada')
    } catch (e) {
      void avisoError('No se pudo eliminar la versión', describirError(e))
    }
  }

  const campo = 'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 focus:border-[#1d293d] focus:outline-none'

  return (
    <Modal
      titulo="Versiones de la app"
      ancho="max-w-3xl"
      onCancelar={onCerrar}
      onAceptar={() => void subir()}
      aceptarDeshabilitado={!formularioValido || !!etapa}
      textoAceptar={etapa ? 'Subiendo…' : 'Subir versión'}
      aviso={error || undefined}
    >
      <h4 className="font-semibold text-slate-900">Versiones disponibles</h4>
      {versiones.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">Todavía no hay versiones subidas.</p>
      ) : (
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Versión</th>
                <th className="px-3 py-2 font-medium">Código</th>
                <th className="px-3 py-2 font-medium">Tamaño</th>
                <th className="px-3 py-2 font-medium">Subida</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {versiones.map((v) => (
                <tr key={v.version_code} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2 font-semibold text-slate-800">
                    {v.version_name}
                    {v.notas && <span className="mt-0.5 block text-xs font-normal text-slate-500">{v.notas}</span>}
                  </td>
                  <td className="px-3 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{v.version_code}</td>
                  <td className="px-3 py-2 text-slate-600" style={{ fontVariantNumeric: 'tabular-nums' }}>{tamanoLegible(v.tamano_bytes)}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {new Date(v.creado_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {v.subida_por && <span className="block text-xs text-slate-400">{v.subida_por}</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => void eliminar(v)} className="text-xs font-medium text-slate-400 hover:text-red-600 hover:underline">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {versiones.length >= 3 && (
        <p className="mt-2 text-xs text-amber-700">
          Hay {versiones.length} versiones guardadas. Conviene conservar solo las 3 más recientes para cuidar el espacio de almacenamiento.
        </p>
      )}

      <h4 className="mt-6 font-semibold text-slate-900">Subir una versión nueva</h4>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="text-sm text-slate-600">Archivo de la APK (máximo 50 MB)</span>
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            disabled={!!etapa}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className={`${campo} text-sm file:mr-3 file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm`}
          />
          {archivo && <span className="mt-1 block text-xs text-slate-500">{archivo.name} · {tamanoLegible(archivo.size)}</span>}
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Nombre de la versión</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="1.17" disabled={!!etapa} className={campo} />
        </label>
        <label className="block">
          <span className="text-sm text-slate-600">Código de la versión (mayor que {mayorCodigo || 'cero'})</span>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder={String(mayorCodigo + 1)}
            inputMode="numeric"
            disabled={!!etapa}
            className={campo}
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm text-slate-600">Notas (opcional)</span>
          <input value={notas} onChange={(e) => setNotas(e.target.value.slice(0, 200))} disabled={!!etapa} className={campo} />
        </label>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        El nombre y el código son los de <code>versionName</code> y <code>versionCode</code> de la app. El robot comprueba que el
        archivo descargado coincida con ellos antes de instalarlo.
      </p>

      {etapa === 'huella' && <p className="mt-4 text-sm text-slate-600">Calculando la huella del archivo…</p>}
      {etapa === 'subiendo' && (
        <div className="mt-4">
          <BarraSubida progreso={progreso} />
        </div>
      )}
      {etapa === 'registrando' && <p className="mt-4 text-sm text-slate-600">Registrando la versión…</p>}
    </Modal>
  )
}
