import type { ReactNode } from 'react'
import { Ayuda } from '../Ayuda'
import { CampoColor } from '../CampoColor'
import { colorTextoSobre } from '../../lib/colores'
import { MAX_DESPEDIDA } from '../../lib/formulario'
import { COLOR_FORMULARIO_DEFECTO, TEXTO_AUTORIZACION_DEFECTO, type FormularioRegistro } from '../../types/config'

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

/** Las dos despedidas del robot: con el nombre de quien se registró y sin él */
export function CamposDespedida({
  conNombre,
  sinNombre,
  ayudaSinNombre,
  onConNombre,
  onSinNombre,
}: {
  conNombre: string
  sinNombre: string
  ayudaSinNombre: ReactNode
  onConNombre: (texto: string) => void
  onSinNombre: (texto: string) => void
}) {
  return (
    <>
      <CampoTexto
        label="Despedida con nombre"
        ayuda={
          <>
            La dice el robot si alguien se registra antes de que acabe el tiempo. Escribe{' '}
            <span className="font-mono">{'{nombre}'}</span> donde va el primer nombre de la persona.
          </>
        }
        valor={conNombre}
        max={MAX_DESPEDIDA}
        filas={2}
        onChange={onConNombre}
      />
      <CampoTexto
        label="Despedida sin nombre"
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
  onChange,
}: {
  valor: FormularioRegistro
  onChange: (nuevo: FormularioRegistro) => void
}) {
  const cambiar = (cambios: Partial<FormularioRegistro>) => onChange({ ...valor, ...cambios })
  const color = /^#[0-9a-fA-F]{6}$/.test(valor.color) ? valor.color : COLOR_FORMULARIO_DEFECTO

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 p-4">
      <p className="flex items-center gap-2 font-semibold text-slate-800">
        Formulario
        <Ayuda>Lo que ve el visitante en su celular al escanear el QR. Pide nombre, correo y celular.</Ayuda>
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
        ayuda="Acompaña la casilla que el visitante debe marcar para enviar."
        valor={valor.texto_autorizacion}
        max={MAX_AUTORIZACION}
        filas={3}
        placeholder={TEXTO_AUTORIZACION_DEFECTO}
        onChange={(texto_autorizacion) => cambiar({ texto_autorizacion })}
      />
      <div className="relative">
        <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
          Enlace a la política de datos
          <Ayuda>Opcional. Si lo pones, el texto de autorización muestra un enlace para leerla.</Ayuda>
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
          <p className="mt-3 text-xs font-medium" style={{ color }}>
            Nombre
          </p>
          <div className="mt-1 h-7 rounded-full border border-slate-300" />
          <div
            className="mt-3 rounded-full py-2 text-center text-xs font-semibold uppercase"
            style={{ backgroundColor: color, color: colorTextoSobre(color) }}
          >
            Enviar
          </div>
        </div>
      </div>
    </div>
  )
}

