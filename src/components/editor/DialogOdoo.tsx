import { useEffect, useState } from 'react'
import { Modal } from '../Modal'
import { Advertencia } from '../Advertencia'
import { Ayuda } from '../Ayuda'
import { Interruptor } from '../Interruptor'
import { claveTexto, MAX_PRODUCTOS } from '../../lib/catalogo'
import {
  CANTIDAD_CATEGORIA_DEFECTO,
  categoriasOdoo,
  conectarOdoo,
  desconectarOdoo,
  FILTROS_ODOO_DEFECTO,
  leerConexion,
  nombreOrigenOdoo,
  ORDENES_ODOO,
  sincronizarOdoo,
  type CategoriaOdoo,
  type ConexionCatalogo,
  type FiltrosOdoo,
  type OrdenOdoo,
  type SincronizacionOdoo,
} from '../../lib/catalogoOdoo'
import type { ProductoCatalogo } from '../../types/config'

/** omitidos y avisos que se listan antes de decir "y N más" */
const MAX_LISTADOS = 8

const claseCampo = 'w-full rounded-lg border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:outline-none'

/**
 * Conecta el catálogo con el Odoo del cliente: dirección, base de datos y clave
 * API; luego las categorías y filtros, y «Sincronizar ahora». Los productos
 * traídos se entregan al popup del catálogo, que los guarda con «Guardar» igual
 * que un archivo cargado.
 */
