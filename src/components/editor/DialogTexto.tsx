import { useState } from 'react'
import { Modal } from '../Modal'
import { CampoColor } from '../CampoColor'
import type { BotonEstilo, DestinoBotonInicial, TextoEstilo } from '../../types/config'

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

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar({ texto, color_texto: colorTexto, color_fondo: colorFondo })
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
    </Modal>
  )
}

interface DialogBotonProps {
  valor: BotonEstilo
  valorAgente: BotonEstilo
  destino: DestinoBotonInicial
  agenteActivo: boolean
  maxCaracteres: number
  onGuardar: (
    nuevo: BotonEstilo,
    destino: DestinoBotonInicial,
    nuevoAgente: BotonEstilo,
  ) => void
  onCerrar: () => void
}

/** Diálogo "Editar botón" del mockup (incluye color de contorno) */
export function DialogBoton({
  valor,
  valorAgente,
  destino: destinoInicial,
  agenteActivo,
  maxCaracteres,
  onGuardar,
  onCerrar,
}: DialogBotonProps) {
  const [texto, setTexto] = useState(valor.texto)
  const [colorTexto, setColorTexto] = useState(valor.color_texto)
  const [colorFondo, setColorFondo] = useState(valor.color_fondo)
  const [colorContorno, setColorContorno] = useState(valor.color_contorno)
  const [textoAgente, setTextoAgente] = useState(valorAgente.texto)
  const [colorTextoAgente, setColorTextoAgente] = useState(valorAgente.color_texto)
  const [colorFondoAgente, setColorFondoAgente] = useState(valorAgente.color_fondo)
  const [colorContornoAgente, setColorContornoAgente] = useState(valorAgente.color_contorno)
  const [destino, setDestino] = useState(destinoInicial)

  return (
    <Modal
      titulo="Editar botón principal"
      onCancelar={onCerrar}
      onAceptar={() => {
        onGuardar(
          {
            texto,
            color_texto: colorTexto,
            color_fondo: colorFondo,
            color_contorno: colorContorno,
          },
          destino,
          {
            texto: textoAgente,
            color_texto: colorTextoAgente,
            color_fondo: colorFondoAgente,
            color_contorno: colorContornoAgente,
          },
        )
        onCerrar()
      }}
    >
      <p className="mb-2 font-medium text-slate-800">Al tocar el botón</p>
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['quiz', 'Abrir Quiz'],
            ['agente', 'Abrir Agente IA'],
            ['ambos', 'Mostrar ambos'],
          ] as const
        ).map(([valorDestino, label]) => {
          const requiereAgente = valorDestino !== 'quiz'
          const deshabilitado = requiereAgente && !agenteActivo
          return (
            <label
              key={valorDestino}
              className={`rounded-xl border px-3 py-3 text-center text-sm font-semibold transition ${
                destino === valorDestino
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600'
              } ${deshabilitado ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-indigo-300'}`}
            >
              <input
                type="radio"
                name="destino_boton"
                value={valorDestino}
                checked={destino === valorDestino}
                disabled={deshabilitado}
                onChange={() => setDestino(valorDestino)}
                className="sr-only"
              />
              {label}
            </label>
          )
        })}
      </div>
      {!agenteActivo && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Activa el Agente IA para poder seleccionarlo como destino.
        </p>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 p-4">
        <p className="mb-3 font-semibold text-slate-800">
          {destino === 'ambos' ? 'Botón del Quiz' : 'Botón principal'}
        </p>
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value.slice(0, maxCaracteres))}
          className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
        />
        <p className="mt-1 text-right text-sm text-slate-400">
          {texto.length} / {maxCaracteres} caracteres
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <CampoColor label="Color de texto" value={colorTexto} onChange={setColorTexto} />
          <CampoColor label="Color de fondo" value={colorFondo} onChange={setColorFondo} />
          <CampoColor
            label="Color de contorno"
            value={colorContorno}
            onChange={setColorContorno}
          />
        </div>
      </div>

      {destino === 'ambos' && (
        <div className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/40 p-4">
          <p className="mb-3 font-semibold text-slate-800">Botón del Agente IA</p>
          <input
            value={textoAgente}
            onChange={(e) => setTextoAgente(e.target.value.slice(0, maxCaracteres))}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {textoAgente.length} / {maxCaracteres} caracteres
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <CampoColor
              label="Color de texto"
              value={colorTextoAgente}
              onChange={setColorTextoAgente}
            />
            <CampoColor
              label="Color de fondo"
              value={colorFondoAgente}
              onChange={setColorFondoAgente}
            />
            <CampoColor
              label="Color de contorno"
              value={colorContornoAgente}
              onChange={setColorContornoAgente}
            />
          </div>
        </div>
      )}
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
