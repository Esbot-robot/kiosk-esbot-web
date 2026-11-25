import { useRef, useState } from 'react'
import { Advertencia } from '../Advertencia'
import { Modal } from '../Modal'
import { describirError } from '../../lib/errores'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import { analizarPlantilla, type ResultadoPlantilla } from '../../lib/retailPlantilla'
import { MAX_MB_IMAGEN, resolverImagen, TIPOS_IMAGEN } from '../../lib/retailImagenes'
import type { ImagenRetail } from '../../types/config'

type Forma = 'url' | 'separado'

const FORMAS: { id: Forma; nombre: string; icono: React.ReactNode }[] = [
  {
    id: 'url',
    nombre: 'Enlaces en la plantilla',
    icono: (
      // enlace
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
    ),
  },
  {
    id: 'separado',
    nombre: 'Imágenes por separado',
    icono: (
      // imagen
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21" />
      </svg>
    ),
  },
]

const ACEPTA_PLANTILLA = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Botón redondo con el ícono de cargar; con visto cuando ya hay algo elegido */
function BotonCarga({
  texto,
  detalle,
  hecho,
  deshabilitado,
  onClick,
}: {
  texto: string
  /** nombre del archivo o cantidad de imágenes elegidas */
  detalle?: string
  hecho: boolean
  deshabilitado: boolean
  onClick: () => void
}) {
  return (
    <button type="button" onClick={onClick} disabled={deshabilitado} className="group flex w-44 flex-col items-center gap-3 disabled:opacity-50">
      <span
        className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-white transition-colors ${
          hecho
            ? 'border-[3px] border-[#1d293d] text-[#1d293d]'
            : 'border border-slate-200 text-slate-400 shadow-sm group-hover:border-slate-300 group-hover:text-[#1d293d]'
        }`}
      >
        {/* cargar */}
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M17 8l-5-5-5 5M12 3v12" />
        </svg>
        {hecho && (
          <span className="absolute -right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#1d293d] text-white ring-4 ring-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        )}
      </span>
      <span className={`text-xs font-semibold uppercase tracking-wider ${hecho ? 'text-[#1d293d]' : 'text-slate-400'}`}>{texto}</span>
      {detalle && <span className="w-full truncate text-center text-sm text-slate-500">{detalle}</span>}
    </button>
  )
}

/** Plantilla ya leída, lista para la revisión */
export interface PlantillaElegida {
  archivo: string
  resultado: ResultadoPlantilla
  /** imágenes del proyecto después de esta carga (las de antes más las nuevas) */
  imagenes: ImagenRetail[]
}

/**
 * Único camino para cargar los cupones. Primero se elige cómo vienen las
 * imágenes: con su URL dentro de la plantilla, o por separado. Por separado,
 * se eligen la plantilla y las imágenes juntas, se ve qué imagen falta antes
 * de aceptar, y al aceptar se suben.
 */
export function DialogCargaPlantilla({
  projectId,
  imagenesActuales,
  onListo,
  onCerrar,
}: {
  projectId: string
  /** imágenes ya subidas en cargas anteriores: también cuentan para asociar */
  imagenesActuales: ImagenRetail[]
  onListo: (p: PlantillaElegida) => void
  onCerrar: () => void
}) {
  const [paso, setPaso] = useState<'forma' | 'separado'>('forma')
  const [forma, setForma] = useState<Forma | null>(null)
  const [plantilla, setPlantilla] = useState<{ archivo: File; resultado: ResultadoPlantilla } | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elegidas, setElegidas] = useState<File[]>([])
  const [rechazadas, setRechazadas] = useState<string[]>([])
  const [subida, setSubida] = useState<{ hechas: number; total: number } | null>(null)
  const entradaPlantilla = useRef<HTMLInputElement>(null)
  const entradaImagenes = useRef<HTMLInputElement>(null)

  async function leerPlantilla(archivo: File): Promise<ResultadoPlantilla | null> {
    setLeyendo(true)
    setError(null)
    try {
      const resultado = await analizarPlantilla(archivo)
      if (resultado.errorGeneral) {
        setError(resultado.errorGeneral)
        return null
      }
      return resultado
    } catch (e) {
      setError(`No fue posible leer el archivo. ${describirError(e)}`)
      return null
    } finally {
      setLeyendo(false)
    }
  }

  /** Con URL en la plantilla: se lee y pasa directo a la revisión */
  async function elegirPlantillaConUrl(archivo: File) {
    const resultado = await leerPlantilla(archivo)
    if (resultado) onListo({ archivo: archivo.name, resultado, imagenes: imagenesActuales })
  }

  async function elegirPlantillaSeparada(archivo: File) {
    setPlantilla(null)
    const resultado = await leerPlantilla(archivo)
    if (resultado) setPlantilla({ archivo, resultado })
  }

  /** Suma imágenes a las elegidas; una con el mismo nombre reemplaza a la anterior */
  function agregarImagenes(archivos: File[]) {
    const malas: string[] = []
    const nuevas = [...elegidas]
    for (const a of archivos) {
      if (!TIPOS_IMAGEN.includes(a.type)) malas.push(`«${a.name}» no se cargó: el formato debe ser PNG, JPG o WEBP.`)
      else if (a.size > MAX_MB_IMAGEN * 1024 * 1024) malas.push(`«${a.name}» no se cargó: supera el tamaño máximo de ${MAX_MB_IMAGEN} MB.`)
      else {
        const previa = nuevas.findIndex((x) => x.name === a.name)
        if (previa >= 0) nuevas[previa] = a
        else nuevas.push(a)
      }
    }
    setElegidas(nuevas)
    setRechazadas(malas)
  }

  // Para asociar: las ya subidas más las elegidas ahora (la url real llega al subir)
  const disponibles: ImagenRetail[] = [
    ...imagenesActuales.filter((i) => !elegidas.some((e) => e.name === i.nombre)),
    ...elegidas.map((e) => ({ nombre: e.name, url: 'elegida' })),
  ]
  const conNombre = (plantilla?.resultado.cupones ?? [])
    .map((c, i) => ({ c, fila: plantilla!.resultado.filas[i] }))
    .filter((x) => x.c.imagen_archivo)
  const faltantes = conNombre.map((x) => ({ ...x, r: resolverImagen(x.c.imagen_archivo!, disponibles) })).filter((x) => !x.r.url)
  const asociadas = conNombre.length - faltantes.length

  async function aceptarSeparado() {
    if (!plantilla) return
    const imagenes = [...imagenesActuales]
    setSubida({ hechas: 0, total: elegidas.length })
    try {
      for (const [i, archivo] of elegidas.entries()) {
        const url = await subirArchivo('media', rutaMedia(projectId, `cupon_${archivo.name}`), archivo, { contentType: archivo.type })
        const previa = imagenes.findIndex((x) => x.nombre === archivo.name)
        if (previa >= 0) imagenes[previa] = { nombre: archivo.name, url }
        else imagenes.push({ nombre: archivo.name, url })
        setSubida({ hechas: i + 1, total: elegidas.length })
      }
    } catch (e) {
      setSubida(null)
      setError(`No fue posible cargar las imágenes. ${describirError(e)}`)
      return
    }
    onListo({ archivo: plantilla.archivo.name, resultado: plantilla.resultado, imagenes })
  }

  const entradaOculta = (
    <>
      <input
        ref={entradaPlantilla}
        type="file"
        accept={ACEPTA_PLANTILLA}
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          e.target.value = '' // permite volver a elegir el mismo archivo
          if (!archivo) return
          if (paso === 'forma') void elegirPlantillaConUrl(archivo)
          else void elegirPlantillaSeparada(archivo)
        }}
      />
      <input
        ref={entradaImagenes}
        type="file"
        multiple
        accept={TIPOS_IMAGEN.join(',')}
        className="hidden"
        onChange={(e) => {
          const archivos = [...(e.target.files ?? [])]
          e.target.value = ''
          if (archivos.length > 0) agregarImagenes(archivos)
        }}
      />
    </>
  )

  if (paso === 'forma') {
    return (
      <Modal
        titulo="Cargar plantilla"
        ancho="max-w-2xl"
        aviso={error ?? undefined}
        onCancelar={onCerrar}
        onAceptar={() => {
          if (forma === 'url') entradaPlantilla.current?.click()
          else if (forma === 'separado') {
            setError(null)
            setPaso('separado')
          }
        }}
        aceptarDeshabilitado={!forma || leyendo}
        textoAceptar={leyendo ? 'Leyendo archivo…' : 'Continuar'}
      >
        <p className="text-center text-sm font-bold uppercase tracking-wider text-[#1d293d]">¿Cómo desea cargar las imágenes de los cupones?</p>
        <div role="radiogroup" aria-label="Forma de cargar las imágenes" className="mt-6 flex justify-center gap-10">
          {FORMAS.map((f) => {
            const elegido = forma === f.id
            return (
              <button
                key={f.id}
                type="button"
                role="radio"
                aria-checked={elegido}
                onClick={() => setForma(f.id)}
                className="group flex flex-col items-center gap-3"
              >
                <span
                  className={`relative flex h-28 w-28 items-center justify-center rounded-full bg-white transition-colors ${
                    elegido
                      ? 'border-[3px] border-[#1d293d] text-[#1d293d]'
                      : 'border border-slate-200 text-slate-400 shadow-sm group-hover:border-slate-300'
                  }`}
                >
                  {f.icono}
                  {elegido && (
                    <span className="absolute -right-0.5 top-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#1d293d] text-white ring-4 ring-white">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wider ${elegido ? 'text-[#1d293d]' : 'text-slate-400'}`}>
                  {f.nombre}
                </span>
              </button>
            )
          })}
        </div>
        {entradaOculta}
      </Modal>
    )
  }

  // Se puede aceptar con imágenes elegidas, o sin ellas si la plantilla no las
  // necesita (solo trae URL, o nombra imágenes que ya se subieron antes)
  const listo = !!plantilla && (elegidas.length > 0 || faltantes.length === 0) && !leyendo && !subida
  return (
    <Modal
      titulo="Cargar plantilla e imágenes"
      ancho="max-w-2xl"
      aviso={error ?? undefined}
      onCancelar={onCerrar}
      onAceptar={() => void aceptarSeparado()}
      aceptarDeshabilitado={!listo}
      textoAceptar={subida ? `Cargando ${subida.hechas} de ${subida.total}…` : 'Aceptar'}
    >
      {/* Dos botones redondos: la plantilla y las imágenes. El visto indica que ya se eligió */}
      <div className="flex justify-center gap-10">
        <BotonCarga
          texto="Seleccionar archivo"
          detalle={leyendo ? 'Leyendo…' : plantilla?.archivo.name}
          hecho={!!plantilla && !leyendo}
          deshabilitado={leyendo || !!subida}
          onClick={() => entradaPlantilla.current?.click()}
        />
        <BotonCarga
          texto="Seleccionar imágenes"
          detalle={elegidas.length > 0 ? `${elegidas.length} ${elegidas.length === 1 ? 'imagen' : 'imágenes'}` : undefined}
          hecho={elegidas.length > 0}
          deshabilitado={!!subida}
          onClick={() => entradaImagenes.current?.click()}
        />
      </div>
      {rechazadas.length > 0 && (
        <div className="mt-3 space-y-1">
          {rechazadas.map((r) => (
            <Advertencia key={r}>{r}</Advertencia>
          ))}
        </div>
      )}

      {/* Cómo quedan asociadas, antes de subir nada */}
      {plantilla && !leyendo && (
        <div className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {conNombre.length === 0 ? (
            <p>La plantilla contiene los enlaces de todas las imágenes, por lo que no es necesario cargar archivos. Pulse «Aceptar» para continuar.</p>
          ) : elegidas.length === 0 && faltantes.length > 0 ? (
            <p>
              {conNombre.length === 1 ? 'La plantilla hace referencia a 1 imagen' : `La plantilla hace referencia a ${conNombre.length} imágenes`}.
              Selecciónelas en el paso 2.
            </p>
          ) : (
            <p>
              Se asociaron {asociadas} de {conNombre.length} {conNombre.length === 1 ? 'imagen' : 'imágenes'}.
            </p>
          )}
          {elegidas.length > 0 && faltantes.length > 0 && (
            <>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                {faltantes.map((x) => (
                  <li key={`${x.fila}-${x.c.id}`}>
                    <span className="font-semibold">Fila {x.fila}:</span> {x.r.problema}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-slate-500">
                Puede agregar las imágenes faltantes o continuar sin ellas. Los cupones sin imagen quedarán pendientes y el robot no
                los ofrecerá hasta completarlas.
              </p>
            </>
          )}
        </div>
      )}
      {entradaOculta}
    </Modal>
  )
}
