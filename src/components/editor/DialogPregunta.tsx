import { useState } from 'react'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { CampoColor } from '../CampoColor'
import { LIMITES, PALETA_RULETA, type Pregunta } from '../../types/config'

interface DialogPreguntaProps {
  titulo: string
  valor: Pregunta | null
  /** color para una pregunta nueva: el primero libre de la paleta */
  colorSugerido: string
  puedeEliminar: boolean
  onGuardar: (nueva: Pregunta) => void
  onEliminar: () => void
  onCerrar: () => void
}

/** Diálogo "Configuración - N pregunta" del mockup */
export function DialogPregunta({
  titulo,
  valor,
  colorSugerido,
  puedeEliminar,
  onGuardar,
  onEliminar,
  onCerrar,
}: DialogPreguntaProps) {
  const [texto, setTexto] = useState(valor?.texto ?? '')
  const [opciones, setOpciones] = useState<string[]>(valor?.opciones ?? ['', ''])
  const [correcta, setCorrecta] = useState(valor?.correcta ?? 0)
  const [tipo, setTipo] = useState<'trivia' | 'calificacion'>(valor?.tipo ?? 'trivia')
  const [color, setColor] = useState(valor?.color || colorSugerido)
  const esCalificacion = tipo === 'calificacion'

  const valida =
    texto.trim().length > 0 &&
    /^#[0-9a-f]{6}$/i.test(color) &&
    opciones.length >= LIMITES.OPCIONES_MIN &&
    opciones.every((o) => o.trim().length > 0)

  function cambiarOpcion(i: number, valor: string) {
    setOpciones(opciones.map((o, k) => (k === i ? valor : o)))
  }

  function agregarOpcion() {
    if (opciones.length < LIMITES.OPCIONES_MAX) setOpciones([...opciones, ''])
  }

  function quitarOpcion(i: number) {
    if (opciones.length <= LIMITES.OPCIONES_MIN) return
    setOpciones(opciones.filter((_, k) => k !== i))
    if (correcta >= opciones.length - 1) setCorrecta(0)
  }

  return (
    <Modal
      titulo={titulo}
      onCancelar={onCerrar}
      aceptarDeshabilitado={!valida}
      onAceptar={() => {
        onGuardar({
          texto: texto.trim(),
          opciones: opciones.map((o) => o.trim()),
          correcta: esCalificacion ? 0 : correcta,
          tipo,
          color: color.toUpperCase(),
        })
        onCerrar()
      }}
    >
      {/* Color de su sección en la rueda */}
      <div className="mb-5 rounded-lg border border-slate-200 p-4">
        <p className="mb-3 flex items-center gap-2 font-medium text-slate-800">
          Color en la ruleta
          <Ayuda>Al detenerse la rueda en este color, se presenta esta pregunta. Cada pregunta debe tener un color distinto.</Ayuda>
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {PALETA_RULETA.map((c) => (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Color ${c}`}
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                color.toUpperCase() === c ? 'border-slate-900 ring-2 ring-slate-900/20' : 'border-white shadow'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <CampoColor label="Otro color" value={color} onChange={setColor} />
      </div>

      {/* Tipo de pregunta: opciones en una fila, como el formato visual de los botones */}
      <div className="mb-5 flex flex-wrap items-center gap-x-6 gap-y-2">
        <p className="font-medium text-slate-800">Tipo de pregunta</p>
        {(
          [
            { v: 'trivia', label: 'Trivia', detalle: 'Tiene respuesta correcta' },
            { v: 'calificacion', label: 'Calificación', detalle: 'Opinión, sin respuesta correcta' },
          ] as const
        ).map((op) => (
          <label key={op.v} className="flex cursor-pointer items-center gap-2 text-slate-800">
            <input
              type="radio"
              name="tipo-pregunta"
              checked={tipo === op.v}
              onChange={() => setTipo(op.v)}
              className="accent-[#1d293d]"
            />
            {op.label}
            <Ayuda>{op.detalle}</Ayuda>
          </label>
        ))}
      </div>

      <p className="mb-2 font-medium text-slate-800">Pregunta</p>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value.slice(0, LIMITES.PREGUNTA_MAX))}
        rows={2}
        className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-[#1d293d] focus:outline-none"
      />
      <p className="mt-1 text-right text-sm text-slate-400">
        {texto.length} / {LIMITES.PREGUNTA_MAX} caracteres
      </p>

      <div className="mt-4 flex items-center justify-between">
        <p className="font-medium text-slate-800">Opciones de respuesta</p>
        {!esCalificacion && <p className="text-sm text-[#1d293d]">Marcar respuesta correcta →</p>}
      </div>

      <div className="mt-3 space-y-3">
        {opciones.map((opcion, i) => (
          <div key={i} className="flex items-center gap-3">
            <div
              className={`flex flex-1 items-center rounded-lg border px-4 py-3 ${
                !esCalificacion && correcta === i ? 'border-[#1d293d] ring-1 ring-[#1d293d]' : 'border-slate-300'
              }`}
            >
              <input
                value={opcion}
                onChange={(e) => cambiarOpcion(i, e.target.value.slice(0, 60))}
                placeholder={`Opción ${i + 1}`}
                className="w-full focus:outline-none"
              />
              {!esCalificacion && (
                <button
                  type="button"
                  onClick={() => setCorrecta(i)}
                  title="Marcar como correcta"
                  className={`ml-3 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                    correcta === i
                      ? 'border-[#1d293d] bg-[#1d293d] text-white'
                      : 'border-slate-300 text-transparent hover:border-slate-500'
                  }`}
                >
                  ✓
                </button>
              )}
            </div>
            {opciones.length > LIMITES.OPCIONES_MIN && (
              <button
                type="button"
                onClick={() => quitarOpcion(i)}
                className="text-slate-400 hover:text-red-500"
                title="Quitar opción"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between">
        {opciones.length < LIMITES.OPCIONES_MAX ? (
          <button
            type="button"
            onClick={agregarOpcion}
            className="font-medium text-[#1d293d] hover:opacity-80"
          >
            + Agregar opción
          </button>
        ) : (
          <span />
        )}
        <p className="text-sm text-slate-400">
          Min. {LIMITES.OPCIONES_MIN} - Max. {LIMITES.OPCIONES_MAX}
        </p>
      </div>

      {puedeEliminar && (
        <button
          type="button"
          onClick={() => {
            onEliminar()
            onCerrar()
          }}
          className="mt-6 text-sm font-medium text-red-500 hover:text-red-700"
        >
          Eliminar esta pregunta
        </button>
      )}
    </Modal>
  )
}
