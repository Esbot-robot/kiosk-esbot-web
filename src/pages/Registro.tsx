import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { colorTextoSobre } from '../lib/colores'
import { Cargando } from '../components/Cargando'
import { COLOR_FORMULARIO_DEFECTO, TEXTO_AUTORIZACION_DEFECTO, type FormularioRegistro } from '../types/config'

/**
 * Formulario de registro que abre el QR del robot, en el celular del visitante.
 *
 * Público, como la galería: la clave va después del # y no viaja al hosting.
 *   #f.<id de la foto>               -> viene de la pantalla de la foto
 *   #r.<token del proyecto>.<sesión> -> viene del botón de registro
 * Al enviar, el robot (que está preguntando por esa sesión) se despide con el
 * nombre; si venía de la foto, aquí mismo se descarga.
 */

interface InfoFormulario {
  origen: 'foto' | 'registro'
  formulario: Partial<FormularioRegistro>
  foto_id?: string
  foto_numero?: number
  foto_estado?: string
}

/** cada cuánto se revisa si la foto ya terminó de subir */
const REVISION_FOTO_MS = 4000
/** pasado este tiempo sin foto, se le dice al visitante que vaya al stand */
const ESPERA_FOTO_MS = 120_000

const CORREO = /^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$/

function urlFoto(id: string): string {
  return supabase.storage.from('fotos').getPublicUrl(`${id}.jpg`).data.publicUrl
}

/** La página recuerda que ya se envió, por si el visitante la recarga */
function leerEnviado(clave: string): string | null {
  try {
    return sessionStorage.getItem(`registro:${clave}`)
  } catch {
    return null
  }
}
function guardarEnviado(clave: string, nombre: string) {
  try {
    sessionStorage.setItem(`registro:${clave}`, nombre)
  } catch {
    // sin almacenamiento (modo privado): solo se pierde el recuerdo al recargar
  }
}

export function Registro() {
  const [clave] = useState(() => window.location.hash.replace('#', '').trim())
  const [enviadoComo, setEnviadoComo] = useState<string | null>(() => leerEnviado(clave))

  const { data: info, status, refetch } = useQuery({
    queryKey: ['formulario', clave],
    enabled: clave.length > 0,
    retry: 2,
    queryFn: async (): Promise<InfoFormulario | null> => {
      const { data, error } = await supabase.rpc('formulario_info', { p_clave: clave })
      if (error) throw error
      return (data as InfoFormulario | null) ?? null
    },
    // Después de enviar, en la foto, se sigue preguntando hasta que esté lista
    refetchInterval: (q) =>
      enviadoComo !== null && q.state.data?.origen === 'foto' && q.state.data.foto_estado !== 'lista'
        ? REVISION_FOTO_MS
        : false,
  })

  const form = info?.formulario ?? {}
  const color = /^#[0-9a-fA-F]{6}$/.test(form.color ?? '') ? form.color! : COLOR_FORMULARIO_DEFECTO

  // Por estado y no por isLoading: con la pestaña en segundo plano la
  // librería pausa los reintentos, y eso no es "enlace no disponible"
  let contenido
  if (!clave || (status === 'success' && !info)) {
    contenido = <Aviso titulo="Este enlace ya no está disponible" texto="Escanea de nuevo el código en el robot." />
  } else if (status === 'pending') {
    contenido = <Cargando texto="Cargando formulario…" />
  } else if (status === 'error' || !info) {
    contenido = (
      <div className="text-center">
        <Aviso titulo="Sin conexión" texto="Revisa tu internet e intenta de nuevo." />
        <button
          onClick={() => void refetch()}
          className="mt-4 rounded-full px-8 py-3 text-sm font-semibold uppercase"
          style={{ backgroundColor: color, color: colorTextoSobre(color) }}
        >
          Reintentar
        </button>
      </div>
    )
  } else if (enviadoComo !== null) {
    contenido = <Exito info={info} nombre={enviadoComo} color={color} />
  } else {
    contenido = (
      <Formulario
        clave={clave}
        form={form}
        color={color}
        fotoNumero={info.foto_numero}
        onEnviado={(nombre) => {
          guardarEnviado(clave, nombre)
          setEnviadoComo(nombre)
        }}
      />
    )
  }

  return (
    <div className="min-h-dvh bg-slate-100 px-4 py-6">
      <main className="mx-auto w-full max-w-sm rounded-2xl bg-white px-5 py-7 shadow-sm">{contenido}</main>
    </div>
  )
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="py-8 text-center">
      <p className="text-lg font-bold text-slate-800">{titulo}</p>
      <p className="mt-2 text-sm text-slate-500">{texto}</p>
    </div>
  )
}

