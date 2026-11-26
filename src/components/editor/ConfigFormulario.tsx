import type { ReactNode } from 'react'
import { Ayuda } from '../Ayuda'
import { CampoColor } from '../CampoColor'
import { colorTextoSobre, fondoBoton } from '../../lib/colores'
import { camposDe, enlaceVistaPrevia, limpiarFormulario, MAX_DESPEDIDA } from '../../lib/formulario'
import {
  CAMPOS_FORMULARIO,
  COLOR_FORMULARIO_DEFECTO,
  TEXTO_AUTORIZACION_DEFECTO,
  type CampoFormulario,
  type FormularioRegistro,
} from '../../types/config'

const MAX_TITULO = 60
const MAX_SUBTITULO = 140
const MAX_AUTORIZACION = 400

/** Texto de una o varias líneas con su contador de caracteres */
export function CampoTexto({
  label,
  ayuda,
  valor,
  max,
  filas = 1,
  placeholder,
  onChange,
}: {
  label: string
  ayuda?: ReactNode
  valor: string
  max: number
  filas?: number
  placeholder?: string
  onChange: (texto: string) => void
}) {
  const clase = 'w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none'
  return (
    <div className="relative">
      <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
        {label}
        {ayuda && <Ayuda>{ayuda}</Ayuda>}
      </p>
      {filas > 1 ? (
        <textarea
          value={valor}
          maxLength={max}
          rows={filas}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          className={clase}
        />
      ) : (
        <input
          value={valor}
          maxLength={max}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.slice(0, max))}
          className={clase}
        />
      )}
      <p className="mt-1 text-right text-sm text-slate-400">
        {valor.length} / {max} caracteres
      </p>
    </div>
  )
}

/**
 * Despedida con el nombre de quien se registró. Si el formulario no pide el
 * nombre queda atenuada: el robot usa siempre la despedida sin nombre.
 */
export function DespedidaConNombre({
  valor,
  pideNombre,
  ayuda,
  onChange,
}: {
  valor: string
  pideNombre: boolean
  ayuda: ReactNode
  onChange: (texto: string) => void
}) {
  return (
    <div>
      <div className={pideNombre ? undefined : 'pointer-events-none opacity-50'} aria-disabled={!pideNombre}>
        <CampoTexto label="Mensaje de despedida con nombre" ayuda={ayuda} valor={valor} max={MAX_DESPEDIDA} filas={2} onChange={onChange} />
      </div>
      {!pideNombre && (
        <p className="mt-1 text-sm text-amber-700">
          El formulario no pide el nombre: el robot usará la despedida sin nombre.
        </p>
      )}
    </div>
  )
}

/** Las dos despedidas del robot: con el nombre de quien se registró y sin él */
export function CamposDespedida({
  conNombre,
  sinNombre,
  pideNombre,
  ayudaSinNombre,
  onConNombre,
  onSinNombre,
}: {
  conNombre: string
  sinNombre: string
  pideNombre: boolean
  ayudaSinNombre: ReactNode
  onConNombre: (texto: string) => void
  onSinNombre: (texto: string) => void
}) {
  return (
    <>
      <DespedidaConNombre
        valor={conNombre}
        pideNombre={pideNombre}
        ayuda={
          <>
            Se reproduce si el visitante se registra antes de que finalice el tiempo. Utilice{' '}
            <span className="font-mono">{'{nombre}'}</span> para incluir su primer nombre.
          </>
        }
        onChange={onConNombre}
      />
      <CampoTexto
        label="Mensaje de despedida sin nombre"
        ayuda={ayudaSinNombre}
        valor={sinNombre}
        max={MAX_DESPEDIDA}
        filas={2}
        onChange={onSinNombre}
      />
    </>
  )
}

