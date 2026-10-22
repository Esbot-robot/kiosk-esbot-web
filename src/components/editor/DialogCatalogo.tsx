import { useRef, useState } from 'react'
import { ModalPestanas } from '../ModalPestanas'
import { Ayuda } from '../Ayuda'
import { Advertencia } from '../Advertencia'
import { Interruptor } from '../Interruptor'
import { AparienciaBoton } from './AparienciaBoton'
import { CampoTexto } from './ConfigFormulario'
import { DialogTts } from './DialogTexto'
import { CampoColor } from '../CampoColor'
import {
  IconoAvisoAmarillo,
  IconoChat,
  IconoExcel,
  IconoLapizEditar,
  IconoPaleta,
  IconoPortapapeles,
  IconoReloj,
  IconoSubir,
} from '../iconosPopup'
import { colorTextoSobre } from '../../lib/colores'
import {
  analizarArchivo,
  descargarPlantilla,
  estaAgotado,
  formatearPesos,
  porcentajeDescuento,
  PRODUCTOS_AVISO,
  type ResultadoCsv,
} from '../../lib/catalogo'
import {
  CATALOGO_INACTIVIDAD_MAX,
  CATALOGO_INACTIVIDAD_MIN,
  CATALOGO_QR_MAX,
  CATALOGO_QR_MIN,
  LIMITES,
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
/** rojo de la cinta de descuento cuando no hay color de marca */
const CINTA_DEFECTO = '#EF5350'
/** filas de omitidas y advertencias que se listan antes de decir "y N más" */
const MAX_LISTADAS = 8

type PestanaCatalogo = 'diseno' | 'productos' | 'reanudar' | 'cotizar'

const PESTANAS = [
  { id: 'diseno', etiqueta: 'Apariencia', icono: <IconoPaleta /> },
  { id: 'productos', etiqueta: 'Catálogo', icono: <IconoPortapapeles /> },
  { id: 'reanudar', etiqueta: 'Inactividad', icono: <IconoReloj /> },
  { id: 'cotizar', etiqueta: 'Cotización', icono: <IconoChat /> },
]

/** Qué frase del catálogo se está editando en el popup de TTS */
type EditorTts = { tipo: 'entrada' } | { tipo: 'categoria'; nombre: string } | { tipo: 'sin_descripcion' }

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

function BotonEditarTts({ titulo, onClick }: { titulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      className="rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
    >
      <IconoLapizEditar />
    </button>
  )
}

/** Etiqueta de sección dentro de una pestaña */
function Titulo({ children, ayuda }: { children: React.ReactNode; ayuda?: React.ReactNode }) {
  return (
    <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
      {children}
      {ayuda && <Ayuda>{ayuda}</Ayuda>}
    </p>
  )
}

/** Configura el botón de catálogo: diseño, productos, tiempo sin tocar y cotización por WhatsApp */
export function DialogCatalogo({ valor, projectId, onGuardar, onCerrar }: DialogCatalogoProps) {
  const [catalogo, setCatalogo] = useState(() => structuredClone(valor))
  const [pestana, setPestana] = useState<PestanaCatalogo>('diseno')
  const [resultado, setResultado] = useState<ResultadoCsv | null>(null)
  const [errorArchivo, setErrorArchivo] = useState('')
  const [error, setError] = useState('')
  const [editorTts, setEditorTts] = useState<EditorTts | null>(null)
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
      setErrorArchivo('No fue posible leer el archivo. Guárdelo como .xlsx o CSV UTF-8 e intente nuevamente.')
    }
  }

  /** Muestra el error y lleva a la pestaña donde se corrige */
  function fallar(en: PestanaCatalogo, mensaje: string) {
    setPestana(en)
    setError(mensaje)
  }

  function guardar() {
    const texto = catalogo.boton.texto.trim()
    if (catalogo.activo) {
      if (!texto) return fallar('diseno', 'Ingrese la etiqueta del botón.')
      if (catalogo.productos.length === 0) {
        return fallar('productos', 'Cargue el archivo de productos antes de habilitar el botón.')
      }
      if (catalogo.cotizar_activo) {
        const digitos = catalogo.whatsapp_numero.replace(/\D/g, '')
        if (digitos.length < 10 || digitos.length > 15) {
          return fallar('cotizar', 'Ingrese el número de WhatsApp con indicativo de país, solo dígitos. Ejemplo: 573108676490.')
        }
        if (!catalogo.whatsapp_mensaje.trim()) {
          return fallar('cotizar', 'Ingrese el mensaje de cotización.')
        }
      }
    }
    // Solo se guardan las frases de las categorías que existen en el catálogo actual
    const vigentes = new Set(categoriasDe(catalogo.productos).map((c) => c.nombre))
    const frasesCategoria: Record<string, string> = {}
    for (const [nombre, frase] of Object.entries(catalogo.tts_categorias)) {
      if (vigentes.has(nombre) && frase.trim()) frasesCategoria[nombre] = frase.trim()
    }
    onGuardar({
      ...catalogo,
      boton: { ...catalogo.boton, texto },
      whatsapp_numero: catalogo.whatsapp_numero.replace(/\D/g, ''),
      whatsapp_mensaje: catalogo.whatsapp_mensaje.trim(),
      tts_entrada: catalogo.tts_entrada.trim(),
      tts_sin_descripcion: catalogo.tts_sin_descripcion.trim(),
      tts_cotizar: catalogo.tts_cotizar.trim(),
      tts_despedida: catalogo.tts_despedida.trim(),
      tts_categorias: frasesCategoria,
    })
    onCerrar()
  }

  const categorias = resultado ? resultado.categorias : categoriasDe(catalogo.productos)
  const sinCategoria = resultado ? resultado.sinCategoria : catalogo.productos.filter((p) => !p.categoria).length
  const agotados = catalogo.productos.filter(estaAgotado).length
  const sinDescripcion = catalogo.productos.filter((p) => !p.descripcion.trim()).length
  // Con un color de marca, el botón Cotizar y el filtro seleccionado lo usan los dos; sin él, cada uno su color de siempre
  const fondoCotizar = catalogo.color_acento || COTIZAR_DEFECTO
  const fondoChip = catalogo.color_acento || CHIP_DEFECTO
  const textoCotizar = catalogo.color_texto_acento || colorTextoSobre(fondoCotizar)
  const textoChip = catalogo.color_texto_acento || colorTextoSobre(fondoChip)
  const fondoCinta = catalogo.color_acento || CINTA_DEFECTO
  const textoCinta = catalogo.color_texto_acento || colorTextoSobre(fondoCinta)
  const conDescuento = catalogo.productos.filter((p) => porcentajeDescuento(p) !== null).length
  const esExcel = /\.xlsx?$/i.test(catalogo.archivo_nombre)

  /** Título, texto actual y cómo se guarda la frase que se está editando */
  function datosEditorTts(editor: EditorTts) {
    if (editor.tipo === 'entrada') {
      return {
        titulo: 'Mensaje de voz al ingresar al catálogo (Todos)',
        valor: catalogo.tts_entrada,
        guardar: (t: string) => cambiar({ tts_entrada: t }),
      }
    }
    if (editor.tipo === 'sin_descripcion') {
      return {
        titulo: 'Mensaje de voz para productos sin descripción',
        valor: catalogo.tts_sin_descripcion,
        guardar: (t: string) => cambiar({ tts_sin_descripcion: t }),
      }
    }
    return {
      titulo: `Mensaje de voz de la categoría ${editor.nombre}`,
      valor: catalogo.tts_categorias[editor.nombre] ?? '',
      guardar: (t: string) => cambiar({ tts_categorias: { ...catalogo.tts_categorias, [editor.nombre]: t } }),
    }
  }
  const tts = editorTts ? datosEditorTts(editorTts) : null

  return (
    <>
      <ModalPestanas
        titulo="Configuración del botón de catálogo"
        ayuda="Presenta los productos del archivo cargado en una cuadrícula. Al seleccionar un producto se reproduce su descripción. Tras un periodo sin interacción, el robot retoma su recorrido."
        pestanas={PESTANAS}
        activa={pestana}
        onCambiar={(id) => setPestana(id as PestanaCatalogo)}
        onCancelar={onCerrar}
        onAceptar={guardar}
        aviso={error}
      >
        {/* ───────── Diseño ───────── */}
        {pestana === 'diseno' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 font-medium text-slate-800">
                Botón habilitado
                <Ayuda>Los botones deshabilitados no se muestran en el robot.</Ayuda>
              </span>
              <Interruptor activo={catalogo.activo} onChange={(activo) => cambiar({ activo })} etiqueta="Botón habilitado" />
            </div>

            <div>
              <Titulo>Etiqueta del botón</Titulo>
              <input
                value={catalogo.boton.texto}
                maxLength={MAX_BOTON}
                onChange={(e) => cambiar({ boton: { ...catalogo.boton, texto: e.target.value.slice(0, MAX_BOTON) } })}
                className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-right text-sm text-slate-400">
                {catalogo.boton.texto.length} / {MAX_BOTON}
              </p>
            </div>

            <AparienciaBoton valor={catalogo.boton} projectId={projectId} onChange={(boton) => cambiar({ boton })} />
          </div>
        )}

        {/* ───────── Productos ───────── */}
        {pestana === 'productos' && (
          <div className="space-y-5">
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

            {/* Archivo cargado, o cómo cargarlo */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {catalogo.productos.length > 0 ? (
                <div className="flex min-w-0 items-center gap-3">
                  <IconoExcel className={`h-10 w-10 shrink-0 ${esExcel ? '' : 'grayscale'}`} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{catalogo.archivo_nombre || 'Productos'}</p>
                    <p className="text-sm text-slate-500">
                      {catalogo.productos.length} {catalogo.productos.length === 1 ? 'producto' : 'productos'}
                      {agotados > 0 && ` • ${agotados} ${agotados === 1 ? 'se mostrará' : 'se mostrarán'} como Agotado`}
                      {resultado && <span className="ml-2 font-medium text-emerald-700">· Archivo cargado; pendiente de guardar</span>}
                    </p>
                  </div>
                </div>
              ) : (
                <Titulo
                  ayuda={
                    <>
                      Descargue la plantilla, complétela con los productos del cliente y cárguela en esta sección (CSV o
                      Excel .xlsx; se lee la primera hoja). Columnas obligatorias: nombre, precio y url_imagen. Columnas
                      opcionales: stock, precio_anterior, descripcion y categoria. Un precio o stock igual a 0 se
                      muestra como «Agotado».
                    </>
                  }
                >
                  Archivo de productos
                </Titulo>
              )}
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={descargarPlantilla}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                >
                  Descargar plantilla
                </button>
                <button
                  type="button"
                  onClick={() => entradaArchivo.current?.click()}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                >
                  <IconoSubir />
                  {catalogo.productos.length > 0 ? 'Reemplazar archivo' : 'Cargar archivo'}
                </button>
              </div>
            </div>

            {errorArchivo && <Advertencia>{errorArchivo}</Advertencia>}

            {catalogo.productos.length === 0 && !errorArchivo && (
              <p className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                No se ha cargado ningún archivo. Cargue un archivo de productos para configurar categorías, colores y vista previa.
              </p>
            )}

            {catalogo.productos.length > 0 && (
              <>
                {catalogo.productos.length > PRODUCTOS_AVISO && (
                  <Advertencia>
                    El catálogo supera los 300 productos. La descarga inicial de imágenes en el robot puede tardar; se
                    recomienda validarla en el robot antes del evento.
                  </Advertencia>
                )}

                {/* Categorías */}
                <div>
                  <Titulo
                    ayuda="El ícono de edición de cada categoría define el mensaje de voz que se reproduce al ingresar a ella. «Todos» corresponde al mensaje de bienvenida del catálogo. Si una categoría no tiene mensaje, se utiliza uno genérico con su nombre."
                  >
                    Categorías a mostrar
                  </Titulo>
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3.5 pr-1.5 text-sm text-slate-600">
                      Todos
                      <BotonEditarTts
                        titulo="Editar el mensaje de voz de bienvenida"
                        onClick={() => setEditorTts({ tipo: 'entrada' })}
                      />
                    </span>
                    {categorias.map((c) => (
                      <span
                        key={c.nombre}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3.5 pr-1.5 text-sm text-slate-600"
                      >
                        {c.nombre} <span className="text-slate-400">· {c.cantidad}</span>
                        <BotonEditarTts
                          titulo={`Editar el mensaje de voz de la categoría ${c.nombre}`}
                          onClick={() => setEditorTts({ tipo: 'categoria', nombre: c.nombre })}
                        />
                      </span>
                    ))}
                  </div>
                  {categorias.length === 0 && (
                    <p className="mt-2 text-sm text-slate-500">Sin categorías: no se mostrará filtro en el robot.</p>
                  )}
                  {sinCategoria > 0 && categorias.length > 0 && (
                    <p className="mt-2 text-sm text-slate-500">{sinCategoria} {sinCategoria === 1 ? 'producto sin categoría' : 'productos sin categoría'}; solo se {sinCategoria === 1 ? 'muestra' : 'muestran'} en «Todos».</p>
                  )}

                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    {sinDescripcion > 0 && <IconoAvisoAmarillo />}
                    Productos sin descripción ({sinDescripcion})
                    <BotonEditarTts
                      titulo="Editar el mensaje de voz de los productos sin descripción"
                      onClick={() => setEditorTts({ tipo: 'sin_descripcion' })}
                    />
                    <Ayuda>
                      Mensaje de voz que se reproduce al seleccionar un producto sin descripción en el archivo. Es el
                      mismo para todos.
                    </Ayuda>
                  </p>
                </div>

                {resultado?.similares.map((grupo) => (
                  <Advertencia key={grupo.join('|')}>
                    Se detectaron categorías con escritura distinta que podrían ser la misma:{' '}
                    {grupo.map((g) => `«${g}»`).join(' y ')}. Unifique su escritura en el archivo si corresponde.
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
                    <p className="text-sm font-medium text-slate-800">Observaciones:</p>
                    {resultado.advertencias.slice(0, MAX_LISTADAS).map((a) => (
                      <Advertencia key={a}>{a}</Advertencia>
                    ))}
                    {resultado.advertencias.length > MAX_LISTADAS && (
                      <p className="text-sm text-slate-500">…y {resultado.advertencias.length - MAX_LISTADAS} más.</p>
                    )}
                  </div>
                )}

                {/* Colores de la marca y cinta de descuento */}
                <div>
                  <Titulo
                    ayuda="Se aplican al botón «Cotizar», al filtro de categoría seleccionado y a la cinta de descuento, para mantener la identidad de la marca. Si no se definen, se utilizan verde, azul oscuro y rojo, respectivamente."
                  >
                    Colores de acento
                  </Titulo>
                  <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
                    <div className="flex flex-wrap gap-x-8 gap-y-4">
                      <CampoColor
                        label="Color de fondo"
                        value={catalogo.color_acento}
                        onChange={(color_acento) => cambiar({ color_acento })}
                      />
                      <CampoColor
                        label="Color de texto"
                        value={catalogo.color_texto_acento}
                        onChange={(color_texto_acento) => cambiar({ color_texto_acento })}
                        ayuda="Si no se define, se selecciona blanco o negro según el contraste con el color de fondo."
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={catalogo.mostrar_descuento}
                        onChange={(e) => cambiar({ mostrar_descuento: e.target.checked })}
                        className="h-4 w-4 accent-[#1d293d]"
                      />
                      Mostrar porcentaje de descuento
                      <span className="text-slate-400">({conDescuento})</span>
                      <Ayuda>
                        Muestra, en la esquina de la imagen, el porcentaje de reducción del precio respecto al precio
                        anterior. Se calcula automáticamente y no se aplica a productos agotados ni a productos sin
                        precio anterior superior.
                      </Ayuda>
                    </label>
                  </div>
                </div>

                {/* Vista previa: las primeras tarjetas, como las verá el visitante */}
                <div>
                  <Titulo>Vista previa de productos</Titulo>
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
                          cinta={
                            catalogo.mostrar_descuento && !estaAgotado(p) && porcentajeDescuento(p) !== null
                              ? { texto: `-${porcentajeDescuento(p)}%`, fondo: fondoCinta, color: textoCinta }
                              : null
                          }
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ───────── Reanudar (tiempo sin tocar y despedida) ───────── */}
        {pestana === 'reanudar' && (
          <div className="space-y-5">
            <div>
              <Titulo
                ayuda={`Cada interacción en pantalla reinicia el conteo. Al cumplirse este tiempo sin interacción, el robot reproduce el mensaje de cierre y retoma su recorrido (de ${CATALOGO_INACTIVIDAD_MIN} a ${CATALOGO_INACTIVIDAD_MAX} segundos).`}
              >
                Tiempo de inactividad
              </Titulo>
              <CampoSegundos
                valor={catalogo.segundos_inactividad}
                min={CATALOGO_INACTIVIDAD_MIN}
                max={CATALOGO_INACTIVIDAD_MAX}
                defecto={30}
                onChange={(segundos_inactividad) => cambiar({ segundos_inactividad })}
              />
            </div>
            <CampoTexto
              label="Mensaje de voz de cierre"
              ayuda="Se reproduce al cumplirse el tiempo de inactividad, antes de retomar el recorrido. Si hay una interacción durante el mensaje, este se cancela y el catálogo permanece abierto."
              valor={catalogo.tts_despedida}
              max={LIMITES.TTS_MAX}
              filas={3}
              onChange={(tts_despedida) => cambiar({ tts_despedida })}
            />
          </div>
        )}

        {/* ───────── Cotizar ───────── */}
        {pestana === 'cotizar' && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 font-medium text-slate-800">
                Botón «Cotizar» por producto
                <Ayuda>
                  Muestra un código QR que abre el WhatsApp de la marca con el producto incluido en el mensaje. Permite
                  solicitar la cotización desde el celular, sin acudir al stand.
                </Ayuda>
              </span>
              <Interruptor
                activo={catalogo.cotizar_activo}
                onChange={(cotizar_activo) => cambiar({ cotizar_activo })}
                etiqueta="Botón Cotizar por producto"
              />
            </div>

            {catalogo.cotizar_activo && (
              <>
                <div>
                  <Titulo ayuda="Solo dígitos, con indicativo de país. Ejemplo: 573108676490.">
                    Número de WhatsApp de la marca
                  </Titulo>
                  <input
                    value={catalogo.whatsapp_numero}
                    inputMode="numeric"
                    placeholder="573108676490"
                    onChange={(e) => cambiar({ whatsapp_numero: e.target.value.replace(/\D/g, '').slice(0, 15) })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 font-mono focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <Titulo
                    ayuda={
                      <>
                        Utilice {'{producto}'} y {'{precio}'} para incluir el nombre y el precio del producto seleccionado.
                      </>
                    }
                  >
                    Mensaje de cotización
                  </Titulo>
                  <textarea
                    value={catalogo.whatsapp_mensaje}
                    maxLength={MAX_WA_MENSAJE}
                    rows={2}
                    onChange={(e) => cambiar({ whatsapp_mensaje: e.target.value.slice(0, MAX_WA_MENSAJE) })}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                  />
                  <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm italic text-slate-500">
                    {ejemploMensaje(catalogo.whatsapp_mensaje, catalogo.productos[0])}
                  </p>
                  <p className="mt-1 text-right text-sm text-slate-400">
                    {catalogo.whatsapp_mensaje.length} / {MAX_WA_MENSAJE} caracteres
                  </p>
                </div>

                <CampoTexto
                  label="Mensaje de voz de cotización"
                  ayuda="Se reproduce al abrir el código QR. Es el mismo para todos los productos y no incluye el nombre del producto, para que pueda almacenarse en el robot y reproducirse sin conexión."
                  valor={catalogo.tts_cotizar}
                  max={LIMITES.TTS_MAX}
                  filas={2}
                  onChange={(tts_cotizar) => cambiar({ tts_cotizar })}
                />

                <div>
                  <Titulo
                    ayuda={`Segundos que el código permanece visible (de ${CATALOGO_QR_MIN} a ${CATALOGO_QR_MAX}). Durante ese tiempo no corre el conteo de inactividad.`}
                  >
                    Duración del código QR
                  </Titulo>
                  <CampoSegundos
                    valor={catalogo.segundos_qr}
                    min={CATALOGO_QR_MIN}
                    max={CATALOGO_QR_MAX}
                    defecto={30}
                    onChange={(segundos_qr) => cambiar({ segundos_qr })}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </ModalPestanas>

      {/* Popup de una frase: va al lado del diálogo (no dentro) para quedar siempre encima */}
      {editorTts && tts && (
        <DialogTts
          titulo={tts.titulo}
          valor={tts.valor}
          maxCaracteres={LIMITES.TTS_MAX}
          onGuardar={tts.guardar}
          onCerrar={() => setEditorTts(null)}
        />
      )}
    </>
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
      <span className="text-slate-500">segundos</span>
    </div>
  )
}

/** Tarjeta reducida de la vista previa: igual que la del robot, en pequeño */
function TarjetaMini({
  producto,
  cotizar,
  fondoCotizar,
  textoCotizar,
  cinta,
}: {
  producto: ProductoCatalogo
  cotizar: boolean
  fondoCotizar: string
  textoCotizar: string
  cinta: { texto: string; fondo: string; color: string } | null
}) {
  const agotado = estaAgotado(producto)
  return (
    <div className="overflow-hidden rounded-md bg-white shadow-sm">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        {cinta && (
          <div
            className="absolute right-0 top-0 h-9 w-9"
            style={{ backgroundColor: cinta.fondo, clipPath: 'polygon(0 0, 100% 0, 100% 100%)' }}
          >
            <span
              className="absolute text-center text-[8px] font-bold leading-none"
              style={{ right: -3, top: 9, width: 28, color: cinta.color, transform: 'rotate(45deg)' }}
            >
              {cinta.texto}
            </span>
          </div>
        )}
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
