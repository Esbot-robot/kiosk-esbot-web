import { useState } from 'react'
import { Modal } from './Modal'
import { Ayuda } from './Ayuda'
import { Advertencia } from './Advertencia'
import { CampoTexto } from './editor/ConfigFormulario'

export const FRASE_QUIETO_MAX = 300
export const FRASE_QUIETO_SEG_MIN = 10
export const FRASE_QUIETO_SEG_MAX = 3600
export const FRASE_QUIETO_SEG_DEFECTO = 60

export interface ModoQuieto {
  sinVideo: boolean
  frase: string
  segundos: number
}

interface DialogDetenerProps {
  nombreRobot: string
  enServicio: boolean
  /** valores con los que abre: los actuales del robot al editar, los de siempre al detener */
  inicial: ModoQuieto
  /** true = el robot ya está quieto sin video y solo se cambia la frase o el tiempo */
  editando: boolean
  onAceptar: (modo: ModoQuieto) => void
  onCerrar: () => void
}

/**
 * Popup de "Detener recorrido". Con el interruptor "Sin video" apagado el robot
 * se queda quieto como siempre (con el video de patrullaje). Encendido, queda en
 * la pantalla inicial fija y dice la frase cada cierto tiempo, con voz de Azure.
 */
export function DialogDetener({ nombreRobot, enServicio, inicial, editando, onAceptar, onCerrar }: DialogDetenerProps) {
  const [sinVideo, setSinVideo] = useState(inicial.sinVideo)
  const [frase, setFrase] = useState(inicial.frase)
  const [segundos, setSegundos] = useState(String(inicial.segundos))
  const [error, setError] = useState('')

  function aceptar() {
    const seg = Number(segundos)
    if (sinVideo && frase.trim()) {
      if (!Number.isFinite(seg) || seg < FRASE_QUIETO_SEG_MIN || seg > FRASE_QUIETO_SEG_MAX) {
        setError(`Escribe cada cuántos segundos dice la frase, entre ${FRASE_QUIETO_SEG_MIN} y ${FRASE_QUIETO_SEG_MAX}.`)
        return
      }
    }
    onAceptar({
      sinVideo,
      frase: frase.trim(),
      segundos: Number.isFinite(seg) && seg >= FRASE_QUIETO_SEG_MIN ? Math.min(seg, FRASE_QUIETO_SEG_MAX) : FRASE_QUIETO_SEG_DEFECTO,
    })
  }

  return (
    <Modal
      titulo={editando ? 'Editar recorrido detenido' : '¿Detener el recorrido?'}
      textoAceptar={editando ? 'Guardar' : 'Sí, detener'}
      onCancelar={onCerrar}
      onAceptar={aceptar}
      aviso={error}
    >
      <div className="space-y-5">
        {!editando && (
          <p className="text-slate-700">
            <span className="font-semibold">{nombreRobot}</span> dejará de desplazarse y permanecerá en su lugar actual.
            Todo lo demás seguirá funcionando con normalidad.
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-lg bg-slate-50 px-4 py-3">
          <span className="flex items-center gap-2 font-semibold text-slate-800">
            Sin video
            <Ayuda>
              El robot queda quieto en la pantalla inicial, sin reproducir el video de patrullaje. Los botones están siempre
              activos (no hay que tocar primero) y no hay cuenta regresiva de inicio. Si alguien juega o ve productos, al
              terminar vuelve a la pantalla inicial sin video. Sirve para dejarlo en la base de carga o en la entrada.
            </Ayuda>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={sinVideo}
            aria-label="Sin video"
            onClick={() => setSinVideo((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${sinVideo ? 'bg-indigo-600' : 'bg-slate-300'}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${sinVideo ? 'left-[22px]' : 'left-0.5'}`}
            />
          </button>
        </div>

        {sinVideo && (
          <div className="space-y-4">
            <CampoTexto
              label="Frase que dirá el robot"
              ayuda="La dice con la voz de Azure, sin animación, cada cierto tiempo mientras nadie esté usando la pantalla. Si la dejas vacía, el robot queda quieto sin decir nada."
              valor={frase}
              max={FRASE_QUIETO_MAX}
              filas={3}
              onChange={setFrase}
            />
            <div>
              <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
                Cada cuántos segundos la dice
                <Ayuda>
                  Entre {FRASE_QUIETO_SEG_MIN} y {FRASE_QUIETO_SEG_MAX} segundos. No habla si alguien tocó la pantalla hace
                  poco o está jugando.
                </Ayuda>
              </p>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={FRASE_QUIETO_SEG_MIN}
                  max={FRASE_QUIETO_SEG_MAX}
                  value={segundos}
                  onChange={(e) => setSegundos(e.target.value)}
                  className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
                />
                <span className="text-slate-600">segundos</span>
              </div>
            </div>
          </div>
        )}

        {!enServicio && (
          <Advertencia>Este robot no está en línea: la orden se aplicará cuando vuelva a conectarse.</Advertencia>
        )}
      </div>
    </Modal>
  )
}