/** Textos y color del formulario que abre el QR, con una muestra pequeña */
export function ConfigFormulario({
  valor,
  origen,
  onChange,
}: {
  valor: FormularioRegistro
  /** de dónde se abre: cambia la pantalla de gracias de la vista previa */
  origen: 'foto' | 'registro'
  onChange: (nuevo: FormularioRegistro) => void
}) {
  const cambiar = (cambios: Partial<FormularioRegistro>) => onChange({ ...valor, ...cambios })
  const color = /^#[0-9a-fA-F]{6}$/.test(valor.color) ? valor.color : COLOR_FORMULARIO_DEFECTO
  const campos = camposDe(valor)
  const activos = CAMPOS_FORMULARIO.filter((c) => campos[c.id]).length
  const cambiarCampo = (id: CampoFormulario, activo: boolean) => cambiar({ campos: { ...campos, [id]: activo } })

  /** Con lo que hay en el diálogo ahora mismo, aunque no esté guardado */
  const enlace = () => enlaceVistaPrevia(origen, { ...limpiarFormulario(valor), color })

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <p className="flex items-center gap-2 font-semibold text-slate-800">
        Formulario
        <Ayuda>
          Contenido que el visitante ve en su celular al escanear el código QR. Puede pedir nombre, correo y celular:
          quite o agregue campos en la vista previa.
        </Ayuda>
      </p>

      <CampoTexto label="Título" valor={valor.titulo} max={MAX_TITULO} onChange={(titulo) => cambiar({ titulo })} />
      <CampoTexto
        label="Subtítulo"
        valor={valor.subtitulo}
        max={MAX_SUBTITULO}
        filas={2}
        onChange={(subtitulo) => cambiar({ subtitulo })}
      />
      <CampoColor
        label="Color"
        ayuda="Botón Enviar, etiquetas de los campos y borde del campo activo."
        value={valor.color}
        onChange={(hex) => cambiar({ color: hex })}
      />
      <CampoTexto
        label="Texto de autorización de datos"
        ayuda="Acompaña la casilla que el visitante debe marcar para enviar el formulario."
        valor={valor.texto_autorizacion}
        max={MAX_AUTORIZACION}
        filas={3}
        placeholder={TEXTO_AUTORIZACION_DEFECTO}
        onChange={(texto_autorizacion) => cambiar({ texto_autorizacion })}
      />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
          Enlace a la política de datos
          <Ayuda>Opcional. Si se indica, el texto de autorización incluye un enlace para consultarla.</Ayuda>
        </p>
        <input
          value={valor.politica_url}
          placeholder="https://empresa.com/politica-de-datos"
          onChange={(e) => cambiar({ politica_url: e.target.value.slice(0, 300) })}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {/* Muestra: cómo se ven el título, una etiqueta y el botón con el color elegido */}
      <div className="rounded-lg bg-slate-50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Vista previa</p>
        <div className="mx-auto max-w-[16rem] rounded-xl bg-white p-4 shadow-sm">
          <p className="text-center text-sm font-bold uppercase text-slate-800">{valor.titulo || 'Título'}</p>
          {valor.subtitulo && <p className="mt-1 text-center text-xs text-slate-500">{valor.subtitulo}</p>}
          {/* Cada campo se quita con «−»; el quitado queda en su lugar, punteado, para volver a agregarlo */}
          {CAMPOS_FORMULARIO.map(({ id, etiqueta }) =>
            campos[id] ? (
              <div key={id}>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium" style={{ color }}>
                    {etiqueta}
                  </p>
                  <button
                    type="button"
                    onClick={() => cambiarCampo(id, false)}
                    disabled={activos === 1}
                    title={activos === 1 ? 'Debe quedar al menos un campo' : `Quitar ${etiqueta}`}
                    aria-label={`Quitar ${etiqueta}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-slate-400 transition-colors hover:border-red-400 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                  >
                    <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2.5 6h7" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
                <div className="mt-1 h-7 rounded-full border border-slate-300" />
              </div>
            ) : (
              <button
                key={id}
                type="button"
                onClick={() => cambiarCampo(id, true)}
                className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-slate-300 text-xs font-medium text-slate-400 transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-600"
              >
                <span className="text-sm leading-none">+</span> Agregar {etiqueta}
              </button>
            )
          )}
          {!campos.nombre && (
            <p className="mt-2 text-center text-[0.625rem] leading-snug text-amber-700">
              Sin nombre, el robot usará la despedida sin {'{nombre}'}.
            </p>
          )}
          <div className="mt-3 flex items-start gap-2">
            <span className="mt-0.5 h-3 w-3 shrink-0 rounded-sm border border-slate-400" />
            <p className="line-clamp-2 text-[0.625rem] leading-snug text-slate-500">
              {valor.texto_autorizacion || TEXTO_AUTORIZACION_DEFECTO}
              {valor.politica_url && (
                <span className="underline" style={{ color }}>
                  {' '}
                  Ver política
                </span>
              )}
            </p>
          </div>
          <div
            className="mt-3 rounded-full py-2 text-center text-xs font-semibold uppercase"
            style={{ backgroundImage: fondoBoton(color), color: colorTextoSobre(color) }}
          >
            Enviar
          </div>
        </div>
        {/* El formulario real en otra pestaña; no guarda nada */}
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => window.open(enlace(), '_blank', 'noopener')}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Ver vista previa
          </button>
        </div>      </div>
    </div>
  )
}

