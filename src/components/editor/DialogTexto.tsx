import { useState } from 'react'
import { Modal } from '../Modal'
import { CampoColor } from '../CampoColor'
import { AparienciaBoton } from './AparienciaBoton'
import type { BotonEstilo, TextoEstilo } from '../../types/config'

interface DialogTextoProps {
  titulo: string
  valor: TextoEstilo
  maxCaracteres: number
  onGuardar: (nuevo: TextoEstilo) => void
  onCerrar: () => void
}

/** Diálogo "Editar título" / "Editar subtítulo" del mockup */
export function DialogTexto({ titulo, valor, maxCaracteres, onGuardar, onCerrar }: DialogTextoProps) {
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
        })
        onCerrar()
      }}
    >
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
          <p className="font-medium text-slate-800">Solidez del fondo</p>
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
        <p className="mt-2 text-sm text-slate-500">0% es transparente y 100% mantiene el color sólido.</p>
      </div>
      <div className="mt-5 rounded-lg border border-slate-200 p-4">
        <label className="flex cursor-pointer items-center justify-between gap-4">
          <span>
            <span className="block font-medium text-slate-800">Sombra del texto</span>
            <span className="block text-sm text-slate-500">Mejora la lectura sobre imágenes.</span>
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

interface DialogBotonProps {
  valor: BotonEstilo
  projectId: string
  maxCaracteres: number
  onGuardar: (nuevo: BotonEstilo) => void
  onCerrar: () => void
}

/** Diálogo "Editar botón" del mockup (incluye color de contorno) */
export function DialogBoton({ valor, projectId, maxCaracteres, onGuardar, onCerrar }: DialogBotonProps) {
  const [boton, setBoton] = useState(valor)

  return (
    <Modal
      titulo="Editar botón"
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar({ ...boton, texto: boton.texto.trim() })
        onCerrar()
      }}
    >
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
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(color)
        onCerrar()
      }}
    >
      {textoAyuda && <p className="mb-4 text-sm text-slate-500">{textoAyuda}</p>}
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
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(fondo, texto)
        onCerrar()
      }}
    >
      <p className="mb-4 text-sm text-slate-500">
        Cada botón tiene su color de fondo y de texto en la pantalla del robot. Deja vacío para usar
        el color original.
      </p>
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
