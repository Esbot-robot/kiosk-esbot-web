import { useState, type CSSProperties } from 'react'
import type {
  AgenteConfig,
  OpcionAgente,
  ParadaRecorridoAgente,
  RecorridoAgente,
  RespuestaAgente,
  TarjetaAgente,
  ModoEscuchaAgente,
  TipoRespuestaAgente,
} from '../../types/config'

type SeccionAgente = 'contenido' | 'recorridos' | 'apariencia' | 'comportamiento'

interface AgentEditorProps {
  agente: AgenteConfig
  vistaId: string
  esPantallaInicialApp?: boolean
  videoPatrullajeUrl?: string
  onEditarVideoPatrullaje?: () => void
  onVistaChange: (vistaId: string) => void
  onChange: (agente: AgenteConfig) => void
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100'

function crearId(prefijo: string) {
  return `${prefijo}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`
}

function estiloTexto(agente: AgenteConfig): CSSProperties {
  return {
    backgroundImage: `linear-gradient(90deg, ${agente.apariencia.color_texto_inicio}, ${agente.apariencia.color_texto_fin})`,
  }
}

function estiloContorno(agente: AgenteConfig): CSSProperties {
  return {
    background: `linear-gradient(#fff, #fff) padding-box, linear-gradient(90deg, ${agente.apariencia.color_contorno_inicio}, ${agente.apariencia.color_contorno_fin}) border-box`,
    border: '2px solid transparent',
  }
}

function AgentOrb() {
  return (
    <div className="relative flex flex-col items-center">
      <div className="agent-orb" aria-label="Orbe del agente" />
      <div className="agent-orb-shadow" />
    </div>
  )
}

function BotonPreview({
  opcion,
  agente,
  onClick,
  anchoCompleto = false,
}: {
  opcion: OpcionAgente
  agente: AgenteConfig
  onClick: () => void
  anchoCompleto?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`agent-preview-button rounded-full px-6 py-3 font-bold ${
        anchoCompleto ? 'col-span-2 mx-auto w-1/2' : 'w-full'
      }`}
      style={estiloContorno(agente)}
    >
      <span className="agent-gradient-text" style={estiloTexto(agente)}>
        {opcion.texto}
      </span>
    </button>
  )
}