export function DialogOdoo({
  projectId,
  onUsar,
  onDesconectado,
  onCerrar,
}: {
  projectId: string
  onUsar: (productos: ProductoCatalogo[], origen: string) => void
  onDesconectado: () => void
  onCerrar: () => void
}) {
  const [conexion, setConexion] = useState<ConexionCatalogo | null>(null)
  const [cargando, setCargando] = useState(true)
  const [url, setUrl] = useState('')
  const [base, setBase] = useState('')
  const [clave, setClave] = useState('')
  const [usuario, setUsuario] = useState('')
  const [categorias, setCategorias] = useState<CategoriaOdoo[] | null>(null)
  const [filtros, setFiltros] = useState<FiltrosOdoo>(FILTROS_ODOO_DEFECTO)
  const [ocupado, setOcupado] = useState<'conectando' | 'sincronizando' | 'desconectando' | null>(null)
  const [error, setError] = useState('')
  const [resultado, setResultado] = useState<SincronizacionOdoo | null>(null)
  const [confirmarDesconexion, setConfirmarDesconexion] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  async function traerCategorias() {
    try {
      setCategorias(await categoriasOdoo(projectId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  // Conexión guardada: se rellenan los campos y los filtros de la última vez
  useEffect(() => {
    let vigente = true
    leerConexion(projectId)
      .then((c) => {
        if (!vigente) return
        setConexion(c)
        if (c) {
          setUrl(c.url)
          setBase(c.base_datos)
          setFiltros({ ...FILTROS_ODOO_DEFECTO, ...c.filtros })
          categoriasOdoo(projectId)
            .then((lista) => vigente && setCategorias(lista))
            .catch((e) => vigente && setError(e instanceof Error ? e.message : String(e)))
        }
      })
      .catch((e) => vigente && setError(e instanceof Error ? e.message : String(e)))
      .finally(() => vigente && setCargando(false))
    return () => {
      vigente = false
    }
  }, [projectId])

  async function conectar() {
    setError('')
    setOcupado('conectando')
    try {
      const r = await conectarOdoo(projectId, url, base, clave)
      setUsuario(r.login ? `${r.usuario} (${r.login})` : r.usuario)
      setClave('')
      setConexion(await leerConexion(projectId))
      await traerCategorias()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  async function sincronizar() {
    setError('')
    setResultado(null)
    setOcupado('sincronizando')
    try {
      setResultado(await sincronizarOdoo(projectId, filtros))
      setConexion(await leerConexion(projectId))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setOcupado(null)
    }
  }

  async function desconectar() {
    setConfirmarDesconexion(false)
    setError('')
    setOcupado('desconectando')
    try {
      await desconectarOdoo(projectId)
      onDesconectado()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setOcupado(null)
    }
  }

  const cambiarFiltros = (cambios: Partial<FiltrosOdoo>) => {
    setFiltros((f) => ({ ...f, ...cambios }))
    setResultado(null)
  }
  const marcarCategoria = (id: number, marcada: boolean) =>
    cambiarFiltros({
      categorias: marcada ? [...filtros.categorias, id] : filtros.categorias.filter((x) => x !== id),
      cantidades: marcada
        ? { ...filtros.cantidades, [id]: filtros.cantidades[id] ?? CANTIDAD_CATEGORIA_DEFECTO }
        : filtros.cantidades,
    })
  const cantidadDe = (id: number) => filtros.cantidades[id] ?? CANTIDAD_CATEGORIA_DEFECTO
  const sumaCantidades = filtros.categorias.reduce((n, id) => n + cantidadDe(id), 0)
  const nombreCategoria = (id: number) => categorias?.find((c) => c.id === id)?.nombre ?? `Categoría ${id}`

  // Búsqueda sin importar mayúsculas ni tildes
  const textoBuscado = claveTexto(busqueda)
  const visibles = (categorias ?? []).filter((c) => !textoBuscado || claveTexto(c.nombre).includes(textoBuscado))

  // Cuántos productos trajo cada filtro, en el orden del catálogo
  const porCategoria = [
    ...(resultado?.productos ?? []).reduce(
      (m, p) => m.set(p.categoria || 'Sin categoría', (m.get(p.categoria || 'Sin categoría') ?? 0) + 1),
      new Map<string, number>(),
    ),
  ]

  const conectado = !!conexion?.clave_id
  const cambioConexion = !!conexion && (url.trim() !== conexion.url || base.trim() !== conexion.base_datos)
  const puedeConectar = url.trim() !== '' && (clave.trim() !== '' || (conectado && cambioConexion)) && !ocupado

  // El botón principal: sincroniza, y con productos traídos los usa
  let textoAceptar = 'Sincronizar ahora'
  if (ocupado === 'sincronizando') textoAceptar = 'Sincronizando…'
  else if (resultado)
    textoAceptar = `Usar ${resultado.productos.length} ${resultado.productos.length === 1 ? 'producto' : 'productos'}`

  return (
    <>
      <Modal
        titulo="Conectar con Odoo"
        ayuda="Trae los productos del catálogo directamente desde el Odoo del cliente (versión 19 o superior). La clave API se guarda cifrada en el servidor y no se vuelve a mostrar."
        ancho="max-w-2xl"
        aviso={error || undefined}
        onCancelar={onCerrar}
        onAceptar={() => {
          if (resultado) onUsar(resultado.productos, conexion ? nombreOrigenOdoo(conexion.url) : 'Odoo')
          else void sincronizar()
        }}
        aceptarDeshabilitado={
          !conectado ||
          cambioConexion ||
          !!ocupado ||
          sumaCantidades > MAX_PRODUCTOS ||
          (!!resultado && resultado.productos.length === 0)
        }
        textoAceptar={textoAceptar}
      >
        {cargando ? (
          <p className="text-slate-500">Cargando…</p>
        ) : (
          <div className="space-y-6">
            {/* ── Conexión ── */}
            <section className="space-y-3">
              <p className="font-semibold text-slate-800">1. Conexión</p>
              <label className="block">
                <span className="text-sm text-slate-600">Dirección de Odoo</span>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://empresa.odoo.com"
                  className={claseCampo}
                />
              </label>
              <label className="block">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  Base de datos
                  <Ayuda>Nombre de la base de datos de Odoo. Si el servidor tiene una sola base, puede dejarse vacío.</Ayuda>
                </span>
                <input value={base} onChange={(e) => setBase(e.target.value)} className={claseCampo} />
              </label>
              <label className="block">
                <span className="flex items-center gap-2 text-sm text-slate-600">
                  Clave API
                  <Ayuda>
                    Se genera en Odoo, en Preferencias del usuario › Seguridad de la cuenta › Claves API. Use un usuario con
                    permiso solo de lectura sobre los productos.
                  </Ayuda>
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  placeholder={conectado ? '•••••••• (guardada; escriba una nueva solo para cambiarla)' : ''}
                  className={claseCampo}
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-600">
                  {conectado && !cambioConexion
                    ? `Conectado${usuario ? ` como ${usuario}` : ''}.`
                    : conectado
                      ? 'Hay cambios en la conexión: pulse «Conectar» para probarlos.'
                      : 'Sin conectar.'}
                </p>
                <div className="flex items-center gap-2">
                  {conexion && (
                    <button
                      type="button"
                      onClick={() => setConfirmarDesconexion(true)}
                      disabled={!!ocupado}
                      className="px-3 py-2 text-sm font-medium text-rose-700 hover:underline disabled:opacity-40"
                    >
                      Desconectar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void conectar()}
                    disabled={!puedeConectar}
                    className="border border-[#1d293d] px-5 py-2 font-semibold text-[#1d293d] transition-colors hover:bg-slate-50 disabled:opacity-40"
                  >
                    {ocupado === 'conectando' ? 'Conectando…' : 'Conectar'}
                  </button>
                </div>
              </div>
            </section>

            {/* ── Filtros ── */}
            {conectado && !cambioConexion && (
              <section className="space-y-4">
                <p className="font-semibold text-slate-800">2. Productos a mostrar</p>

                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-600">
                      Categorías{' '}
                      <span className="text-slate-400">
                        (
                        {filtros.categorias.length === 0
                          ? 'todas'
                          : `${filtros.categorias.length} seleccionadas, con sus subcategorías`}
                        )
                      </span>
                    </p>
                    {filtros.categorias.length > 0 && (
                      <button
                        type="button"
                        onClick={() => cambiarFiltros({ categorias: [] })}
                        className="text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                      >
                        Quitar selección
                      </button>
                    )}
                  </div>
                  {categorias === null ? (
                    <p className="mt-2 text-sm text-slate-500">Cargando categorías…</p>
                  ) : (
                    <>
                      <input
                        type="search"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder="Buscar categoría…"
                        className={`${claseCampo} mt-2`}
                      />
                      <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 px-3 py-2">
                        {visibles.length === 0 && (
                          <p className="py-2 text-sm text-slate-500">Ninguna categoría coincide con la búsqueda.</p>
                        )}
                        {visibles.map((c) => (
                          <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
                            <input
                              type="checkbox"
                              checked={filtros.categorias.includes(c.id)}
                              onChange={(e) => marcarCategoria(c.id, e.target.checked)}
                              className="h-4 w-4 accent-[#1d293d]"
                            />
                            <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                            <span className="text-slate-400">{c.productos}</span>
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div className="flex flex-wrap gap-x-8 gap-y-3">
                  <span className="flex items-center gap-3 text-sm text-slate-700">
                    Solo con stock
                    <Interruptor
                      activo={filtros.solo_stock}
                      onChange={(v) => cambiarFiltros({ solo_stock: v })}
                      etiqueta="Solo con stock"
                    />
                  </span>
                  <span className="flex items-center gap-3 text-sm text-slate-700">
                    Solo con imagen
                    <Interruptor
                      activo={filtros.solo_imagen}
                      onChange={(v) => cambiarFiltros({ solo_imagen: v })}
                      etiqueta="Solo con imagen"
                    />
                  </span>
                </div>

                {/* Con categorías elegidas: cuántos productos trae cada una */}
                {filtros.categorias.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-600">
                      Productos por categoría{' '}
                      <span className={sumaCantidades > MAX_PRODUCTOS ? 'font-medium text-rose-700' : 'text-slate-400'}>
                        (total {sumaCantidades} de {MAX_PRODUCTOS})
                      </span>
                    </p>
                    <div className="mt-2 space-y-2">
                      {filtros.categorias.map((id) => (
                        <div key={id} className="flex items-center gap-3">
                          <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{nombreCategoria(id)}</span>
                          <input
                            type="number"
                            min={1}
                            max={MAX_PRODUCTOS}
                            value={cantidadDe(id)}
                            onChange={(e) =>
                              cambiarFiltros({
                                cantidades: {
                                  ...filtros.cantidades,
                                  [id]: Math.min(MAX_PRODUCTOS, Math.max(1, Number(e.target.value) || 1)),
                                },
                              })
                            }
                            aria-label={`Cantidad de productos de ${nombreCategoria(id)}`}
                            className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-right focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2">
                  {filtros.categorias.length === 0 && (
                    <label className="block">
                      <span className="text-sm text-slate-600">Cantidad máxima (hasta {MAX_PRODUCTOS})</span>
                      <input
                        type="number"
                        min={1}
                        max={MAX_PRODUCTOS}
                        value={filtros.maximo}
                        onChange={(e) =>
                          cambiarFiltros({
                            maximo: Math.min(MAX_PRODUCTOS, Math.max(1, Number(e.target.value) || 1)),
                          })
                        }
                        className={claseCampo}
                      />
                    </label>
                  )}
                  <label className="block">
                    <span className="text-sm text-slate-600">Orden</span>
                    <select
                      value={filtros.orden}
                      onChange={(e) => cambiarFiltros({ orden: e.target.value as OrdenOdoo })}
                      className={`${claseCampo} bg-white`}
                    >
                      {ORDENES_ODOO.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {conexion?.ultima_sincronizacion && !resultado && (
                  <p className="text-sm text-slate-500">
                    Última sincronización: {new Date(conexion.ultima_sincronizacion).toLocaleString('es-CO')}
                    {conexion.ultimo_resultado && ` · ${conexion.ultimo_resultado.productos} productos`}
                  </p>
                )}
              </section>
            )}

            {/* ── Resultado ── */}
            {ocupado === 'sincronizando' && (
              <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Trayendo productos e imágenes desde Odoo. La primera vez puede tardar hasta dos minutos…
              </p>
            )}
            {resultado && (
              <section className="space-y-2 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <p className="font-semibold text-slate-800">
                  {resultado.productos.length} {resultado.productos.length === 1 ? 'producto listo' : 'productos listos'}
                  {porCategoria.length > 1 && ` (${porCategoria.map(([nombre, n]) => `${nombre} ${n}`).join(' · ')})`}
                  {resultado.omitidos.length > 0 && ` · ${resultado.omitidos.length} omitidos`}
                  {' · '}
                  {resultado.productos.filter((p) => !p.imagen_url).length} sin imagen
                </p>
                {resultado.avisos.map((a) => (
                  <Advertencia key={a}>{a}</Advertencia>
                ))}
                {resultado.omitidos.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {resultado.omitidos.slice(0, MAX_LISTADOS).map((o, i) => (
                      <li key={`${o.nombre}-${i}`}>
                        <span className="font-medium">{o.nombre}:</span> {o.motivo}
                      </li>
                    ))}
                    {resultado.omitidos.length > MAX_LISTADOS && <li>y {resultado.omitidos.length - MAX_LISTADOS} más.</li>}
                  </ul>
                )}
                <p className="text-slate-500">
                  Al pulsar «Usar», estos productos reemplazan los del catálogo. Se aplican al robot cuando guarde el proyecto.
                </p>
              </section>
            )}
          </div>
        )}
      </Modal>

      {confirmarDesconexion && (
        <Modal
          titulo="Desconectar Odoo"
          ancho="max-w-lg"
          textoAceptar="Sí, desconectar"
          onCancelar={() => setConfirmarDesconexion(false)}
          onAceptar={() => void desconectar()}
        >
          <p className="text-slate-700">
            Se borrarán la conexión y la clave API guardada. Los productos que ya tiene el catálogo no se modifican.
          </p>
        </Modal>
      )}
    </>
  )
}
