import { useRef, useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { Advertencia } from '../Advertencia'
import { AparienciaBoton } from './AparienciaBoton'
import { CampoColor } from '../CampoColor'
import { colorTextoSobre } from '../../lib/colores'
import {
  analizarArchivo,
  descargarPlantilla,
  estaAgotado,
  formatearPesos,
  PRODUCTOS_AVISO,
  type ResultadoCsv,
} from '../../lib/catalogo'
import {
  CATALOGO_INACTIVIDAD_MAX,
  CATALOGO_INACTIVIDAD_MIN,
  CATALOGO_QR_MAX,
  CATALOGO_QR_MIN,
  type BotonCatalogo,
  type ProductoCatalogo,
} from '../../types/config'

interface DialogCatalogoProps {
  valor: BotonCatalogo
  projectId: string
  onGuardar: (nuevo: BotonCatalogo) => void
  onCerrar: () => void
}

const MAX_BOTON = 20
const MAX_WA_MENSAJE = 300
/** colores de siempre del botón Cotizar (verde) y del filtro seleccionado (oscuro) */
const COTIZAR_DEFECTO = '#059669'
const CHIP_DEFECTO = '#0F172A'
/** filas de omitidas y advertencias que se listan antes de decir "y N más" */
const MAX_LISTADAS = 8

/** Categorías con su cantidad, en el orden en que aparecen en los productos */
function categoriasDe(productos: ProductoCatalogo[]) {
  const conteo = new Map<string, number>()
  for (const p of productos) if (p.categoria) conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1)
  return [...conteo.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }))
}

function ejemploMensaje(plantilla: string, producto?: ProductoCatalogo): string {
  const p = producto ?? { nombre: 'Audífonos inalámbricos', precio: 289000 }
  return plantilla.replace(/\{producto\}/g, p.nombre).replace(/\{precio\}/g, formatearPesos(p.precio))
}

