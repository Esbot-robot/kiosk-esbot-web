import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ModalPestanas } from '../ModalPestanas'
import { Ayuda } from '../Ayuda'
import { Interruptor } from '../Interruptor'
import { AparienciaBoton } from './AparienciaBoton'
import { CamposDespedida, CampoTexto, ConfigFormulario } from './ConfigFormulario'
import { IconoDocumento, IconoMonitor, IconoPaleta } from '../iconosPopup'
import { limpiarFormulario, validarFormulario } from '../../lib/formulario'
import { SEGUNDOS_PANTALLA_MAX, SEGUNDOS_PANTALLA_MIN, type BotonRegistro } from '../../types/config'

interface DialogRegistroProps {
  valor: BotonRegistro
  projectId: string
  onGuardar: (nuevo: BotonRegistro) => void
  onCerrar: () => void
}

const MAX_BOTON = 20
const MAX_TEXTO = 300

type Pestana = 'apariencia' | 'pantalla' | 'formulario'

const PESTANAS = [
  { id: 'apariencia', etiqueta: 'Apariencia', icono: <IconoPaleta /> },
  { id: 'pantalla', etiqueta: 'Pantalla', icono: <IconoMonitor /> },
  { id: 'formulario', etiqueta: 'Formulario', icono: <IconoDocumento /> },
]

/** Configura el botón de registro: código QR al formulario, tiempo y despedidas */
export function DialogRegistro({ valor, projectId, onGuardar, onCerrar }: DialogRegistroProps) {
  const [registro, setRegistro] = useState(() => structuredClone(valor))
  const [pestana, setPestana] = useState<Pestana>('apariencia')
  const [error, setError] = useState('')

  const cambiar = (cambios: Partial<BotonRegistro>) => setRegistro((actual) => ({ ...actual, ...cambios }))

  /** Muestra el error y lleva a la pestaña donde se corrige */
  function fallar(en: Pestana, mensaje: string) {
    setPestana(en)
    setError(mensaje)
  }

  function guardar() {
    const texto = registro.boton.texto.trim()
    if (registro.activo) {
      if (!texto) return fallar('apariencia', 'Ingrese la etiqueta del botón.')
      if (!registro.texto.trim()) {
        return fallar('pantalla', 'Ingrese el texto que el robot mostrará y reproducirá junto al código QR.')
      }
      if (!registro.despedida.trim()) return fallar('pantalla', 'Ingrese el mensaje de despedida sin nombre.')
      const errorFormulario = validarFormulario(registro.formulario, registro.despedida_nombre)
      if (errorFormulario) {
        // Los errores de la despedida con nombre se corrigen en Pantalla; los demás, en Formulario
        return fallar(errorFormulario.includes('{nombre}') ? 'pantalla' : 'formulario', errorFormulario)
      }
    }
    onGuardar({
      ...registro,
      boton: { ...registro.boton, texto },
      texto: registro.texto.trim(),
      despedida: registro.despedida.trim(),
      despedida_nombre: registro.despedida_nombre.trim(),
      formulario: limpiarFormulario(registro.formulario),
    })
    onCerrar()
  }

  return (
    <ModalPestanas
      titulo="Configuración del botón de registro"
      ayuda="El robot muestra un código QR que abre el formulario en el celular del visitante. Si el visitante se registra antes de que finalice el tiempo, el robot se despide con su nombre y retoma su recorrido."
      pestanas={PESTANAS}
      activa={pestana}
      onCambiar={(id) => setPestana(id as Pestana)}
      onCancelar={onCerrar}
      onAceptar={guardar}
      aviso={error}
    >
      {/* ───────── Apariencia ───────── */}
      {pestana === 'apariencia' && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 font-medium text-slate-800">
              Botón habilitado
              <Ayuda>Los botones deshabilitados no se muestran en el robot.</Ayuda>
            </span>
            <Interruptor activo={registro.activo} onChange={(activo) => cambiar({ activo })} etiqueta="Botón habilitado" />
          </div>

          <div>
            <p className="mb-2 font-medium text-slate-800">Etiqueta del botón</p>
            <input
              value={registro.boton.texto}
              maxLength={MAX_BOTON}
              onChange={(e) => cambiar({ boton: { ...registro.boton, texto: e.target.value.slice(0, MAX_BOTON) } })}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-1 text-right text-sm text-slate-400">
              {registro.boton.texto.length} / {MAX_BOTON}
            </p>
          </div>

          <AparienciaBoton
            valor={registro.boton}
            projectId={projectId}
            onChange={(boton) => setRegistro((actual) => ({ ...actual, boton }))}
          />
        </div>
      )}

      {/* ───────── Pantalla ───────── */}
      {pestana === 'pantalla' && (
        <div className="space-y-5">
          <CampoTexto
            label="Texto junto al código QR"
            ayuda="Se muestra en pantalla junto al código QR y se reproduce por voz."
            valor={registro.texto}
            max={MAX_TEXTO}
            filas={3}
            onChange={(texto) => cambiar({ texto })}
          />

          <div>
            <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
              Tiempo en pantalla
              <Ayuda>
                Cuenta regresiva para escanear el código y completar el formulario ({SEGUNDOS_PANTALLA_MIN} a{' '}
                {SEGUNDOS_PANTALLA_MAX} segundos).
              </Ayuda>
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={SEGUNDOS_PANTALLA_MIN}
                max={SEGUNDOS_PANTALLA_MAX}
                value={registro.segundos_pantalla}
                onChange={(e) =>
                  cambiar({
                    segundos_pantalla: Math.min(
                      SEGUNDOS_PANTALLA_MAX,
                      Math.max(SEGUNDOS_PANTALLA_MIN, Number(e.target.value) || 45)
                    ),
                  })
                }
                className="w-28 rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-slate-500">segundos</span>
            </div>
          </div>

          <CamposDespedida
            conNombre={registro.despedida_nombre}
            sinNombre={registro.despedida}
            ayudaSinNombre="Se reproduce si el tiempo finaliza sin que el visitante se registre."
            onConNombre={(despedida_nombre) => cambiar({ despedida_nombre })}
            onSinNombre={(despedida) => cambiar({ despedida })}
          />
        </div>
      )}

      {/* ───────── Formulario ───────── */}
      {pestana === 'formulario' && (
        <div className="space-y-5">
          <Link
            to={`/contactos?proyecto=${projectId}`}
            className="inline-block text-sm font-semibold text-indigo-600 hover:underline"
          >
            Ver contactos registrados →
          </Link>
          <ConfigFormulario origen="registro" valor={registro.formulario} onChange={(formulario) => cambiar({ formulario })} />
        </div>
      )}
    </ModalPestanas>
  )
}
