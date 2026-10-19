import { useRef, useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { Advertencia } from '../Advertencia'
import { AparienciaBoton } from './AparienciaBoton'
import { CampoTexto } from './ConfigFormulario'
import { DialogTts } from './DialogTexto'
import { CampoColor } from '../CampoColor'
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

/** Lápiz de editar, del mismo gris que el texto de categoría de las tarjetas */
function IconoEditar() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  )
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
      <IconoEditar />
    </button>
  )
}

/** Configura el botón de catálogo: productos por CSV, voces, tiempo sin tocar y cotización por WhatsApp */
export function DialogCatalogo({ valor, projectId, onGuardar, onCerrar }: DialogCatalogoProps) {
  const [catalogo, setCatalogo] = useState(() => structuredClone(valor))
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

  /** Título, texto actual y cómo se guarda la frase que se está editando */
  function datosEditorTts(editor: EditorTts) {
    if (editor.tipo === 'entrada') {
      return {
        titulo: 'Tts al entrar al catálogo (Todos)',
        valor: catalogo.tts_entrada,
        guardar: (t: string) => cambiar({ tts_entrada: t }),
      }
    }
    if (editor.tipo === 'sin_descripcion') {
      return {
        titulo: 'Tts para productos sin descripción',
        valor: catalogo.tts_sin_descripcion,
        guardar: (t: string) => cambiar({ tts_sin_descripcion: t }),
      }
    }
    return {
      titulo: `Tts para categoría ${editor.nombre}`,
      valor: catalogo.tts_categorias[editor.nombre] ?? '',
      guardar: (t: string) => cambiar({ tts_categorias: { ...catalogo.tts_categorias, [editor.nombre]: t } }),
    }
  }
  const tts = editorTts ? datosEditorTts(editorTts) : null

  return (
    <>
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
                Descarga la plantilla, llénala con los productos del cliente y cárgala aquí (CSV o Excel .xlsx, primera
                hoja). Columnas obligatorias: nombre, precio y url_imagen. Opcionales: stock, precio_anterior, descripcion
                y categoria. Precio 0 o stock 0 se muestra como "Agotado".
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
              <div className="mt-4 space-y-4 rounded-lg border border-slate-200 p-4">
                <div>
                  <p className="font-semibold text-slate-800">
                    {catalogo.productos.length} {catalogo.productos.length === 1 ? 'producto' : 'productos'}
                    {catalogo.archivo_nombre && (
                      <span className="ml-2 font-normal text-slate-500">({catalogo.archivo_nombre})</span>
                    )}
                    {resultado && <span className="ml-2 text-sm font-normal text-emerald-700">· cargado, falta guardar</span>}
                  </p>
                  {agotados > 0 && <p className="mt-1 text-xs text-slate-600">{agotados} saldrán como "Agotado".</p>}
                </div>

                {/* Todo lo de abajo es parte de los productos cargados: letra un poco más chica que el título */}
                <div className="space-y-4 text-sm">
                  {catalogo.productos.length > PRODUCTOS_AVISO && (
                    <Advertencia>
                      Son muchos productos: las imágenes se descargan en el robot la primera vez y puede tardar. Conviene
                      probarlo en el robot antes del evento.
                    </Advertencia>
                  )}

                  <div>
                    <p className="mb-1.5 flex items-center gap-2 text-xs font-medium text-slate-800">
                      Categorías detectadas
                      <Ayuda>
                        El lápiz de cada categoría edita lo que dice el robot al entrar a ella. "Todos" es lo que dice
                        al abrir el catálogo. Si dejas una categoría vacía, el robot dice una frase general con su nombre.
                      </Ayuda>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-1 text-xs text-slate-700">
                        Todos
                        <BotonEditarTts
                          titulo="Editar el tts al entrar al catálogo"
                          onClick={() => setEditorTts({ tipo: 'entrada' })}
                        />
                      </span>
                      {categorias.map((c) => (
                        <span
                          key={c.nombre}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-3 pr-1 text-xs text-slate-700"
                        >
                          {c.nombre} <span className="text-slate-400">· {c.cantidad}</span>
                          <BotonEditarTts
                            titulo={`Editar el tts de la categoría ${c.nombre}`}
                            onClick={() => setEditorTts({ tipo: 'categoria', nombre: c.nombre })}
                          />
                        </span>
                      ))}
                    </div>
                    {categorias.length === 0 && (
                      <p className="mt-1.5 text-xs text-slate-600">Sin categorías: el robot no mostrará filtro.</p>
                    )}
                    {sinCategoria > 0 && categorias.length > 0 && (
                      <p className="mt-1.5 text-xs text-slate-600">{sinCategoria} sin categoría: solo aparecen en "Todos".</p>
                    )}
                  </div>

                  <div>
                    <p className="flex items-center gap-1 text-xs font-medium text-slate-800">
                      Productos sin descripción ({sinDescripcion})
                      <BotonEditarTts
                        titulo="Editar el tts de los productos sin descripción"
                        onClick={() => setEditorTts({ tipo: 'sin_descripcion' })}
                      />
                      <Ayuda>
                        Es lo que dice el robot al tocar un producto que no trae descripción en el archivo. Es la misma
                        frase para todos.
                      </Ayuda>
                    </p>
                  </div>

                  {resultado?.similares.map((grupo) => (
                    <Advertencia key={grupo.join('|')}>
                      Estas categorías parecen la misma escrita distinto: {grupo.map((g) => `"${g}"`).join(' y ')}. Corrígelas
                      en el archivo si es así.
                    </Advertencia>
                  ))}

                  {resultado && resultado.omitidas.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-800">
                        {resultado.omitidas.length} {resultado.omitidas.length === 1 ? 'fila omitida' : 'filas omitidas'} (no
                        se cargaron):
                      </p>
                      {resultado.omitidas.slice(0, MAX_LISTADAS).map((o) => (
                        <Advertencia key={o.fila}>
                          Fila {o.fila}: {o.motivo}.
                        </Advertencia>
                      ))}
                      {resultado.omitidas.length > MAX_LISTADAS && (
                        <p className="text-xs text-slate-500">…y {resultado.omitidas.length - MAX_LISTADAS} más.</p>
                      )}
                    </div>
                  )}

                  {resultado && resultado.advertencias.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-slate-800">Para revisar:</p>
                      {resultado.advertencias.slice(0, MAX_LISTADAS).map((a) => (
                        <Advertencia key={a}>{a}</Advertencia>
                      ))}
                      {resultado.advertencias.length > MAX_LISTADAS && (
                        <p className="text-xs text-slate-500">…y {resultado.advertencias.length - MAX_LISTADAS} más.</p>
                      )}
                    </div>
                  )}

                  {/* Colores de la marca: aparecen apenas hay productos cargados */}
                  <div className="space-y-3">
                    <p className="flex items-center gap-2 text-xs font-medium text-slate-800">
                      Colores del catálogo
                      <Ayuda>
                        Se aplican al botón "Cotizar" y al filtro de categoría seleccionado, para mantener los colores de
                        la marca. Si los dejas vacíos, el botón Cotizar es verde y el filtro seleccionado oscuro.
                      </Ayuda>
                    </p>
                    <div className="grid gap-3 md:grid-cols-2">
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

                  {/* Cinta del porcentaje de descuento */}
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-800">
                    <input
                      type="checkbox"
                      checked={catalogo.mostrar_descuento}
                      onChange={(e) => cambiar({ mostrar_descuento: e.target.checked })}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    Mostrar el porcentaje de descuento ({conDescuento} {conDescuento === 1 ? 'producto' : 'productos'} con
                    descuento)
                    <Ayuda>
                      Una cinta en la esquina de la imagen con el porcentaje que baja el precio frente al precio anterior.
                      Se calcula sola y no sale en productos agotados ni sin precio anterior mayor.
                    </Ayuda>
                  </label>

                  {/* Vista previa: las primeras tarjetas, como las verá el visitante */}
                  <div>
                    <p className="mb-2 text-xs font-medium text-slate-800">Vista previa</p>
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
                </div>
              </div>
            )}
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
            <div className="mt-4">
              <CampoTexto
                label="Tts de despedida"
                ayuda="Lo dice el robot cuando se acaba el tiempo y nadie tocó la pantalla del catálogo, justo antes de volver a su ruta. Si alguien toca mientras se despide, se cancela y el catálogo sigue abierto."
                valor={catalogo.tts_despedida}
                max={LIMITES.TTS_MAX}
                filas={2}
                onChange={(tts_despedida) => cambiar({ tts_despedida })}
              />
            </div>
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
                    <Ayuda>
                      Escribe {'{producto}'} y {'{precio}'} donde deban ir el nombre y el precio del producto elegido.
                    </Ayuda>
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

                <CampoTexto
                  label="Tts de la cotización"
                  ayuda="Lo dice el robot al abrir el QR. Es la misma frase para todos los productos (sin el nombre del producto, para que se guarde en el robot y suene también sin internet)."
                  valor={catalogo.tts_cotizar}
                  max={LIMITES.TTS_MAX}
                  filas={2}
                  onChange={(tts_cotizar) => cambiar({ tts_cotizar })}
                />

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