/** Configura el botón de catálogo: productos por CSV, tiempo sin tocar y cotización por WhatsApp */
export function DialogCatalogo({ valor, projectId, onGuardar, onCerrar }: DialogCatalogoProps) {
  const [catalogo, setCatalogo] = useState(() => structuredClone(valor))
  const [resultado, setResultado] = useState<ResultadoCsv | null>(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [error, setError] = useState('')
  const entradaArchivo = useRef<HTMLInputElement>(null)

  const cambiar = (cambios: Partial<BotonCatalogo>) => setCatalogo((actual) => ({ ...actual, ...cambios }))

  async function cargarArchivo(archivo: File) {
    setErrorArchivo('')
    try {
      const analisis = await analizarArchivo(archivo)
      if (analisis.errorGeneral) {
        // El archivo no sirve: se queda el catálogo que ya había
        setResultado(null)
        setErrorArchivo(analisis.errorGeneral)
        return
      }
      setResultado(analisis)
      setCatalogo((actual) => ({ ...actual, productos: analisis.productos, archivo_nombre: archivo.name }))
    } catch {
      setErrorArchivo('No se pudo leer el archivo. Guárdalo como .xlsx o como CSV UTF-8 e inténtalo de nuevo.')
    }
  }

  function guardar() {
    const texto = catalogo.boton.texto.trim()
    if (catalogo.activo) {
      if (!texto) return setError('Escribe el texto que verá el visitante en el botón.')
      if (catalogo.productos.length === 0) return setError('Carga el archivo con los productos antes de activar el botón.')
      if (catalogo.cotizar_activo) {
        const digitos = catalogo.whatsapp_numero.replace(/\D/g, '')
        if (digitos.length < 10 || digitos.length > 15) {
          return setError('Escribe el número de WhatsApp con indicativo de país, solo dígitos. Ej: 573108676490')
        }
        if (!catalogo.whatsapp_mensaje.trim()) return setError('Escribe el mensaje que enviará el visitante por WhatsApp.')
      }
    }
    onGuardar({
      ...catalogo,
      boton: { ...catalogo.boton, texto },
      whatsapp_numero: catalogo.whatsapp_numero.replace(/\D/g, ''),
      whatsapp_mensaje: catalogo.whatsapp_mensaje.trim(),
    })
    onCerrar()
  }

  const categorias = resultado ? resultado.categorias : categoriasDe(catalogo.productos)
  const sinCategoria = resultado ? resultado.sinCategoria : catalogo.productos.filter((p) => !p.categoria).length
  const agotados = catalogo.productos.filter(estaAgotado).length
  // Con un color de marca, el botón Cotizar y el filtro seleccionado lo usan los dos; sin él, cada uno su color de siempre
  const fondoCotizar = catalogo.color_acento || COTIZAR_DEFECTO
  const fondoChip = catalogo.color_acento || CHIP_DEFECTO
  const textoCotizar = catalogo.color_texto_acento || colorTextoSobre(fondoCotizar)
  const textoChip = catalogo.color_texto_acento || colorTextoSobre(fondoChip)

  return (
    <Modal
      titulo="Configurar botón de catálogo"
      ayuda="El robot muestra una cuadrícula con los productos del CSV. Al tocar uno lee su descripción. Si nadie toca la pantalla un rato, vuelve a su ruta."
      onCancelar={onCerrar}
      onAceptar={guardar}
      textoAceptar="Guardar"
      aviso={error}
    >
      <div className="space-y-5">
        <label className="relative flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
          <input
            type="checkbox"
            checked={catalogo.activo}
            onChange={(e) => cambiar({ activo: e.target.checked })}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="flex items-center gap-2 font-semibold">
            Mostrar este botón
            <Ayuda>Los botones desactivados no aparecen en el robot.</Ayuda>
          </span>
        </label>

        <div>
          <p className="mb-2 font-medium text-slate-800">Texto del botón</p>
          <input
            value={catalogo.boton.texto}
            maxLength={MAX_BOTON}
            onChange={(e) => cambiar({ boton: { ...catalogo.boton, texto: e.target.value.slice(0, MAX_BOTON) } })}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {catalogo.boton.texto.length} / {MAX_BOTON} caracteres
          </p>
        </div>

        <AparienciaBoton valor={catalogo.boton} projectId={projectId} onChange={(boton) => cambiar({ boton })} />

        {/* ───── Productos ───── */}
        <div>
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Productos
            <Ayuda>
              Descarga la plantilla, llénala con los productos del cliente y cárgala aquí (CSV o Excel .xlsx, primera hoja). Columnas obligatorias: nombre,
              precio y url_imagen. Opcionales: stock, precio_anterior, descripcion y categoria. Precio 0 o stock 0 se
              muestra como "Agotado".
            </Ayuda>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={descargarPlantilla}
              className="rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Descargar plantilla
            </button>
            <button
              type="button"
              onClick={() => entradaArchivo.current?.click()}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {catalogo.productos.length > 0 ? 'Cargar otro archivo' : 'Cargar archivo'}
            </button>
            <input
              ref={entradaArchivo}
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0]
                e.target.value = ''
                if (archivo) void cargarArchivo(archivo)
              }}
            />
          </div>

          {errorArchivo && <Advertencia className="mt-3">{errorArchivo}</Advertencia>}

          {catalogo.productos.length > 0 && (
            <div className="mt-4 space-y-3 rounded-lg border border-slate-200 p-4">
              <p className="font-semibold text-slate-800">
                {catalogo.productos.length} {catalogo.productos.length === 1 ? 'producto' : 'productos'}
                {catalogo.archivo_nombre && (
                  <span className="ml-2 font-normal text-slate-500">({catalogo.archivo_nombre})</span>
                )}
                {resultado && <span className="ml-2 text-sm font-normal text-emerald-700">· cargado, falta guardar</span>}
              </p>
              {agotados > 0 && <p className="text-sm text-slate-600">{agotados} saldrán como "Agotado".</p>}

              {catalogo.productos.length > PRODUCTOS_AVISO && (
                <Advertencia>
                  Son muchos productos: las imágenes se descargan en el robot la primera vez y puede tardar. Conviene
                  probarlo en el robot antes del evento.
                </Advertencia>
              )}

              {categorias.length > 0 ? (
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-800">
                    Categorías detectadas (confírmalas con el cliente):
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {categorias.map((c) => (
                      <span key={c.nombre} className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700">
                        {c.nombre} <span className="text-slate-400">· {c.cantidad}</span>
                      </span>
                    ))}
                  </div>
                  {sinCategoria > 0 && (
                    <p className="mt-2 text-sm text-slate-600">
                      {sinCategoria} sin categoría: solo aparecen en "Todos".
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-600">Sin categorías: el robot no mostrará filtro.</p>
              )}

              {resultado?.similares.map((grupo) => (
                <Advertencia key={grupo.join('|')}>
                  Estas categorías parecen la misma escrita distinto: {grupo.map((g) => `"${g}"`).join(' y ')}. Corrígelas
                  en el archivo si es así.
                </Advertencia>
              ))}

              {resultado && resultado.omitidas.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-800">
                    {resultado.omitidas.length} {resultado.omitidas.length === 1 ? 'fila omitida' : 'filas omitidas'} (no se
                    cargaron):
                  </p>
                  {resultado.omitidas.slice(0, MAX_LISTADAS).map((o) => (
                    <Advertencia key={o.fila}>
                      Fila {o.fila}: {o.motivo}.
                    </Advertencia>
                  ))}
                  {resultado.omitidas.length > MAX_LISTADAS && (
                    <p className="text-sm text-slate-500">…y {resultado.omitidas.length - MAX_LISTADAS} más.</p>
                  )}
                </div>
              )}

              {resultado && resultado.advertencias.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-slate-800">Para revisar:</p>
                  {resultado.advertencias.slice(0, MAX_LISTADAS).map((a) => (
                    <Advertencia key={a}>{a}</Advertencia>
                  ))}
                  {resultado.advertencias.length > MAX_LISTADAS && (
                    <p className="text-sm text-slate-500">…y {resultado.advertencias.length - MAX_LISTADAS} más.</p>
                  )}
                </div>
              )}

              {/* Vista previa: las primeras tarjetas, como las verá el visitante */}
              <div>
                <p className="mb-2 text-sm font-medium text-slate-800">Vista previa</p>
                <div className="rounded-lg bg-slate-50 p-2">
                  {categorias.length > 0 && (
                    <div className="mb-2 flex gap-1.5 overflow-hidden">
                      {['Todos', ...categorias.slice(0, 3).map((c) => c.nombre)].map((nombre, i) => (
                        <span
                          key={nombre}
                          className="shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold"
                          style={
                            i === 0
                              ? { backgroundColor: fondoChip, color: textoChip, borderColor: fondoChip }
                              : { backgroundColor: '#fff', color: '#334155', borderColor: '#cbd5e1' }
                          }
                        >
                          {nombre}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-4 gap-2">
                    {catalogo.productos.slice(0, 8).map((p, i) => (
                      <TarjetaMini
                        key={`${p.nombre}-${i}`}
                        producto={p}
                        cotizar={catalogo.cotizar_activo}
                        fondoCotizar={fondoCotizar}
                        textoCotizar={textoCotizar}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ───── Colores de la marca ───── */}
        <div className="space-y-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Colores del catálogo
            <Ayuda>
              Se aplican al botón "Cotizar" y al filtro de categoría seleccionado, para mantener los colores de la
              marca. Si los dejas vacíos, el botón Cotizar es verde y el filtro seleccionado oscuro.
            </Ayuda>
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <CampoColor
              label="Color del botón"
              value={catalogo.color_acento}
              onChange={(color_acento) => cambiar({ color_acento })}
            />
            <CampoColor
              label="Color del texto del botón"
              value={catalogo.color_texto_acento}
              onChange={(color_texto_acento) => cambiar({ color_texto_acento })}
              ayuda="Si lo dejas vacío, se elige blanco o negro según el color del botón."
            />
          </div>
        </div>

        {/* ───── Tiempo sin tocar ───── */}
        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Tiempo sin tocar la pantalla
            <Ayuda>
              Cada toque en la pantalla reinicia la cuenta. Si nadie toca durante este tiempo, el robot vuelve a su ruta (
              {CATALOGO_INACTIVIDAD_MIN} a {CATALOGO_INACTIVIDAD_MAX} segundos).
            </Ayuda>
          </p>
          <CampoSegundos
            valor={catalogo.segundos_inactividad}
            min={CATALOGO_INACTIVIDAD_MIN}
            max={CATALOGO_INACTIVIDAD_MAX}
            defecto={30}
            onChange={(segundos_inactividad) => cambiar({ segundos_inactividad })}
          />
        </div>

        {/* ───── Cotizar ───── */}
        <div>
          <label className="relative flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
            <input
              type="checkbox"
              checked={catalogo.cotizar_activo}
              onChange={(e) => cambiar({ cotizar_activo: e.target.checked })}
              className="h-4 w-4 accent-indigo-600"
            />
            <span className="flex items-center gap-2 font-semibold">
              Botón "Cotizar" en cada producto
              <Ayuda>
                Muestra un QR que abre el WhatsApp de la marca con el producto ya escrito en el mensaje. El visitante lo
                escanea con su celular, sin tener que ir al stand.
              </Ayuda>
            </span>
          </label>

          {catalogo.cotizar_activo && (
            <div className="mt-4 space-y-4">
              <div className="relative">
                <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                  Número de WhatsApp de la marca
                  <Ayuda>Solo dígitos, con el indicativo del país. Ej: 573108676490</Ayuda>
                </p>
                <input
                  value={catalogo.whatsapp_numero}
                  inputMode="numeric"
                  placeholder="573108676490"
                  onChange={(e) => cambiar({ whatsapp_numero: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="relative">
                <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                  Mensaje de la cotización
                  <Ayuda>Escribe {'{producto}'} y {'{precio}'} donde deban ir el nombre y el precio del producto elegido.</Ayuda>
                </p>
                <textarea
                  value={catalogo.whatsapp_mensaje}
                  maxLength={MAX_WA_MENSAJE}
                  rows={2}
                  onChange={(e) => cambiar({ whatsapp_mensaje: e.target.value.slice(0, MAX_WA_MENSAJE) })}
                  className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
                <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Así lo verá:{' '}
                  <span className="font-medium">{ejemploMensaje(catalogo.whatsapp_mensaje, catalogo.productos[0])}</span>
                </p>
                <p className="mt-1 text-right text-sm text-slate-400">
                  {catalogo.whatsapp_mensaje.length} / {MAX_WA_MENSAJE} caracteres
                </p>
              </div>

              <div className="relative">
                <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                  Tiempo del QR en pantalla
                  <Ayuda>
                    Segundos que el QR queda visible ({CATALOGO_QR_MIN} a {CATALOGO_QR_MAX}). Mientras está en pantalla no
                    corre el tiempo sin tocar.
                  </Ayuda>
                </p>
                <CampoSegundos
                  valor={catalogo.segundos_qr}
                  min={CATALOGO_QR_MIN}
                  max={CATALOGO_QR_MAX}
                  defecto={30}
                  onChange={(segundos_qr) => cambiar({ segundos_qr })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

function CampoSegundos({
  valor,
  min,
  max,
  defecto,
  onChange,
}: {
  valor: number
  min: number
  max: number
  defecto: number
  onChange: (segundos: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="number"
        min={min}
        max={max}
        value={valor}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || defecto)))}
        className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <span className="text-slate-600">segundos</span>
    </div>
  )
}

/** Tarjeta reducida de la vista previa: igual que la del robot, en pequeño */
function TarjetaMini({
  producto,
  cotizar,
  fondoCotizar,
  textoCotizar,
}: {
  producto: ProductoCatalogo
  cotizar: boolean
  fondoCotizar: string
  textoCotizar: string
}) {
  const agotado = estaAgotado(producto)
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="aspect-square bg-slate-100">
        {producto.imagen_url ? (
          <img
            src={producto.imagen_url}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className={`h-full w-full object-cover ${agotado ? 'opacity-40 grayscale' : ''}`}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
      </div>
      <div className="p-1.5">
        {producto.categoria && (
          <p className="truncate text-[9px] font-medium uppercase tracking-wide text-slate-400">{producto.categoria}</p>
        )}
        <p className="truncate text-[11px] font-semibold text-slate-900">{producto.nombre}</p>
        <div className="mt-0.5 flex items-center justify-between gap-1">
          {agotado ? (
            <span className="text-[11px] font-bold text-slate-500">Agotado</span>
          ) : (
            <span className="truncate text-[11px] font-bold text-slate-900">
              {formatearPesos(producto.precio)}
              {producto.precio_anterior && (
                <span className="ml-1 text-[9px] font-normal text-slate-400 line-through">
                  {formatearPesos(producto.precio_anterior)}
                </span>
              )}
            </span>
          )}
          {cotizar && !agotado && (
            <span
              className="shrink-0 rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
              style={{ backgroundColor: fondoCotizar, color: textoCotizar }}
            >
              Cotizar
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