function Formulario({
  clave,
  form,
  color,
  fotoNumero,
  onEnviado,
}: {
  clave: string
  form: Partial<FormularioRegistro>
  color: string
  fotoNumero?: number
  onEnviado: (nombre: string) => void
}) {
  const [nombre, setNombre] = useState('')
  const [correo, setCorreo] = useState('')
  const [celular, setCelular] = useState('')
  const [autoriza, setAutoriza] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorEnvio, setErrorEnvio] = useState('')
  const [enviando, setEnviando] = useState(false)

  function validar(): Record<string, string> {
    const e: Record<string, string> = {}
    if (nombre.trim().length < 2) e.nombre = 'Escribe tu nombre.'
    if (!CORREO.test(correo.trim())) e.correo = 'Revisa el correo.'
    if (!/^3\d{9}$/.test(celular)) e.celular = 'Debe tener 10 dígitos y empezar por 3.'
    if (!autoriza) e.autoriza = 'Debes aceptar para continuar.'
    return e
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    if (enviando) return
    const encontrados = validar()
    setErrores(encontrados)
    setErrorEnvio('')
    if (Object.keys(encontrados).length > 0) return

    setEnviando(true)
    try {
      const { data, error } = await supabase.rpc('registrar_contacto', {
        p_clave: clave,
        p_nombre: nombre,
        p_correo: correo,
        p_celular: celular,
        p_autoriza: autoriza,
      })
      if (error) throw error
      const respuesta = data as { ok: boolean; error?: string }
      if (!respuesta.ok) {
        setErrorEnvio(respuesta.error ?? 'No se pudo enviar. Intenta de nuevo.')
        return
      }
      onEnviado(nombre.trim().split(/\s+/)[0])
    } catch {
      // Los datos escritos se quedan: basta con volver a tocar Enviar
      setErrorEnvio('Sin conexión. Revisa tu internet e intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const limpiarError = (campo: string) => setErrores((actual) => ({ ...actual, [campo]: '' }))

  return (
    <form onSubmit={(e) => void enviar(e)} noValidate>
      <h1 className="text-center text-xl font-bold uppercase tracking-wide text-slate-800">
        {form.titulo || 'Regístrate'}
      </h1>
      {form.subtitulo && <p className="mt-2 text-center text-sm leading-relaxed text-slate-500">{form.subtitulo}</p>}
      {fotoNumero !== undefined && (
        <p className="mt-2 text-center text-sm font-semibold" style={{ color }}>
          Foto #{fotoNumero}
        </p>
      )}

      <div className="mt-6 space-y-4">
        <Campo
          id="nombre"
          label="Nombre"
          color={color}
          valor={nombre}
          error={errores.nombre}
          placeholder="Escribe tu nombre"
          autoComplete="name"
          onChange={(v) => {
            setNombre(v.slice(0, 60))
            limpiarError('nombre')
          }}
        />
        <Campo
          id="correo"
          label="Correo"
          tipo="email"
          color={color}
          valor={correo}
          error={errores.correo}
          placeholder="Escribe tu correo"
          autoComplete="email"
          onChange={(v) => {
            setCorreo(v.slice(0, 120))
            limpiarError('correo')
          }}
        />
        <Campo
          id="celular"
          label="Celular"
          tipo="tel"
          color={color}
          valor={celular}
          error={errores.celular}
          placeholder="Escribe tu número de 10 dígitos"
          autoComplete="tel-national"
          onChange={(v) => {
            setCelular(v.replace(/\D/g, '').slice(0, 10))
            limpiarError('celular')
          }}
        />

        <div>
          <label className="flex items-start gap-3 text-xs leading-relaxed text-slate-500">
            <input
              type="checkbox"
              checked={autoriza}
              onChange={(e) => {
                setAutoriza(e.target.checked)
                limpiarError('autoriza')
              }}
              className="mt-0.5 h-4 w-4 shrink-0"
              style={{ accentColor: color }}
            />
            <span>
              {form.texto_autorizacion || TEXTO_AUTORIZACION_DEFECTO}
              {form.politica_url && (
                <>
                  {' '}
                  <a href={form.politica_url} target="_blank" rel="noopener noreferrer" className="underline" style={{ color }}>
                    Ver política
                  </a>
                </>
              )}
            </span>
          </label>
          {errores.autoriza && <p className="mt-1 pl-7 text-xs text-red-600">{errores.autoriza}</p>}
        </div>
      </div>

      {errorEnvio && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">{errorEnvio}</p>}

      <button
        type="submit"
        disabled={enviando}
        className="mt-6 w-full rounded-full py-3.5 text-sm font-semibold uppercase tracking-wide transition-opacity disabled:opacity-60"
        style={{
          backgroundImage: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, black))`,
          color: colorTextoSobre(color),
        }}
      >
        {enviando ? 'Enviando…' : 'Enviar'}
      </button>
    </form>
  )
}

function Campo({
  id,
  label,
  tipo = 'text',
  color,
  valor,
  error,
  placeholder,
  autoComplete,
  onChange,
}: {
  id: string
  label: string
  tipo?: 'text' | 'email' | 'tel'
  color: string
  valor: string
  error?: string
  placeholder: string
  autoComplete: string
  onChange: (valor: string) => void
}) {
  const [enfocado, setEnfocado] = useState(false)
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium" style={{ color }}>
        {label}
      </label>
      <input
        id={id}
        type={tipo}
        inputMode={tipo === 'tel' ? 'numeric' : undefined}
        value={valor}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        aria-invalid={Boolean(error)}
        className="w-full rounded-full border bg-white px-5 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:outline-none"
        style={{ borderColor: error ? '#dc2626' : enfocado ? color : '#d1d5db' }}
      />
      {error && <p className="mt-1 pl-5 text-xs text-red-600">{error}</p>}
    </div>
  )
}

function Exito({ info, nombre, color }: { info: InfoFormulario; nombre: string; color: string }) {
  const [inicio] = useState(() => Date.now())
  const [tarda, setTarda] = useState(false)
  const lista = info.origen === 'foto' && info.foto_estado === 'lista' && info.foto_id

  useEffect(() => {
    if (info.origen !== 'foto' || lista) return
    const t = setTimeout(() => setTarda(true), Math.max(0, ESPERA_FOTO_MS - (Date.now() - inicio)))
    return () => clearTimeout(t)
  }, [info.origen, lista, inicio])

  return (
    <div className="text-center">
      <div
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: color, color: colorTextoSobre(color) }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M5 12l5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-4 text-xl font-bold text-slate-800">¡Gracias, {nombre}!</h1>

      {info.origen === 'registro' && <p className="mt-2 text-sm text-slate-500">Tus datos quedaron registrados.</p>}

      {info.origen === 'foto' &&
        (lista ? (
          <DescargaFoto id={info.foto_id!} numero={info.foto_numero} color={color} />
        ) : tarda ? (
          <p className="mt-4 text-sm text-slate-500">
            Tu foto está tardando. Acércate al stand con el número <b>#{info.foto_numero}</b>.
          </p>
        ) : (
          <>
            <Cargando texto="Preparando tu foto…" className="py-6" />
            <p className="text-sm text-slate-500">Tu foto se está preparando…</p>
          </>
        ))}
    </div>
  )
}

function DescargaFoto({ id, numero, color }: { id: string; numero?: number; color: string }) {
  const url = urlFoto(id)
  const [error, setError] = useState('')

  /** Se descarga como archivo; si el navegador no lo permite, se abre la foto */
  async function descargar() {
    setError('')
    try {
      const respuesta = await fetch(url)
      if (!respuesta.ok) throw new Error(String(respuesta.status))
      const blob = await respuesta.blob()
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      enlace.download = `foto-${numero ?? id}.jpg`
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10_000)
    } catch {
      setError('No se pudo descargar. Mantén presionada la foto para guardarla.')
    }
  }

  return (
    <div className="mt-4">
      <img src={url} alt={`Tu foto #${numero ?? ''}`} className="w-full rounded-xl border border-slate-200" />
      <button
        onClick={() => void descargar()}
        className="mt-4 w-full rounded-full py-3.5 text-sm font-semibold uppercase tracking-wide"
        style={{
          backgroundImage: `linear-gradient(90deg, ${color}, color-mix(in srgb, ${color} 70%, black))`,
          color: colorTextoSobre(color),
        }}
      >
        Descargar foto
      </button>
      <p className="mt-3 text-xs text-slate-400">
        {error || 'Si no se descarga, mantén presionada la foto para guardarla.'}
      </p>
    </div>
  )
}
