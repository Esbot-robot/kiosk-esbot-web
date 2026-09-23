import { useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { CampoColor } from '../CampoColor'
import { AparienciaBoton } from './AparienciaBoton'
import type { BotonEstilo, TextoEstilo } from '../../types/config'

interface DialogTextoProps {
  titulo: string
  valor: TextoEstilo
  maxCaracteres: number
  /** si el texto se muestra en el robot */
  visible: boolean
  onGuardar: (nuevo: TextoEstilo, visible: boolean) => void
  onCerrar: () => void
}

/** Diálogo "Editar título" / "Editar subtítulo" del mockup */
export function DialogTexto({ titulo, valor, maxCaracteres, visible, onGuardar, onCerrar }: DialogTextoProps) {
  const [mostrar, setMostrar] = useState(visible)
  const [texto, setTexto] = useState(valor.texto)
  const [colorTexto, setColorTexto] = useState(valor.color_texto)
  const [colorFondo, setColorFondo] = useState(valor.color_fondo)
  const [opacidadFondo, setOpacidadFondo] = useState(valor.opacidad_fondo ?? 100)
  const [sombraActiva, setSombraActiva] = useState(valor.sombra_activa ?? false)
  const [colorSombra, setColorSombra] = useState(valor.color_sombra ?? '#000000')
  const [intensidadSombra, setIntensidadSombra] = useState(valor.intensidad_sombra ?? 'leve')

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar({
          texto,
          color_texto: colorTexto,
          color_fondo: colorFondo,
          opacidad_fondo: opacidadFondo,
          sombra_activa: sombraActiva,
          color_sombra: colorSombra,
          intensidad_sombra: intensidadSombra,
        }, mostrar)
        onCerrar()
      }}
    >
      <InterruptorMostrar
        etiqueta="Mostrar este texto"
        ayuda="Apagado, el robot lo oculta pero deja su espacio vacío: el resto de la pantalla no se mueve."
        valor={mostrar}
        onChange={setMostrar}
      />

      <p className="mb-2 font-medium text-slate-800">Texto del elemento</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, maxCaracteres))}
        rows={3}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <p className="mt-1 text-right text-sm text-slate-400">
        {texto.length} / {maxCaracteres} caracteres
      </p>

      <div className="mt-4 grid grid-cols-2 gap-6">
        <CampoColor label="Color de texto" value={colorTexto} onChange={setColorTexto} />
        <CampoColor label="Color de fondo" value={colorFondo} onChange={setColorFondo} />
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-4">
          <p className="flex items-center gap-2 font-medium text-slate-800">
            Solidez del fondo
            <Ayuda>0% es transparente y 100% mantiene el color sólido.</Ayuda>
          </p>
          <span className="font-mono text-sm text-slate-500">{opacidadFondo}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          value={opacidadFondo}
          onChange={(e) => setOpacidadFondo(Number(e.target.value))}
          className="mt-3 w-full accent-indigo-600"
        />
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span className="flex items-center gap-2 font-medium text-slate-800">
            Sombra del texto
            <Ayuda>Mejora la lectura sobre imágenes.</Ayuda>
          </span>
          <input
            type="checkbox"
            checked={sombraActiva}
            onChange={(e) => setSombraActiva(e.target.checked)}
            className="h-5 w-5 accent-indigo-600"
          />
        </label>
        {sombraActiva && (
          <div className="mt-4 grid grid-cols-2 gap-5">
            <CampoColor label="Color de sombra" value={colorSombra} onChange={setColorSombra} />
            <label>
              <span className="mb-2 block font-medium text-slate-800">Intensidad</span>
              <select
                value={intensidadSombra}
                onChange={(e) => setIntensidadSombra(e.target.value as 'leve' | 'media' | 'fuerte')}
                className="w-full rounded-lg border border-slate-300 px-3 py-3 focus:border-indigo-500 focus:outline-none"
              >
                <option value="leve">Leve</option>
                <option value="media">Media</option>
                <option value="fuerte">Fuerte</option>
              </select>
            </label>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface InterruptorMostrarProps {
  etiqueta: string
  ayuda: string
  valor: boolean
  onChange: (valor: boolean) => void
}

/** Casilla "Mostrar este …" que va arriba en los diálogos de la pantalla inicial */
export function InterruptorMostrar({ etiqueta, ayuda, valor, onChange }: InterruptorMostrarProps) {
  return (
    <label className="mb-5 flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
      <input
        type="checkbox"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-indigo-600"
      />
      <span className="flex items-center gap-2 font-semibold">
        {etiqueta}
        <Ayuda>{ayuda}</Ayuda>
      </span>
    </label>
  )
}

interface DialogBotonProps {
  valor: BotonEstilo
  projectId: string
  maxCaracteres: number
  /** si el botón Jugar se muestra en el robot */
  activo: boolean
  onGuardar: (nuevo: BotonEstilo, activo: boolean) => void
  onCerrar: () => void
}

/** Diálogo "Editar botón" del mockup (incluye color de contorno) */
export function DialogBoton({
  valor,
  projectId,
  maxCaracteres,
  activo,
  onGuardar,
  onCerrar,
}: DialogBotonProps) {
  const [boton, setBoton] = useState(valor)
  const [visible, setVisible] = useState(activo)

  return (
    <Modal
      titulo="Editar botón"
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar({ ...boton, texto: boton.texto.trim() }, visible)
        onCerrar()
      }}
    >
      <InterruptorMostrar
        etiqueta="Mostrar este botón"
        ayuda="Apágalo si el evento no usa el quiz. Al menos un botón debe quedar activo."
        valor={visible}
        onChange={setVisible}
      />

      <p className="mb-2 font-medium text-slate-800">Texto del elemento</p>
      <input
        value={boton.texto}
        onChange={(e) => setBoton((actual) => ({ ...actual, texto: e.target.value.slice(0, maxCaracteres) }))}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <p className="mt-1 text-right text-sm text-slate-400">
        {boton.texto.length} / {maxCaracteres} caracteres
      </p>

      <div className="mt-4">
        <AparienciaBoton valor={boton} projectId={projectId} onChange={setBoton} />
      </div>
    </Modal>
  )
}

