import { useRef, useState } from 'react'
import { Advertencia } from '../Advertencia'
import { AvisoArchivosFaltantes } from '../ArchivosFaltantes'
import { DialogArchivo } from '../editor/DialogArchivo'
import { IconoGuardar, IconoPlay } from '../iconos'
import { avisosZonas, estadoCupon, hoyColombia, type EstadoCupon } from '../../lib/retail'
import { analizarPlantilla, comprobarImagenes, descargarCuponesActuales, descargarPlantillaCupones, type FilaOmitida } from '../../lib/retailPlantilla'
import { describirError } from '../../lib/errores'
import { rutaMedia, subirArchivo } from '../../lib/storage'
import { cuponesSinImagen, MAX_MB_IMAGEN, resolverCupones, resolverImagen, TIPOS_IMAGEN } from '../../lib/retailImagenes'
import { Modal } from '../Modal'
import { RevisionPlantilla } from './RevisionPlantilla'
import type { ResultadoArchivo } from '../../lib/archivosProyecto'
import {
  SEGUNDOS_CUPON_MAX,
  SEGUNDOS_CUPON_MIN,
  type ConfigRetail,
  type CuponRetail,
  type ImagenRetail,
} from '../../types/config'

/** Avance de la carga de la plantilla */
type Carga =
  | { fase: 'leyendo' }
  | { fase: 'imagenes'; hechas: number; total: number }
  | { fase: 'revision'; archivo: string; cupones: CuponRetail[]; omitidas: FilaOmitida[]; pendientes: FilaOmitida[] }
  | { fase: 'error'; mensaje: string }

/** «vence en 4 días», «se activa mañana», «venció hace 2 días» */
function textoEstado(e: EstadoCupon): string {
  const dias = (n: number) => (n === 1 ? '1 día' : `${n} días`)
  if (e.estado === 'activo') return e.dias === 0 ? 'Activo · vence hoy' : e.dias === 1 ? 'Activo · vence mañana' : `Activo · vence en ${dias(e.dias)}`
  if (e.estado === 'por_activar') return e.dias === 1 ? 'Se activa mañana' : `Se activa en ${dias(e.dias)}`
  return e.dias === 1 ? 'Vencido ayer' : `Vencido hace ${dias(e.dias)}`
}

/** El estado se distingue solo por el color del texto */
const COLOR_ESTADO: Record<EstadoCupon['estado'], string> = {
  activo: 'text-emerald-700',
  por_activar: 'text-sky-700',
  vencido: 'text-slate-500',
}

/** Miniatura del cupón: la imagen está en el servidor del cliente y puede no cargar */
function Miniatura({ url }: { url: string }) {
  const [fallo, setFallo] = useState(false)
  return (
    <span className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-xs text-slate-400">
      {fallo ? 'Sin imagen' : <img src={url} alt="" className="h-full w-full object-cover" onError={() => setFallo(true)} />}
    </span>
  )
}

