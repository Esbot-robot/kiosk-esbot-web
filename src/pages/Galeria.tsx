import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * Galería del evento para el cliente.
 *
 * Es pública a propósito: se entra con el token que va después del # en la
 * dirección, sin iniciar sesión. El token no viaja al servidor del hosting
 * (lo que va después del # se queda en el navegador) y las funciones de
 * Supabase solo devuelven las fotos del proyecto dueño de ese token.
 */

interface FotoGaleria {
  id: string
  numero: number
  estado: string
  entregada: boolean
  creado_at: string
}

const REFRESCO_MS = 5000

function urlFoto(id: string, mini: boolean): string {
  const nombre = mini ? `${id}_mini.jpg` : `${id}.jpg`
  return supabase.storage.from('fotos').getPublicUrl(nombre).data.publicUrl
}

function hora(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

function fecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export function Galeria() {
  // El token vive en el hash. Se lee al cargar y si el usuario lo cambia.
  const [token, setToken] = useState(() => window.location.hash.replace('#', '').trim())
  useEffect(() => {
    const leer = () => setToken(window.location.hash.replace('#', '').trim())
    window.addEventListener('hashchange', leer)
    return () => window.removeEventListener('hashchange', leer)
  }, [])

  const [busqueda, setBusqueda] = useState('')
  const queryClient = useQueryClient()

  const { data: info } = useQuery({
    queryKey: ['galeria-info', token],
    enabled: token.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('galeria_info', { p_token: token })
      if (error) throw error
      return (data as { nombre: string; empresa: string }[])[0] ?? null
    },
  })

  const {
    data: fotos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['galeria-fotos', token],
    enabled: token.length > 0,
    refetchInterval: REFRESCO_MS,
    queryFn: async (): Promise<FotoGaleria[]> => {
      const { data, error } = await supabase.rpc('fotos_de_galeria', { p_token: token })
      if (error) throw error
      return data as FotoGaleria[]
    },
  })

  const entregar = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor: boolean }) => {
      const { error } = await supabase.rpc('marcar_entregada', {
        p_token: token,
        p_id: id,
        p_valor: valor,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['galeria-fotos', token] }),
  })

  const filtradas = (fotos ?? []).filter((f) =>
    busqueda.trim() ? String(f.numero).includes(busqueda.trim().replace('#', '')) : true
  )

  if (!token) {
    return (
      <Centro>
        <p className="text-lg font-semibold text-slate-800">Falta el enlace completo</p>
        <p className="mt-2 text-slate-600">
          Abre la galería con el enlace que te entregaron, que termina en un código después del
          símbolo #.
        </p>
      </Centro>
    )
  }

  if (error) {
    return (
      <Centro>
        <p className="text-lg font-semibold text-slate-800">No pudimos cargar las fotos</p>
        <p className="mt-2 text-slate-600">Revisa tu conexión e intenta de nuevo.</p>
      </Centro>
    )
  }

  if (!isLoading && info === null) {
    return (
      <Centro>
        <p className="text-lg font-semibold text-slate-800">Este enlace no es válido</p>
        <p className="mt-2 text-slate-600">
          Puede que haya sido reemplazado. Pídele a Esbot el enlace actualizado.
        </p>
      </Centro>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Encabezado fijo: el buscador es lo que más se usa en el stand */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">
          Fotos {info?.nombre ? `· ${info.nombre}` : ''}
        </h1>
        <input
          type="search"
          inputMode="numeric"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número, ej. 47"
          className="mt-2 w-full rounded-full border border-slate-300 bg-slate-50 px-5 py-3 text-base focus:border-indigo-400 focus:outline-none"
        />
      </header>

      <main className="px-4 py-4">
        {isLoading && <p className="py-12 text-center text-slate-500">Cargando fotos...</p>}

        {!isLoading && filtradas.length === 0 && (
          <p className="py-12 text-center text-slate-500">
            {busqueda
              ? `Sin resultados para "${busqueda}".`
              : 'Todavía no hay fotos. Aparecerán solas a medida que el robot las tome.'}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {filtradas.map((foto) => (
            <TarjetaFoto
              key={foto.id}
              foto={foto}
              onEntregar={(valor) => entregar.mutate({ id: foto.id, valor })}
            />
          ))}
        </div>
      </main>
    </div>
  )
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-sm text-center">{children}</div>
    </div>
  )
}

function TarjetaFoto({
  foto,
  onEntregar,
}: {
  foto: FotoGaleria
  onEntregar: (valor: boolean) => void
}) {
  // Si la miniatura todavía no existe, se cae a la foto completa
  const [src, setSrc] = useState(() => urlFoto(foto.id, true))
  const [descargando, setDescargando] = useState(false)
  const subiendo = foto.estado !== 'lista'

  async function descargar() {
    setDescargando(true)
    try {
      // Se descarga como archivo (blob) en vez de abrir la imagen: el atributo
      // download no funciona en enlaces a otro dominio, como el de Storage.
      const respuesta = await fetch(urlFoto(foto.id, false))
      if (!respuesta.ok) throw new Error('no disponible')
      const blob = await respuesta.blob()
      const enlace = document.createElement('a')
      enlace.href = URL.createObjectURL(blob)
      enlace.download = `foto-${foto.numero}.jpg`
      enlace.click()
      URL.revokeObjectURL(enlace.href)
    } catch {
      window.open(urlFoto(foto.id, false), '_blank')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white shadow-sm ${
        foto.entregada ? 'border-emerald-300' : 'border-slate-200'
      }`}
    >
      {/* El archivo se guarda vertical y acostado, listo para imprimir.
          Aquí se gira solo para verlo: la caja es horizontal (3:2) y la
          imagen se pone al 150% de alto, que es el ancho de la caja. */}
      <div className="relative flex aspect-[3/2] items-center justify-center overflow-hidden bg-slate-100">
        {subiendo ? (
          <span className="text-sm text-slate-400">Subiendo...</span>
        ) : (
          <img
            src={src}
            alt={`Foto ${foto.numero}`}
            onError={() => setSrc(urlFoto(foto.id, false))}
            className="h-[150%] w-auto max-w-none rotate-90 object-contain"
          />
        )}
        <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-3 py-1 text-sm font-bold text-white">
          #{foto.numero}
        </span>
      </div>

      <div className="p-3">
        <p className="text-xs text-slate-500">
          {fecha(foto.creado_at)} · {hora(foto.creado_at)}
        </p>
        <button
          onClick={() => void descargar()}
          disabled={subiendo || descargando}
          className="mt-2 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40"
        >
          {descargando ? 'Descargando...' : 'Descargar'}
        </button>
        <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={foto.entregada}
            onChange={(e) => onEntregar(e.target.checked)}
            className="h-4 w-4 accent-emerald-600"
          />
          Entregada
        </label>
      </div>
    </div>
  )
}