interface DialogTtsProps {
  titulo: string
  valor: string
  maxCaracteres: number
  onGuardar: (nuevo: string) => void
  onCerrar: () => void
}

/** Diálogo "Tts: ..." del mockup */
export function DialogTts({ titulo, valor, maxCaracteres, onGuardar, onCerrar }: DialogTtsProps) {
  const [texto, setTexto] = useState(valor)

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(texto)
        onCerrar()
      }}
    >
      <p className="mb-2 font-medium text-slate-800">Texto del Tts</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, maxCaracteres))}
        rows={4}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
      <p className="mt-1 text-right text-sm text-slate-400">
        {texto.length} / {maxCaracteres} caracteres
      </p>
    </Modal>
  )
}

interface DialogColorProps {
  titulo: string
  etiqueta: string
  valor: string
  textoAyuda?: string
  onGuardar: (nuevo: string) => void
  onCerrar: () => void
}

/** Diálogo reutilizable para colores que no pertenecen a un texto o botón. */
export function DialogColor({
  titulo,
  etiqueta,
  valor,
  textoAyuda,
  onGuardar,
  onCerrar,
}: DialogColorProps) {
  const [color, setColor] = useState(valor)

  return (
    <Modal
      titulo={titulo}
      ayuda={textoAyuda}
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(color)
        onCerrar()
      }}
    >
      <CampoColor label={etiqueta} value={color} onChange={setColor} />
    </Modal>
  )
}

interface DialogColoresOpcionesProps {
  valoresFondo: string[]
  valoresTexto: string[]
  onGuardar: (fondo: string[], texto: string[]) => void
  onCerrar: () => void
}

/** Colores de fondo y de texto de los 3 botones de respuesta del quiz */
export function DialogColoresOpciones({
  valoresFondo,
  valoresTexto,
  onGuardar,
  onCerrar,
}: DialogColoresOpcionesProps) {
  const [fondo, setFondo] = useState<string[]>([
    valoresFondo[0] ?? '',
    valoresFondo[1] ?? '',
    valoresFondo[2] ?? '',
  ])
  const [texto, setTexto] = useState<string[]>([
    valoresTexto[0] ?? '',
    valoresTexto[1] ?? '',
    valoresTexto[2] ?? '',
  ])

  return (
    <Modal
      titulo="Colores de las opciones de respuesta"
      ayuda="Cada botón tiene su color de fondo y de texto en la pantalla del robot. Deja vacío para usar el color original."
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(fondo, texto)
        onCerrar()
      }}
    >
      <div className="space-y-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-slate-200 p-4">
            <p className="mb-3 font-semibold text-slate-800">Botón opción {i + 1}</p>
            <div className="grid grid-cols-2 gap-4">
              <CampoColor
                label="Fondo"
                value={fondo[i]}
                onChange={(hex) => setFondo(fondo.map((c, k) => (k === i ? hex : c)))}
              />
              <CampoColor
                label="Texto"
                value={texto[i]}
                onChange={(hex) => setTexto(texto.map((c, k) => (k === i ? hex : c)))}
              />
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}

interface DialogTextoSimpleProps {
  titulo: string
  etiqueta: string
  valor: string
  placeholder?: string
  onGuardar: (nuevo: string) => void
  onCerrar: () => void
}

/** Diálogo de un solo campo, ej. "Secuencia para guía" */
export function DialogTextoSimple({
  titulo,
  etiqueta,
  valor,
  placeholder,
  onGuardar,
  onCerrar,
}: DialogTextoSimpleProps) {
  const [texto, setTexto] = useState(valor)

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(texto.trim())
        onCerrar()
      }}
    >
      <p className="mb-2 font-medium text-slate-800">{etiqueta}</p>
      <input
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
      />
    </Modal>
  )
}