function FilaCupon({
  cupon,
  numero,
  hoy,
  abierto,
  seleccionado,
  soloLectura,
  faltaImagen,
  onAbrir,
  onSeleccionar,
}: {
  cupon: CuponRetail
  /** por qué el cupón no tiene imagen todavía (el robot no lo ofrece hasta tenerla) */
  faltaImagen?: string
  /** posición en la plantilla: es el orden de la rotación, aunque haya un filtro */
  numero: number
  hoy: string
  abierto: boolean
  seleccionado: boolean
  soloLectura: boolean
  onAbrir: () => void
  onSeleccionar: (marcado: boolean) => void
}) {
  const estado = estadoCupon(cupon, hoy)
  return (
    <li className={`rounded-xl border bg-white ${seleccionado ? 'border-[#1d293d]' : 'border-slate-200'}`}>
      <div className="flex items-center gap-3 p-3">
        {!soloLectura && (
          <input
            type="checkbox"
            checked={seleccionado}
            onChange={(e) => onSeleccionar(e.target.checked)}
            aria-label={`Seleccionar el cupón de ${cupon.producto}`}
            className="h-4 w-4 shrink-0 accent-[#1d293d]"
          />
        )}
        <button type="button" onClick={onAbrir} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={abierto}>
          <span className="w-6 shrink-0 text-center text-sm text-slate-400">{numero}</span>
          <Miniatura url={cupon.imagen_url} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-slate-800">{cupon.producto || 'Sin producto'}</span>
            <span className="block truncate text-sm text-slate-500">Zona: {cupon.zona}</span>
            {faltaImagen && <span className="block truncate text-sm font-medium text-rose-600">Sin imagen: {faltaImagen}</span>}
          </span>
          <span className={`shrink-0 text-sm font-semibold ${COLOR_ESTADO[estado.estado]}`}>
            {textoEstado(estado)}
          </span>
        </button>
      </div>
      {abierto && (
        <dl className="grid gap-x-6 gap-y-3 border-t border-slate-100 px-4 py-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Al detectar</dt>
            <dd className="text-slate-800">{cupon.frase_detectar}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Al mostrar el cupón</dt>
            <dd className="text-slate-800">{cupon.frase_mostrar}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Despedida</dt>
            <dd className="text-slate-800">{cupon.frase_despedida}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Vigencia</dt>
            <dd className="text-slate-800">
              {cupon.vigencia_desde} al {cupon.vigencia_hasta}
            </dd>
          </div>
        </dl>
      )}
    </li>
  )
}

/**
 * Editor de un proyecto Retail. Los cupones solo llegan desde la plantilla del
 * cliente (un solo origen, sin versiones que se contradigan); aquí se revisan,
 * se quitan y se configura lo del recorrido. Guardar y eliminar son los mismos
 * del editor de eventos (los recibe por props).
 */