export function AgentPreview({
  agente,
  vistaId,
  onVistaChange,
}: Pick<AgentEditorProps, 'agente' | 'vistaId' | 'onVistaChange'>) {
  const [escuchaManualVista, setEscuchaManualVista] = useState<string | null>(null)
  const opcionesConfiguradas = [
    ...agente.opciones_iniciales,
    ...agente.respuestas.flatMap((item) => item.opciones),
  ]
  const opcionEnMovimiento = opcionesConfiguradas.find(
    (opcion) => `movimiento:${opcion.id}` === vistaId,
  )
  const paradaEnMovimiento = agente.recorridos
    .flatMap((recorrido) => recorrido.paradas)
    .find((parada) => `movimiento-parada:${parada.id}` === vistaId)
  const textoMovimiento =
    opcionEnMovimiento?.texto_movimiento ?? paradaEnMovimiento?.texto_movimiento

  if (textoMovimiento !== undefined) {
    return (
      <div className="relative flex aspect-[16/9] w-full max-w-4xl items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white px-[8%] shadow-[0_22px_55px_rgba(30,41,59,0.15)]">
        {!agente.activo && (
          <div className="absolute inset-x-0 top-0 bg-slate-900/90 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white">
            Agente desactivado
          </div>
        )}
        <p
          className="agent-gradient-text max-w-[90%] text-center text-[clamp(24px,3.2vw,48px)] font-bold leading-tight"
          style={estiloTexto(agente)}
        >
          {textoMovimiento || 'Escribe el texto que se mostrara durante el desplazamiento'}
        </p>
      </div>
    )
  }

  const respuesta = agente.respuestas.find((item) => item.id === vistaId)
  const esInicio = vistaId === 'inicio' || !respuesta
  const mensaje = esInicio ? agente.mensaje_inicial : respuesta.mensaje
  const opciones = esInicio ? agente.opciones_iniciales : respuesta.tipo === 'opciones' ? respuesta.opciones : []
  const tarjetas = !esInicio && respuesta.tipo === 'tarjetas' ? respuesta.tarjetas : []
  const modoEscucha = esInicio ? agente.modo_escucha_inicial : respuesta.modo_escucha
  const escuchaManualActiva = escuchaManualVista === vistaId

  function abrirOpcion(opcion: OpcionAgente) {
    if (
      opcion.accion === 'mostrar_respuesta' &&
      agente.respuestas.some((item) => item.id === opcion.destino)
    ) {
      onVistaChange(opcion.destino)
      return
    }
    if (opcion.accion === 'ir_ubicacion') {
      onVistaChange(`movimiento:${opcion.id}`)
      return
    }
    if (opcion.accion === 'iniciar_recorrido') {
      const recorrido = agente.recorridos.find((item) => item.id === opcion.destino)
      const primeraParada = recorrido?.paradas[0]
      if (primeraParada) onVistaChange(`movimiento-parada:${primeraParada.id}`)
    }
  }

  return (
    <div className="relative aspect-[16/9] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_55px_rgba(30,41,59,0.15)]">
      {!agente.activo && (
        <div className="absolute inset-x-0 top-0 z-20 bg-slate-900/90 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.2em] text-white">
          Agente desactivado
        </div>
      )}

      <div className="flex h-full flex-col items-center px-[3.5%] pb-[3%] pt-[4%]">
        <AgentOrb />

        <div className="mt-[4%] flex min-h-0 w-full flex-1 flex-col items-center">
          <p
            className={`agent-gradient-text max-w-[92%] text-center font-bold leading-tight ${
              !esInicio && respuesta.tipo === 'texto'
                ? 'mt-[1%] text-[clamp(18px,2.3vw,34px)]'
                : 'text-[clamp(18px,2vw,31px)]'
            }`}
            style={estiloTexto(agente)}
          >
            {mensaje || 'Escribe el mensaje que mostrara el agente'}
          </p>

          {opciones.length > 0 && (
            <div className="mt-auto grid w-[82%] grid-cols-2 gap-x-[8%] gap-y-3">
              {opciones.slice(0, 3).map((opcion, index) => (
                <BotonPreview
                  key={opcion.id}
                  opcion={opcion}
                  agente={agente}
                  anchoCompleto={index === 2 && opciones.length === 3}
                  onClick={() => abrirOpcion(opcion)}
                />
              ))}
            </div>
          )}

          {tarjetas.length > 0 && (
            <div className="mt-auto grid w-full grid-cols-3 gap-[4%]">
              {tarjetas.slice(0, 3).map((tarjeta) => (
                <div
                  key={tarjeta.id}
                  className="flex min-h-32 flex-col items-center justify-center rounded-[22px] px-4 py-4 text-center"
                  style={estiloContorno(agente)}
                >
                  <p
                    className="agent-gradient-text text-[clamp(17px,2vw,30px)] font-bold leading-tight"
                    style={estiloTexto(agente)}
                  >
                    {tarjeta.titulo || 'Titulo'}
                  </p>
                  {tarjeta.subtitulo && (
                    <p
                      className="agent-gradient-text mt-1 text-[clamp(11px,1.2vw,18px)]"
                      style={estiloTexto(agente)}
                    >
                      {tarjeta.subtitulo}
                    </p>
                  )}
                  <p
                    className="agent-gradient-text mt-2 text-[clamp(10px,1vw,15px)] font-semibold"
                    style={estiloTexto(agente)}
                  >
                    {tarjeta.etiqueta}
                  </p>
                  <p
                    className="agent-gradient-text text-[clamp(16px,1.8vw,27px)] font-bold"
                    style={estiloTexto(agente)}
                  >
                    {tarjeta.precio || 'Precio'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {(modoEscucha === 'automatico' || escuchaManualActiva) && (
            <p
              className="agent-gradient-text mt-auto pt-[4%] text-[clamp(15px,1.7vw,26px)] font-bold"
              style={estiloTexto(agente)}
            >
              {agente.texto_escucha}
            </p>
          )}

          {modoEscucha === 'por_boton' && !escuchaManualActiva && (
            <button
              type="button"
              onClick={() => setEscuchaManualVista(vistaId)}
              className="agent-preview-button mt-auto w-[44%] rounded-full px-6 py-3 font-bold"
              style={estiloContorno(agente)}
            >
              <span className="agent-gradient-text" style={estiloTexto(agente)}>
                {esInicio
                  ? agente.texto_boton_escucha_inicial
                  : respuesta.texto_boton_escucha}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-400">{value}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent"
        />
      </span>
    </label>
  )
}

function SelectorModoEscucha({
  valor,
  textoBoton,
  mensajeDespedida,
  automaticoDeshabilitado = false,
  onChange,
  onTextoBotonChange,
  onMensajeDespedidaChange,
}: {
  valor: ModoEscuchaAgente
  textoBoton: string
  mensajeDespedida: string
  automaticoDeshabilitado?: boolean
  onChange: (valor: ModoEscuchaAgente) => void
  onTextoBotonChange: (valor: string) => void
  onMensajeDespedidaChange: (valor: string) => void
}) {
  const opciones: {
    valor: ModoEscuchaAgente
    titulo: string
    detalle: string
  }[] = [
    {
      valor: 'automatico',
      titulo: 'Escuchar automáticamente',
      detalle: 'Activa el micrófono al terminar de hablar.',
    },
    {
      valor: 'por_boton',
      titulo: 'Escuchar al tocar un botón',
      detalle: 'Espera a que el visitante solicite hablar.',
    },
    {
      valor: 'finalizar',
      titulo: 'Finalizar conversación',
      detalle: 'Dice una despedida, cierra el agente y reanuda la ruta con video.',
    },
  ]

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">
        Después de que Temi termine de hablar
      </p>
      <div className="space-y-2">
        {opciones.map((opcion) => {
          const deshabilitada = opcion.valor === 'automatico' && automaticoDeshabilitado
          const detalle = deshabilitada
            ? 'No disponible en la pantalla inicial de la aplicación.'
            : opcion.detalle
          return (
            <label
              key={opcion.valor}
              className={`flex items-start gap-3 rounded-xl border px-3 py-3 transition ${
                deshabilitada ? 'cursor-not-allowed bg-slate-50 opacity-60' : 'cursor-pointer'
              } ${
                valor === opcion.valor
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-slate-200 bg-white hover:border-indigo-200'
              }`}
            >
              <input
                type="radio"
                name="modo_escucha"
                disabled={deshabilitada}
                checked={valor === opcion.valor}
                onChange={() => onChange(opcion.valor)}
                className="mt-1 accent-indigo-600"
              />
              <span>
                <span className="block text-sm font-semibold text-slate-800">
                  {opcion.titulo}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                  {detalle}
                </span>
              </span>
            </label>
          )
        })}
      </div>

      {valor === 'por_boton' && (
        <label className="mt-3 block rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Texto del botón
          </span>
          <input
            value={textoBoton}
            onChange={(event) => onTextoBotonChange(event.target.value)}
            className={inputClass}
            placeholder="Preguntar otra cosa"
          />
        </label>
      )}

      {valor === 'finalizar' && (
        <label className="mt-3 block rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Mensaje de despedida (solo voz)
          </span>
          <textarea
            value={mensajeDespedida}
            onChange={(event) => onMensajeDespedidaChange(event.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Gracias por visitarnos."
          />
          <span className="mt-2 block text-xs leading-relaxed text-slate-500">
            Después de decir el mensaje en pantalla, Temi esperará 5 segundos, dirá esta despedida
            solo por voz y luego reanudará la ruta con video.
          </span>
        </label>
      )}
    </div>
  )
}

function EditorOpcion({
  opcion,
  respuestas,
  recorridos,
  onChange,
  onDelete,
  onPreviewMovement,
}: {
  opcion: OpcionAgente
  respuestas: RespuestaAgente[]
  recorridos: RecorridoAgente[]
  onChange: (opcion: OpcionAgente) => void
  onDelete: () => void
  onPreviewMovement: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex gap-2">
        <input
          value={opcion.texto}
          onChange={(event) => onChange({ ...opcion, texto: event.target.value })}
          className={inputClass}
          placeholder="Texto del boton"
        />
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg px-2 text-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          title="Eliminar opcion"
        >
          ×
        </button>
      </div>
      <div className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={opcion.accion}
            onChange={(event) =>
              onChange({
                ...opcion,
                accion: event.target.value as OpcionAgente['accion'],
                destino: '',
              })
            }
            className={inputClass}
          >
            <option value="mostrar_respuesta">Mostrar respuesta</option>
            <option value="ir_ubicacion">Ir a ubicacion</option>
            <option value="iniciar_recorrido">Iniciar recorrido</option>
            <option value="respuesta_libre">Enviar esta opción al agente</option>
          </select>

          {opcion.accion === 'mostrar_respuesta' && (
            <select
              value={opcion.destino}
              onChange={(event) => onChange({ ...opcion, destino: event.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar...</option>
              {respuestas.map((respuesta) => (
                <option key={respuesta.id} value={respuesta.id}>
                  {respuesta.nombre}
                </option>
              ))}
            </select>
          )}

          {opcion.accion === 'ir_ubicacion' && (
            <input
              value={opcion.destino}
              onChange={(event) => onChange({ ...opcion, destino: event.target.value })}
              className={inputClass}
              placeholder="Ubicacion exacta en Temi"
            />
          )}

          {opcion.accion === 'iniciar_recorrido' && (
            <select
              value={opcion.destino}
              onChange={(event) => onChange({ ...opcion, destino: event.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar recorrido...</option>
              {recorridos.map((recorrido) => (
                <option key={recorrido.id} value={recorrido.id}>
                  {recorrido.nombre}
                </option>
              ))}
            </select>
          )}
        </div>

        {opcion.accion === 'ir_ubicacion' && (
          <div className="space-y-2 rounded-lg border border-indigo-100 bg-white p-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Texto mientras el robot se mueve
              </span>
              <textarea
                value={opcion.texto_movimiento}
                onChange={(event) =>
                  onChange({ ...opcion, texto_movimiento: event.target.value })
                }
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="Ej. Acompañame, vamos hacia la recepcion"
              />
              <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                Se muestra durante el trayecto y Temi lo dice una sola vez al iniciar el
                desplazamiento.
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-600">
                Al llegar
              </span>
              <select
                value={opcion.respuesta_al_llegar}
                onChange={(event) =>
                  onChange({ ...opcion, respuesta_al_llegar: event.target.value })
                }
                className={inputClass}
              >
                <option value="">Permanecer en la pantalla</option>
                {respuestas.map((respuesta) => (
                  <option key={respuesta.id} value={respuesta.id}>
                    Mostrar: {respuesta.nombre}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={onPreviewMovement}
              className="w-full rounded-lg border border-indigo-200 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
            >
              Ver pantalla de desplazamiento
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function EditorTarjeta({
  tarjeta,
  onChange,
  onDelete,
}: {
  tarjeta: TarjetaAgente
  onChange: (tarjeta: TarjetaAgente) => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Tarjeta</span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-2 text-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          title="Eliminar tarjeta"
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={tarjeta.titulo}
          onChange={(event) => onChange({ ...tarjeta, titulo: event.target.value })}
          className={inputClass}
          placeholder="Titulo"
        />
        <input
          value={tarjeta.subtitulo}
          onChange={(event) => onChange({ ...tarjeta, subtitulo: event.target.value })}
          className={inputClass}
          placeholder="Subtitulo"
        />
        <input
          value={tarjeta.etiqueta}
          onChange={(event) => onChange({ ...tarjeta, etiqueta: event.target.value })}
          className={inputClass}
          placeholder="Etiqueta"
        />
        <input
          value={tarjeta.precio}
          onChange={(event) => onChange({ ...tarjeta, precio: event.target.value })}
          className={inputClass}
          placeholder="Precio"
        />
      </div>
    </div>
  )
}

function EditorParada({
  parada,
  indice,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  onPreviewMovement,
}: {
  parada: ParadaRecorridoAgente
  indice: number
  total: number
  onChange: (parada: ParadaRecorridoAgente) => void
  onDelete: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onPreviewMovement: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Parada {indice + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={indice === 0}
            className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-30"
          >
            Subir
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={indice === total - 1}
            className="rounded px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-white disabled:opacity-30"
          >
            Bajar
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded px-2 py-1 text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
            title="Eliminar parada"
          >
            ×
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Ubicación exacta en Temi
          </span>
          <input
            value={parada.ubicacion}
            onChange={(event) => onChange({ ...parada, ubicacion: event.target.value })}
            className={inputClass}
            placeholder="Ej. zona_productos"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Texto mientras se desplaza
          </span>
          <textarea
            value={parada.texto_movimiento}
            onChange={(event) =>
              onChange({ ...parada, texto_movimiento: event.target.value })
            }
            rows={2}
            className={`${inputClass} resize-none`}
            placeholder="Ej. Vamos a conocer la zona de productos"
          />
          <span className="mt-1 block text-xs leading-relaxed text-slate-500">
            Se muestra durante el trayecto y Temi lo dice una sola vez al iniciar esta parada.
          </span>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-600">
            Referencia que dirá al llegar
          </span>
          <textarea
            value={parada.mensaje_llegada}
            onChange={(event) =>
              onChange({ ...parada, mensaje_llegada: event.target.value })
            }
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Ej. En este punto puedes conocer nuestros productos..."
          />
        </label>
        <button
          type="button"
          onClick={onPreviewMovement}
          className="w-full rounded-lg border border-indigo-200 py-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50"
        >
          Ver pantalla de desplazamiento
        </button>
      </div>
    </div>
  )
}

export function AgentPanel({
  agente,
  vistaId,
  esPantallaInicialApp = false,
  videoPatrullajeUrl,
  onEditarVideoPatrullaje,
  onVistaChange,
  onChange,
}: AgentEditorProps) {
  const [seccion, setSeccion] = useState<SeccionAgente>('contenido')
  const [recorridoId, setRecorridoId] = useState(agente.recorridos[0]?.id ?? '')
  const respuesta = agente.respuestas.find((item) => item.id === vistaId)
  const opcionesConfiguradas = [
    ...agente.opciones_iniciales,
    ...agente.respuestas.flatMap((item) => item.opciones),
  ]
  const opcionEnMovimiento = opcionesConfiguradas.find(
    (opcion) => `movimiento:${opcion.id}` === vistaId,
  )
  const paradaEnMovimiento = agente.recorridos
    .flatMap((recorrido) => recorrido.paradas)
    .find((parada) => `movimiento-parada:${parada.id}` === vistaId)
  const esVistaMovimiento = !!opcionEnMovimiento || !!paradaEnMovimiento
  const esInicio = vistaId === 'inicio'
  const recorrido = agente.recorridos.find((item) => item.id === recorridoId) ?? agente.recorridos[0]

  function actualizarRespuesta(cambios: Partial<RespuestaAgente>) {
    if (!respuesta) return
    onChange({
      ...agente,
      respuestas: agente.respuestas.map((item) =>
        item.id === respuesta.id ? { ...item, ...cambios } : item,
      ),
    })
  }

  function actualizarOpcionInicial(id: string, opcion: OpcionAgente) {
    onChange({
      ...agente,
      opciones_iniciales: agente.opciones_iniciales.map((item) => (item.id === id ? opcion : item)),
    })
  }

  function agregarRespuesta() {
    const id = crearId('respuesta')
    onChange({
      ...agente,
      respuestas: [
        ...agente.respuestas,
        {
          id,
          nombre: 'Nueva respuesta',
          tipo: 'texto',
          mensaje: 'Escribe aqui la respuesta del agente',
          modo_escucha: 'automatico',
          texto_boton_escucha: 'Preguntar otra cosa',
          mensaje_despedida: '',
          opciones: [],
          tarjetas: [],
        },
      ],
    })
    onVistaChange(id)
  }

  function eliminarRespuesta() {
    if (!respuesta) return
    onChange({
      ...agente,
      respuestas: agente.respuestas.filter((item) => item.id !== respuesta.id),
    })
    onVistaChange('inicio')
  }

  function actualizarRecorrido(cambios: Partial<RecorridoAgente>) {
    if (!recorrido) return
    onChange({
      ...agente,
      recorridos: agente.recorridos.map((item) =>
        item.id === recorrido.id ? { ...item, ...cambios } : item,
      ),
    })
  }

  function agregarRecorrido() {
    const id = crearId('recorrido')
    const nuevo: RecorridoAgente = {
      id,
      nombre: 'Nuevo recorrido',
      paradas: [
        {
          id: crearId('parada'),
          ubicacion: '',
          texto_movimiento: 'Acompañame, vamos hacia el primer punto',
          mensaje_llegada: 'Hemos llegado al primer punto del recorrido.',
        },
      ],
      respuesta_final_id: '',
      mensaje_reanudacion: 'Gracias por acompañarme. Continuemos nuestro recorrido.',
    }
    onChange({ ...agente, recorridos: [...agente.recorridos, nuevo] })
    setRecorridoId(id)
    setSeccion('recorridos')
  }

  function eliminarRecorrido() {
    if (!recorrido) return
    const restantes = agente.recorridos.filter((item) => item.id !== recorrido.id)
    onChange({ ...agente, recorridos: restantes })
    setRecorridoId(restantes[0]?.id ?? '')
    onVistaChange('inicio')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Agente IA</h3>
          <p className="mt-1 text-sm text-slate-500">Configura lo que vera el visitante.</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({ ...agente, activo: !agente.activo })}
          className={`relative h-7 w-12 rounded-full transition ${
            agente.activo ? 'bg-indigo-600' : 'bg-slate-300'
          }`}
          aria-label={agente.activo ? 'Desactivar agente' : 'Activar agente'}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
              agente.activo ? 'left-6' : 'left-1'
            }`}
          />
        </button>
      </div>

      <div className="grid grid-cols-4 rounded-xl bg-slate-100 p-1">
        {(
          [
            ['contenido', 'Contenido'],
            ['recorridos', 'Recorridos'],
            ['apariencia', 'Apariencia'],
            ['comportamiento', 'Agente'],
          ] as const
        ).map(([valor, label]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setSeccion(valor)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
              seccion === valor ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {seccion === 'contenido' && (
        <>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Pantalla mostrada</span>
            <select
              value={vistaId}
              onChange={(event) => onVistaChange(event.target.value)}
              className={inputClass}
            >
              <option value="inicio">Pantalla inicial</option>
              {agente.respuestas.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nombre}
                </option>
              ))}
              {opcionesConfiguradas.some((item) => item.accion === 'ir_ubicacion') && (
                <optgroup label="Desplazamientos directos">
                  {opcionesConfiguradas
                    .filter((item) => item.accion === 'ir_ubicacion')
                    .map((opcion) => (
                      <option key={opcion.id} value={`movimiento:${opcion.id}`}>
                        Hacia: {opcion.texto}
                      </option>
                    ))}
                </optgroup>
              )}
              {agente.recorridos.some((item) => item.paradas.length > 0) && (
                <optgroup label="Paradas de recorridos">
                  {agente.recorridos.flatMap((item) =>
                    item.paradas.map((parada, index) => (
                      <option
                        key={parada.id}
                        value={`movimiento-parada:${parada.id}`}
                      >
                        {item.nombre}: parada {index + 1}
                      </option>
                    )),
                  )}
                </optgroup>
              )}
            </select>
          </label>

          {esVistaMovimiento ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-relaxed text-sky-800">
                Esta pantalla aparece únicamente mientras Temi se desplaza. No muestra el orbe y
                no activa el micrófono.
              </div>
              {opcionEnMovimiento && (
                <EditorOpcion
                  opcion={opcionEnMovimiento}
                  respuestas={agente.respuestas}
                  recorridos={agente.recorridos}
                  onChange={(valor) => {
                    const esInicial = agente.opciones_iniciales.some(
                      (item) => item.id === opcionEnMovimiento.id,
                    )
                    if (esInicial) {
                      actualizarOpcionInicial(opcionEnMovimiento.id, valor)
                      return
                    }
                    onChange({
                      ...agente,
                      respuestas: agente.respuestas.map((item) => ({
                        ...item,
                        opciones: item.opciones.map((opcion) =>
                          opcion.id === opcionEnMovimiento.id ? valor : opcion,
                        ),
                      })),
                    })
                  }}
                  onDelete={() => onVistaChange('inicio')}
                  onPreviewMovement={() =>
                    onVistaChange(`movimiento:${opcionEnMovimiento.id}`)
                  }
                />
              )}
              {paradaEnMovimiento && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">
                      Texto mientras se desplaza
                    </span>
                    <textarea
                      value={paradaEnMovimiento.texto_movimiento}
                      onChange={(event) =>
                        onChange({
                          ...agente,
                          recorridos: agente.recorridos.map((item) => ({
                            ...item,
                            paradas: item.paradas.map((parada) =>
                              parada.id === paradaEnMovimiento.id
                                ? { ...parada, texto_movimiento: event.target.value }
                                : parada,
                            ),
                          })),
                        })
                      }
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                    <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                      Temi lo dice una sola vez al iniciar esta parada.
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setSeccion('recorridos')}
                    className="mt-3 w-full rounded-lg border border-indigo-200 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50"
                  >
                    Editar recorrido completo
                  </button>
                </div>
              )}
            </div>
          ) : esInicio ? (
            <div className="space-y-4">
              {esPantallaInicialApp && onEditarVideoPatrullaje && (
                <button
                  type="button"
                  onClick={onEditarVideoPatrullaje}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                      <path d="M8 5.5v13l10-6.5-10-6.5Z" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">
                      Video para patrullaje
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {videoPatrullajeUrl ? 'Video cargado' : 'Vacío'}
                    </span>
                  </span>
                </button>
              )}

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Mensaje inicial</span>
                <textarea
                  value={agente.mensaje_inicial}
                  onChange={(event) => onChange({ ...agente, mensaje_inicial: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </label>

              <SelectorModoEscucha
                valor={agente.modo_escucha_inicial}
                textoBoton={agente.texto_boton_escucha_inicial}
                mensajeDespedida={agente.mensaje_despedida_inicial}
                automaticoDeshabilitado={esPantallaInicialApp}
                onChange={(modo_escucha_inicial) =>
                  onChange({ ...agente, modo_escucha_inicial })
                }
                onTextoBotonChange={(texto_boton_escucha_inicial) =>
                  onChange({ ...agente, texto_boton_escucha_inicial })
                }
                onMensajeDespedidaChange={(mensaje_despedida_inicial) =>
                  onChange({ ...agente, mensaje_despedida_inicial })
                }
              />

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Botones iniciales</span>
                  <span className="text-xs text-slate-400">Maximo 3</span>
                </div>
                <div className="space-y-2">
                  {agente.opciones_iniciales.map((opcion) => (
                    <EditorOpcion
                      key={opcion.id}
                      opcion={opcion}
                      respuestas={agente.respuestas}
                      recorridos={agente.recorridos}
                      onChange={(valor) => actualizarOpcionInicial(opcion.id, valor)}
                      onPreviewMovement={() => onVistaChange(`movimiento:${opcion.id}`)}
                      onDelete={() =>
                        onChange({
                          ...agente,
                          opciones_iniciales: agente.opciones_iniciales.filter(
                            (item) => item.id !== opcion.id,
                          ),
                        })
                      }
                    />
                  ))}
                </div>
                {agente.opciones_iniciales.length < 3 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...agente,
                        opciones_iniciales: [
                          ...agente.opciones_iniciales,
                          {
                            id: crearId('inicio'),
                            texto: 'Nueva opcion',
                            accion: 'respuesta_libre',
                            destino: '',
                            texto_movimiento: '',
                            respuesta_al_llegar: '',
                          },
                        ],
                      })
                    }
                    className="mt-2 w-full rounded-lg border border-dashed border-indigo-300 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                  >
                    + Agregar boton
                  </button>
                )}
              </div>
            </div>
          ) : respuesta ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_132px] gap-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Nombre interno</span>
                  <input
                    value={respuesta.nombre}
                    onChange={(event) => actualizarRespuesta({ nombre: event.target.value })}
                    className={inputClass}
                  />
                </label>
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-700">Formato</span>
                  <select
                    value={respuesta.tipo}
                    onChange={(event) =>
                      actualizarRespuesta({ tipo: event.target.value as TipoRespuestaAgente })
                    }
                    className={inputClass}
                  >
                    <option value="texto">Texto</option>
                    <option value="opciones">Opciones</option>
                    <option value="tarjetas">Tarjetas</option>
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Mensaje en pantalla
                </span>
                <textarea
                  value={respuesta.mensaje}
                  onChange={(event) => actualizarRespuesta({ mensaje: event.target.value })}
                  rows={3}
                  className={`${inputClass} resize-none`}
                />
              </label>

              <SelectorModoEscucha
                valor={respuesta.modo_escucha}
                textoBoton={respuesta.texto_boton_escucha}
                mensajeDespedida={respuesta.mensaje_despedida}
                onChange={(modo_escucha) => actualizarRespuesta({ modo_escucha })}
                onTextoBotonChange={(texto_boton_escucha) =>
                  actualizarRespuesta({ texto_boton_escucha })
                }
                onMensajeDespedidaChange={(mensaje_despedida) =>
                  actualizarRespuesta({ mensaje_despedida })
                }
              />

              {respuesta.tipo === 'opciones' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Opciones</span>
                    <span className="text-xs text-slate-400">Maximo 3</span>
                  </div>
                  <div className="space-y-2">
                    {respuesta.opciones.map((opcion) => (
                      <EditorOpcion
                        key={opcion.id}
                        opcion={opcion}
                        respuestas={agente.respuestas}
                        recorridos={agente.recorridos}
                        onPreviewMovement={() => onVistaChange(`movimiento:${opcion.id}`)}
                        onChange={(valor) =>
                          actualizarRespuesta({
                            opciones: respuesta.opciones.map((item) =>
                              item.id === opcion.id ? valor : item,
                            ),
                          })
                        }
                        onDelete={() =>
                          actualizarRespuesta({
                            opciones: respuesta.opciones.filter((item) => item.id !== opcion.id),
                          })
                        }
                      />
                    ))}
                  </div>
                  {respuesta.opciones.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        actualizarRespuesta({
                          opciones: [
                            ...respuesta.opciones,
                            {
                              id: crearId('opcion'),
                              texto: 'Nueva opcion',
                              accion: 'respuesta_libre',
                              destino: '',
                              texto_movimiento: '',
                              respuesta_al_llegar: '',
                            },
                          ],
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-dashed border-indigo-300 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                    >
                      + Agregar opcion
                    </button>
                  )}
                </div>
              )}

              {respuesta.tipo === 'tarjetas' && (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-700">Tarjetas</span>
                    <span className="text-xs text-slate-400">Maximo 3</span>
                  </div>
                  <div className="space-y-2">
                    {respuesta.tarjetas.map((tarjeta) => (
                      <EditorTarjeta
                        key={tarjeta.id}
                        tarjeta={tarjeta}
                        onChange={(valor) =>
                          actualizarRespuesta({
                            tarjetas: respuesta.tarjetas.map((item) =>
                              item.id === tarjeta.id ? valor : item,
                            ),
                          })
                        }
                        onDelete={() =>
                          actualizarRespuesta({
                            tarjetas: respuesta.tarjetas.filter((item) => item.id !== tarjeta.id),
                          })
                        }
                      />
                    ))}
                  </div>
                  {respuesta.tarjetas.length < 3 && (
                    <button
                      type="button"
                      onClick={() =>
                        actualizarRespuesta({
                          tarjetas: [
                            ...respuesta.tarjetas,
                            {
                              id: crearId('tarjeta'),
                              titulo: 'Nuevo plan',
                              subtitulo: '',
                              etiqueta: 'Desde',
                              precio: '$0/mes',
                            },
                          ],
                        })
                      }
                      className="mt-2 w-full rounded-lg border border-dashed border-indigo-300 py-2 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-50"
                    >
                      + Agregar tarjeta
                    </button>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={eliminarRespuesta}
                className="w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Eliminar esta respuesta
              </button>
            </div>
          ) : null}

          <button
            type="button"
            onClick={agregarRespuesta}
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            + Nueva respuesta
          </button>
        </>
      )}

      {seccion === 'recorridos' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm leading-relaxed text-indigo-800">
            Temi recorrerá las paradas en orden. Durante el movimiento no escuchará; al llegar
            pronunciará la referencia y continuará con la siguiente parada.
          </div>

          <div className="flex gap-2">
            <select
              value={recorrido?.id ?? ''}
              onChange={(event) => setRecorridoId(event.target.value)}
              className={inputClass}
              disabled={agente.recorridos.length === 0}
            >
              {agente.recorridos.length === 0 ? (
                <option value="">No hay recorridos</option>
              ) : (
                agente.recorridos.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nombre}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={agregarRecorrido}
              className="shrink-0 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
            >
              + Nuevo
            </button>
          </div>

          {recorrido && (
            <>
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Nombre del recorrido
                </span>
                <input
                  value={recorrido.nombre}
                  onChange={(event) => actualizarRecorrido({ nombre: event.target.value })}
                  className={inputClass}
                  placeholder="Ej. Conocer el stand"
                />
              </label>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-700">Paradas</span>
                  <span className="text-xs text-slate-400">{recorrido.paradas.length} configuradas</span>
                </div>
                <div className="space-y-3">
                  {recorrido.paradas.map((parada, indice) => (
                    <EditorParada
                      key={parada.id}
                      parada={parada}
                      indice={indice}
                      total={recorrido.paradas.length}
                      onChange={(valor) =>
                        actualizarRecorrido({
                          paradas: recorrido.paradas.map((item) =>
                            item.id === parada.id ? valor : item,
                          ),
                        })
                      }
                      onDelete={() =>
                        actualizarRecorrido({
                          paradas: recorrido.paradas.filter((item) => item.id !== parada.id),
                        })
                      }
                      onMoveUp={() => {
                        const paradas = [...recorrido.paradas]
                        ;[paradas[indice - 1], paradas[indice]] = [
                          paradas[indice],
                          paradas[indice - 1],
                        ]
                        actualizarRecorrido({ paradas })
                      }}
                      onMoveDown={() => {
                        const paradas = [...recorrido.paradas]
                        ;[paradas[indice], paradas[indice + 1]] = [
                          paradas[indice + 1],
                          paradas[indice],
                        ]
                        actualizarRecorrido({ paradas })
                      }}
                      onPreviewMovement={() =>
                        onVistaChange(`movimiento-parada:${parada.id}`)
                      }
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    actualizarRecorrido({
                      paradas: [
                        ...recorrido.paradas,
                        {
                          id: crearId('parada'),
                          ubicacion: '',
                          texto_movimiento: 'Acompañame, vamos hacia el siguiente punto',
                          mensaje_llegada: 'Hemos llegado a este punto del recorrido.',
                        },
                      ],
                    })
                  }
                  className="mt-2 w-full rounded-lg border border-dashed border-indigo-300 py-2 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
                >
                  + Agregar parada
                </button>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">
                  Al terminar el recorrido
                </span>
                <select
                  value={recorrido.respuesta_final_id}
                  onChange={(event) =>
                    actualizarRecorrido({ respuesta_final_id: event.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">Reanudar patrullaje</option>
                  {agente.respuestas.map((item) => (
                    <option key={item.id} value={item.id}>
                      Mostrar: {item.nombre}
                    </option>
                  ))}
                </select>
              </label>

              {recorrido.respuesta_final_id === '' && (
                <label className="block rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">
                    Mensaje antes de reanudar el patrullaje
                  </span>
                  <textarea
                    value={recorrido.mensaje_reanudacion}
                    onChange={(event) =>
                      actualizarRecorrido({ mensaje_reanudacion: event.target.value })
                    }
                    rows={2}
                    className={`${inputClass} resize-none`}
                    placeholder="Gracias por acompañarme. Continuemos nuestro recorrido."
                  />
                  <span className="mt-2 block text-xs leading-relaxed text-slate-500">
                    Temi mostrará y dirá únicamente este mensaje, sin activar la escucha. Después
                    volverá a la pantalla inicial general y reanudará la ruta con video.
                  </span>
                </label>
              )}

              <button
                type="button"
                onClick={eliminarRecorrido}
                className="w-full rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Eliminar recorrido
              </button>
            </>
          )}
        </div>
      )}

      {seccion === 'apariencia' && (
        <div className="space-y-5">
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
            El fondo, el orbe, la tipografia y la distribucion permanecen fijos para conservar el
            diseño del agente.
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Degradado de textos</p>
            <div className="space-y-2">
              <ColorField
                label="Color inicial"
                value={agente.apariencia.color_texto_inicio}
                onChange={(color_texto_inicio) =>
                  onChange({
                    ...agente,
                    apariencia: { ...agente.apariencia, color_texto_inicio },
                  })
                }
              />
              <ColorField
                label="Color final"
                value={agente.apariencia.color_texto_fin}
                onChange={(color_texto_fin) =>
                  onChange({
                    ...agente,
                    apariencia: { ...agente.apariencia, color_texto_fin },
                  })
                }
              />
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Degradado de contornos
            </p>
            <div className="space-y-2">
              <ColorField
                label="Color inicial"
                value={agente.apariencia.color_contorno_inicio}
                onChange={(color_contorno_inicio) =>
                  onChange({
                    ...agente,
                    apariencia: { ...agente.apariencia, color_contorno_inicio },
                  })
                }
              />
              <ColorField
                label="Color final"
                value={agente.apariencia.color_contorno_fin}
                onChange={(color_contorno_fin) =>
                  onChange({
                    ...agente,
                    apariencia: { ...agente.apariencia, color_contorno_fin },
                  })
                }
              />
            </div>
          </div>
        </div>
      )}

      {seccion === 'comportamiento' && (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Instrucciones del agente
            </span>
            <textarea
              value={agente.prompt}
              onChange={(event) => onChange({ ...agente, prompt: event.target.value })}
              rows={10}
              className={`${inputClass} resize-y`}
              placeholder="Describe como debe actuar el agente y que informacion puede utilizar."
            />
            <span className="mt-2 block text-xs leading-relaxed text-slate-500">
              Aqui va la informacion del negocio. Las reglas tecnicas del formato se agregaran
              automaticamente y no necesitan escribirse.
            </span>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Texto mientras escucha
            </span>
            <input
              value={agente.texto_escucha}
              onChange={(event) => onChange({ ...agente, texto_escucha: event.target.value })}
              className={inputClass}
            />
          </label>

          <section className="border-t border-slate-200 pt-5">
            <div className="mb-4">
              <h4 className="font-bold text-slate-900">Reintentos y tiempo de respuesta</h4>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Controla qué hace Temi cuando no escucha una respuesta o no logra entenderla.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Tiempo para responder
                </span>
                <div className="relative">
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={agente.reintentos.tiempo_respuesta_seg}
                    onChange={(event) =>
                      onChange({
                        ...agente,
                        reintentos: {
                          ...agente.reintentos,
                          tiempo_respuesta_seg: Math.min(
                            60,
                            Math.max(3, Number(event.target.value)),
                          ),
                        },
                      })
                    }
                    className={`${inputClass} pr-12`}
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    seg
                  </span>
                </div>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Reintentos
                </span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  value={agente.reintentos.max_reintentos}
                  onChange={(event) =>
                    onChange({
                      ...agente,
                      reintentos: {
                        ...agente.reintentos,
                        max_reintentos: Math.min(
                          5,
                          Math.max(0, Number(event.target.value)),
                        ),
                      },
                    })
                  }
                  className={inputClass}
                />
                <span className="mt-1 block text-[11px] text-slate-400">
                  {agente.reintentos.max_reintentos + 1} oportunidades en total
                </span>
              </label>
            </div>

            <div className="mt-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Cuando nadie responde
                </span>
                <textarea
                  value={agente.reintentos.mensaje_sin_respuesta}
                  onChange={(event) =>
                    onChange({
                      ...agente,
                      reintentos: {
                        ...agente.reintentos,
                        mensaje_sin_respuesta: event.target.value,
                      },
                    })
                  }
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Cuando no entiende la respuesta
                </span>
                <textarea
                  value={agente.reintentos.mensaje_no_entendido}
                  onChange={(event) =>
                    onChange({
                      ...agente,
                      reintentos: {
                        ...agente.reintentos,
                        mensaje_no_entendido: event.target.value,
                      },
                    })
                  }
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Al agotar los intentos
                </span>
                <textarea
                  value={agente.reintentos.mensaje_intentos_agotados}
                  onChange={(event) =>
                    onChange({
                      ...agente,
                      reintentos: {
                        ...agente.reintentos,
                        mensaje_intentos_agotados: event.target.value,
                      },
                    })
                  }
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600">
                  Acción al agotar los intentos
                </span>
                <select
                  value={agente.reintentos.accion_al_agotar}
                  onChange={(event) =>
                    onChange({
                      ...agente,
                      reintentos: {
                        ...agente.reintentos,
                        accion_al_agotar: event.target
                          .value as typeof agente.reintentos.accion_al_agotar,
                      },
                    })
                  }
                  className={inputClass}
                >
                  <option value="volver_inicio">Volver al inicio del agente</option>
                  <option value="finalizar">Finalizar conversación y reanudar ruta</option>
                </select>
              </label>
            </div>

            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
              Los reintentos aplican únicamente a pantallas que esperan una respuesta del usuario.
              Finalizar cierra el agente, regresa a la pantalla inicial general y reanuda la ruta con
              video. Durante los recorridos, Temi pronuncia cada referencia y continúa
              automáticamente.
            </p>
          </section>
        </div>
      )}
    </div>
  )
}