export function EditorRetail({
  nombre,
  onNombre,
  version,
  retail,
  onRetail,
  projectId,
  soloLectura,
  hayCambios,
  archivosFaltantes,
  guardando,
  guardadoOk,
  errorGuardar,
  onGuardar,
  onEliminar,
}: {
  nombre: string
  onNombre: (nombre: string) => void
  version: number
  retail: ConfigRetail
  onRetail: (retail: ConfigRetail) => void
  projectId: string
  soloLectura: boolean
  hayCambios: boolean
  archivosFaltantes: ResultadoArchivo[]
  guardando: boolean
  guardadoOk: boolean
  errorGuardar?: string
  onGuardar: () => void
  onEliminar: () => void
}) {
  const [abierto, setAbierto] = useState<string | null>(null)
  const [dialogoVideo, setDialogoVideo] = useState(false)
  const [carga, setCarga] = useState<Carga | null>(null)
  /** cupones que se pidió quitar (uno o varios): se confirma antes */
  const [aQuitar, setAQuitar] = useState<CuponRetail[] | null>(null)
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoCupon['estado']>('todos')
  const [filtroZona, setFiltroZona] = useState('')
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const entradaImagenes = useRef<HTMLInputElement>(null)
  const [subida, setSubida] = useState<{ hechas: number; total: number } | null>(null)
  const [resultadoSubida, setResultadoSubida] = useState<{ subidas: number; rechazadas: string[] } | null>(null)
  const imagenes = retail.imagenes ?? []

  /**
   * Sube las imágenes elegidas al almacenamiento del proyecto y asocia por nombre
   * exacto los cupones que las esperan. Una imagen con el mismo nombre que otra ya
   * subida la reemplaza (queda una dirección nueva: los robots bajan la nueva).
   */
  async function subirImagenes(archivos: File[]) {
    const nuevas: ImagenRetail[] = [...imagenes]
    const rechazadas: string[] = []
    let subidas = 0
    setResultadoSubida(null)
    setSubida({ hechas: 0, total: archivos.length })
    for (const [i, archivo] of archivos.entries()) {
      if (!TIPOS_IMAGEN.includes(archivo.type)) {
        rechazadas.push(`«${archivo.name}»: debe ser PNG, JPG o WEBP.`)
      } else if (archivo.size > MAX_MB_IMAGEN * 1024 * 1024) {
        rechazadas.push(`«${archivo.name}»: pesa más de ${MAX_MB_IMAGEN} MB.`)
      } else {
        try {
          const url = await subirArchivo('media', rutaMedia(projectId, `cupon_${archivo.name}`), archivo, { contentType: archivo.type })
          const previa = nuevas.findIndex((x) => x.nombre === archivo.name)
          if (previa >= 0) nuevas[previa] = { nombre: archivo.name, url }
          else nuevas.push({ nombre: archivo.name, url })
          subidas++
        } catch (e) {
          rechazadas.push(`«${archivo.name}»: no se pudo subir. ${describirError(e)}`)
        }
      }
      setSubida({ hechas: i + 1, total: archivos.length })
    }
    onRetail({ ...retail, imagenes: nuevas, cupones: resolverCupones(retail.cupones, nuevas) })
    setSubida(null)
    setResultadoSubida({ subidas, rechazadas })
  }

  /** Lee la plantilla, comprueba que cada imagen cargue y muestra la revisión antes de usarla */
  async function cargarPlantilla(archivo: File) {
    setCarga({ fase: 'leyendo' })
    try {
      const resultado = await analizarPlantilla(archivo)
      if (resultado.errorGeneral) {
        setCarga({ fase: 'error', mensaje: resultado.errorGeneral })
        return
      }
      // Los que nombran un archivo se asocian con las imágenes ya subidas al panel
      const cupones = resolverCupones(resultado.cupones, imagenes)
      const conUrl = cupones.filter((c) => c.imagen_url)
      setCarga({ fase: 'imagenes', hechas: 0, total: conUrl.length })
      const fallidas = await comprobarImagenes(
        conUrl.map((c) => c.imagen_url),
        (hechas, total) => setCarga({ fase: 'imagenes', hechas, total })
      )
      // Un cupón cuya imagen no carga no se puede mostrar: queda fuera, con su fila
      const omitidas = [...resultado.omitidas]
      const pendientes: FilaOmitida[] = []
      const cuponesOk = cupones.filter((c, i) => {
        if (!c.imagen_url) {
          // Espera su imagen: entra igual y se completa con «Subir imágenes»
          pendientes.push({ fila: resultado.filas[i], nombre: c.producto, motivo: resolverImagen(c.imagen_archivo ?? '', imagenes).problema ?? '' })
          return true
        }
        if (!fallidas.has(c.imagen_url)) return true
        omitidas.push({
          fila: resultado.filas[i],
          nombre: c.producto,
          motivo: c.imagen_url.startsWith('https://drive.google.com/')
            ? 'la imagen de Drive no se pudo cargar. Verifique que esté compartida como «Cualquier persona con el enlace».'
            : 'la imagen no se pudo cargar. Verifique que la URL abra directamente la imagen.',
        })
        return false
      })
      omitidas.sort((a, b) => a.fila - b.fila)
      setCarga({ fase: 'revision', archivo: archivo.name, cupones: cuponesOk, omitidas, pendientes })
    } catch (e) {
      setCarga({ fase: 'error', mensaje: `No fue posible leer el archivo. ${describirError(e)}` })
    }
  }
  const hoy = hoyColombia()
  const cupones = retail.cupones
  const estados = cupones.map((c) => estadoCupon(c, hoy).estado)

  const zonas = [...new Set(cupones.map((c) => c.zona.trim()))]
  // Dónde saludará el robot hoy (zonas sin cupones activos, cupones generales). Un
  // cupón sin imagen no cuenta: el robot no lo ofrece hasta tenerla
  const avisos = avisosZonas(cupones.filter((c) => c.imagen_url), hoy)
  const sinImagen = new Map(cuponesSinImagen(cupones, imagenes).map((x) => [x.cupon.id, x.problema]))

  // Si se quitaron todos los cupones de la zona filtrada, el filtro vuelve a «Todas»
  const zonaFiltrada = zonas.includes(filtroZona) ? filtroZona : ''
  // Cantidades de cada estado dentro de la zona elegida (con «Todas las zonas», de toda la lista)
  const enZona = cupones.map((c, i) => ({ c, estado: estados[i] })).filter((x) => !zonaFiltrada || x.c.zona.trim() === zonaFiltrada)
  const cuenta = (estado: EstadoCupon['estado']) => enZona.filter((x) => x.estado === estado).length
  // Lista visible según los filtros; cada cupón conserva su número de la plantilla
  const visibles = cupones
    .map((c, i) => ({ c, numero: i + 1, estado: estados[i] }))
    .filter((x) => (filtroEstado === 'todos' || x.estado === filtroEstado) && (!zonaFiltrada || x.c.zona.trim() === zonaFiltrada))
  // Solo cuentan los seleccionados que siguen en la lista (al reemplazar la plantilla desaparecen)
  const seleccionados = cupones.filter((c) => seleccion.has(c.id))
  const todosVisiblesMarcados = visibles.length > 0 && visibles.every((x) => seleccion.has(x.c.id))
  const algunVisibleMarcado = visibles.some((x) => seleccion.has(x.c.id))

  /** Cambiar el filtro limpia la selección: así no se quita nada que no esté a la vista */
  function filtrar(estado: typeof filtroEstado, zona: string) {
    setFiltroEstado(estado)
    setFiltroZona(zona)
    setSeleccion(new Set())
  }

  function marcar(id: string, marcado: boolean) {
    const nueva = new Set(seleccion)
    if (marcado) nueva.add(id)
    else nueva.delete(id)
    setSeleccion(nueva)
  }

  const videoFalta = !!retail.video_url && archivosFaltantes.some((a) => a.url === retail.video_url)
  const segundos = (n: number) => Math.min(SEGUNDOS_CUPON_MAX, Math.max(SEGUNDOS_CUPON_MIN, Math.round(n) || SEGUNDOS_CUPON_MIN))

  return (
    <div className="flex h-full flex-col">
      {/* Barra superior: nombre, versión y tipo */}
      <div className="flex flex-col border-b border-slate-200 bg-white px-2 py-2 md:flex-row md:items-center md:justify-between md:py-3 md:pl-10 md:pr-6">
        <div>
          <input
            value={nombre}
            onChange={(e) => onNombre(e.target.value)}
            readOnly={soloLectura}
            className="w-full rounded px-2 text-2xl font-bold text-slate-800 focus:bg-slate-50 focus:outline-none md:w-96"
            title={soloLectura ? undefined : 'Nombre del proyecto (haga clic para editar)'}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 text-sm text-slate-400">
            <span>Versión {version} - RETAIL</span>
            {hayCambios && !guardando && !soloLectura && <Advertencia>Hay cambios sin guardar</Advertencia>}
            <AvisoArchivosFaltantes faltan={archivosFaltantes} />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-visible">
        {/* ─── Cupones ─── */}
        <section className="min-w-0 flex-1 p-4 md:overflow-y-auto md:px-10 md:pb-10 md:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Cupones</h2>
            </div>
            {!soloLectura && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={descargarPlantillaCupones}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Descargar plantilla
                </button>
                <button
                  type="button"
                  onClick={() => entradaImagenes.current?.click()}
                  disabled={subida !== null}
                  className="px-4 py-2.5 font-semibold text-[#1d293d] transition-colors hover:bg-slate-100 disabled:opacity-40"
                >
                  Subir imágenes
                </button>
                <input
                  ref={entradaImagenes}
                  type="file"
                  multiple
                  accept={TIPOS_IMAGEN.join(',')}
                  className="hidden"
                  onChange={(e) => {
                    const archivos = [...(e.target.files ?? [])]
                    e.target.value = ''
                    if (archivos.length > 0) void subirImagenes(archivos)
                  }}
                />
                <button
                  type="button"
                  onClick={() => entradaArchivo.current?.click()}
                  disabled={carga?.fase === 'leyendo' || carga?.fase === 'imagenes'}
                  className="border border-[#1d293d] px-5 py-2.5 font-semibold text-[#1d293d] transition-colors hover:bg-slate-50 disabled:opacity-40"
                >
                  {cupones.length > 0 ? 'Reemplazar plantilla' : 'Cargar plantilla'}
                </button>
                <input
                  ref={entradaArchivo}
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const archivo = e.target.files?.[0]
                    e.target.value = '' // permite volver a elegir el mismo archivo
                    if (archivo) void cargarPlantilla(archivo)
                  }}
                />
              </div>
            )}
          </div>

          {(retail.archivo_nombre || imagenes.length > 0) && (
            <p className="mt-2 truncate text-sm text-slate-500">
              {retail.archivo_nombre && cupones.length > 0 && (
                <>
                  Plantilla:{' '}
                  <button
                    type="button"
                    onClick={() => void descargarCuponesActuales(cupones, retail.archivo_nombre!)}
                    title="Descargar la plantilla con los cupones actuales"
                    className="font-medium text-[#3352F5] underline-offset-2 hover:underline"
                  >
                    {retail.archivo_nombre}
                  </button>
                </>
              )}
              {retail.archivo_nombre && cupones.length > 0 && imagenes.length > 0 && ' · '}
              {imagenes.length > 0 && `${imagenes.length} ${imagenes.length === 1 ? 'imagen subida' : 'imágenes subidas'}`}
            </p>
          )}
          {subida && (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Subiendo imágenes: {subida.hechas} de {subida.total}…
            </p>
          )}
          {resultadoSubida && (
            <div className="mt-4 space-y-1">
              <p className="text-sm text-slate-600">
                {resultadoSubida.subidas === 1 ? '1 imagen subida.' : `${resultadoSubida.subidas} imágenes subidas.`} Los cambios se
                aplicarán al pulsar «Guardar».
              </p>
              {resultadoSubida.rechazadas.map((r) => (
                <Advertencia key={r}>{r}</Advertencia>
              ))}
            </div>
          )}
          {sinImagen.size > 0 && (
            <Advertencia className="mt-4">
              {sinImagen.size === 1 ? '1 cupón espera su imagen' : `${sinImagen.size} cupones esperan su imagen`}: el robot no
              los ofrecerá hasta subirla con «Subir imágenes».
            </Advertencia>
          )}
          {(carga?.fase === 'leyendo' || carga?.fase === 'imagenes') && (
            <p className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {carga.fase === 'leyendo'
                ? 'Leyendo la plantilla…'
                : `Verificando las imágenes de los cupones: ${carga.hechas} de ${carga.total}…`}
            </p>
          )}

          {avisos.length > 0 && (
            <div className="mt-4 space-y-1">
              {avisos.map((aviso) => (
                <Advertencia key={aviso}>{aviso}</Advertencia>
              ))}
            </div>
          )}

          {cupones.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
              <p className="font-semibold text-slate-700">Aún no hay cupones</p>
              <p className="mt-1 text-sm text-slate-500">Cargue la plantilla del cliente para agregarlos.</p>
            </div>
          ) : (
            <>
              {/* Filtros: por estado y por zona */}
              <div className="mt-6 flex flex-wrap items-center gap-3">
                {/* Píldora con la opción elegida en azul oscuro */}
                <div className="flex flex-wrap gap-1 rounded-full border border-slate-200 bg-white p-1">
                  {(
                    [
                      ['todos', 'Todos', enZona.length],
                      ['activo', 'Activos', cuenta('activo')],
                      ['por_activar', 'Próximos', cuenta('por_activar')],
                      ['vencido', 'Vencidos', cuenta('vencido')],
                    ] as const
                  ).map(([id, etiqueta, cantidad]) => {
                    const elegido = filtroEstado === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => filtrar(id, zonaFiltrada)}
                        className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                          elegido ? 'bg-[#1d293d] text-white' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {etiqueta} <span className={elegido ? 'text-white/70' : 'text-slate-400'}>{cantidad}</span>
                      </button>
                    )
                  })}
                </div>
                {zonas.length > 1 && (
                  // Flecha propia: la del navegador quedaba pegada al borde redondeado
                  <span className="relative">
                    <select
                      value={zonaFiltrada}
                      onChange={(e) => filtrar(filtroEstado, e.target.value)}
                      aria-label="Filtrar por zona"
                      className="appearance-none rounded-full border border-slate-200 bg-white py-2 pl-4 pr-10 text-sm font-semibold text-slate-700 focus:border-[#1d293d] focus:outline-none"
                    >
                      <option value="">Todas las zonas</option>
                      {zonas.map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 24 24"
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </span>
                )}
              </div>

              {/* Seleccionar todos (los visibles) y quitar en lote */}
              {!soloLectura && visibles.length > 0 && (
                <div className="mt-4 flex min-h-11 flex-wrap items-center gap-3 px-3">
                  <label className="flex items-center gap-3 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={todosVisiblesMarcados}
                      ref={(el) => {
                        if (el) el.indeterminate = algunVisibleMarcado && !todosVisiblesMarcados
                      }}
                      onChange={(e) => {
                        const nueva = new Set(seleccion)
                        visibles.forEach((x) => (e.target.checked ? nueva.add(x.c.id) : nueva.delete(x.c.id)))
                        setSeleccion(nueva)
                      }}
                      className="h-4 w-4 accent-[#1d293d]"
                    />
                    Seleccionar todos
                  </label>
                  {seleccionados.length > 0 && (
                    <>
                      <span className="text-sm font-semibold text-slate-800">
                        {seleccionados.length} {seleccionados.length === 1 ? 'seleccionado' : 'seleccionados'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAQuitar(seleccionados)}
                        className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setSeleccion(new Set())}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                </div>
              )}

              {visibles.length === 0 ? (
                <p className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
                  Ningún cupón coincide con el filtro.
                </p>
              ) : (
                <ul className="mt-2 space-y-3">
                  {visibles.map(({ c, numero }) => (
                    <FilaCupon
                      key={c.id}
                      cupon={c}
                      numero={numero}
                      hoy={hoy}
                      abierto={abierto === c.id}
                      seleccionado={seleccion.has(c.id)}
                      soloLectura={soloLectura}
                      faltaImagen={sinImagen.get(c.id)}
                      onAbrir={() => setAbierto(abierto === c.id ? null : c.id)}
                      onSeleccionar={(marcado) => marcar(c.id, marcado)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {/* ─── Recorrido ─── */}
        <aside className="flex w-full flex-col border-t border-slate-200 bg-white md:w-96 md:border-l md:border-t-0">
          <div className="space-y-6 p-4 md:flex-1 md:overflow-y-auto md:p-6">
            <h2 className="text-xl font-bold text-slate-900">Recorrido</h2>

            <div>
              <p className="font-semibold text-slate-800">Video del recorrido</p>
              <p className="mt-1 text-sm text-slate-500">Se reproduce mientras el robot recorre la tienda.</p>
              <button
                type="button"
                onClick={() => setDialogoVideo(true)}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <span className="text-blue-700">
                  <IconoPlay />
                </span>
                <span className={`text-sm ${videoFalta ? 'text-rose-600' : 'text-slate-700'}`}>
                  {videoFalta ? 'El archivo no existe: súbalo de nuevo' : retail.video_url ? 'Video cargado' : 'Sin video'}
                </span>
              </button>
            </div>

            <div>
              <label htmlFor="segundos-cupon" className="font-semibold text-slate-800">
                Segundos del cupón en pantalla
              </label>
              <p className="mt-1 text-sm text-slate-500">
                De {SEGUNDOS_CUPON_MIN} a {SEGUNDOS_CUPON_MAX} segundos. Luego el robot se despide y sigue.
              </p>
              <input
                id="segundos-cupon"
                type="number"
                min={SEGUNDOS_CUPON_MIN}
                max={SEGUNDOS_CUPON_MAX}
                value={retail.segundos_cupon}
                readOnly={soloLectura}
                onChange={(e) => onRetail({ ...retail, segundos_cupon: segundos(Number(e.target.value)) })}
                className="mt-3 w-28 rounded-lg border border-slate-300 px-3 py-2 text-lg focus:border-[#1d293d] focus:outline-none"
              />
            </div>
          </div>

          {!soloLectura && (
            <div className="border-t border-slate-200 p-4 md:p-6">
              {errorGuardar && <Advertencia className="mb-3">{errorGuardar}</Advertencia>}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onEliminar}
                  disabled={guardando}
                  className="px-5 py-4 font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                >
                  Eliminar
                </button>
                <button
                  type="button"
                  onClick={onGuardar}
                  disabled={guardando}
                  className="flex flex-1 items-center justify-center gap-3 bg-[#1d293d] py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <IconoGuardar />
                  {guardando ? 'Guardando...' : guardadoOk ? 'Guardado ✓' : 'Guardar'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>

      {aQuitar && (
        <Modal
          titulo={aQuitar.length === 1 ? 'Eliminar cupón' : `Eliminar ${aQuitar.length} cupones`}
          ancho="max-w-lg"
          textoAceptar="Sí, eliminar"
          onCancelar={() => setAQuitar(null)}
          onAceptar={() => {
            const ids = new Set(aQuitar.map((c) => c.id))
            onRetail({ ...retail, cupones: cupones.filter((x) => !ids.has(x.id)) })
            setSeleccion((sel) => new Set([...sel].filter((id) => !ids.has(id))))
            setAQuitar(null)
          }}
        >
          {aQuitar.length === 1 ? (
            <p className="text-slate-700">
              Se eliminará el cupón <span className="font-semibold">«{aQuitar[0].producto}»</span> de la zona{' '}
              <span className="font-semibold">«{aQuitar[0].zona}»</span>. El robot dejará de ofrecerlo una vez guardados los
              cambios.
            </p>
          ) : (
            <>
              <p className="text-slate-700">
                Se eliminarán los siguientes {aQuitar.length} cupones. El robot dejará de ofrecerlos una vez guardados los
                cambios.
              </p>
              <ul className="mt-3 max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-sm text-slate-700">
                {aQuitar.map((c) => (
                  <li key={c.id}>
                    {c.producto} <span className="text-slate-400">· {c.zona}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-3 text-sm text-slate-500">
            {aQuitar.length === 1
              ? 'Para recuperarlo, deberá cargarlo nuevamente desde la plantilla.'
              : 'Para recuperarlos, deberá cargarlos nuevamente desde la plantilla.'}
          </p>
        </Modal>
      )}

      {carga?.fase === 'revision' && (
        <RevisionPlantilla
          archivo={carga.archivo}
          cupones={carga.cupones}
          omitidas={carga.omitidas}
          pendientes={carga.pendientes}
          cuponesActuales={cupones.length}
          onCancelar={() => setCarga(null)}
          onAceptar={() => {
            onRetail({ ...retail, cupones: carga.cupones, archivo_nombre: carga.archivo })
            setCarga(null)
          }}
        />
      )}
      {carga?.fase === 'error' && (
        <Modal titulo="No se pudo cargar la plantilla" ancho="max-w-lg" onCancelar={() => setCarga(null)} onAceptar={() => setCarga(null)} textoAceptar="Aceptar">
          <Advertencia>{carga.mensaje}</Advertencia>
        </Modal>
      )}

      {dialogoVideo && (
        <DialogArchivo
          titulo="Cargar video del recorrido"
          tipo="video"
          projectId={projectId}
          urlActual={retail.video_url}
          onSubido={(url) => onRetail({ ...retail, video_url: url })}
          onCerrar={() => setDialogoVideo(false)}
        />
      )}
    </div>
  )
}
