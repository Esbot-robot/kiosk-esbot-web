import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Modal } from '../Modal'
import { Ayuda } from '../Ayuda'
import { AparienciaBoton } from './AparienciaBoton'
import { CamposDespedida, CampoTexto, ConfigFormulario } from './ConfigFormulario'
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

/** Configura el botón de registro: QR al formulario, tiempo y despedidas */
export function DialogRegistro({ valor, projectId, onGuardar, onCerrar }: DialogRegistroProps) {
  const [registro, setRegistro] = useState(() => structuredClone(valor))
  const [error, setError] = useState('')

  const cambiar = (cambios: Partial<BotonRegistro>) => setRegistro((actual) => ({ ...actual, ...cambios }))

  function guardar() {
    const texto = registro.boton.texto.trim()
    if (registro.activo) {
      if (!texto) return setError('Escribe el texto que verá el visitante en el botón.')
      if (!registro.texto.trim()) return setError('Escribe el texto que el robot mostrará y dirá junto al QR.')
      if (!registro.despedida.trim()) return setError('Escribe la despedida sin nombre.')
      const errorFormulario = validarFormulario(registro.formulario, registro.despedida_nombre)
      if (errorFormulario) return setError(errorFormulario)
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
    <Modal
      titulo="Configurar botón de registro"
      ayuda="El robot muestra un QR que abre el formulario en el celular del visitante. Si alguien se registra antes de que acabe el tiempo, se despide con su nombre y sigue su ruta."
      onCancelar={onCerrar}
      onAceptar={guardar}
      textoAceptar="Guardar"
      aviso={error}
    >
      <div className="space-y-5">
        <Link to={`/contactos?proyecto=${projectId}`} className="inline-block text-sm font-semibold text-indigo-600 hover:underline">
          Ver contactos registrados →
        </Link>
        <label className="relative flex items-center gap-3 rounded-lg bg-slate-50 px-4 py-3 text-slate-800">
          <input
            type="checkbox"
            checked={registro.activo}
            onChange={(e) => cambiar({ activo: e.target.checked })}
            className="h-4 w-4 accent-indigo-600"
          />
          <span className="flex items-center gap-2 font-semibold">
            Mostrar este botón
            <Ayuda>Los botones desactivados no aparecen en el robot.</Ayuda>
          </span>
        </label>

        <div>
          <p className="mb-2 font-medium text-slate-800">Texto del botón</p>
          <input
            value={registro.boton.texto}
            maxLength={MAX_BOTON}
            onChange={(e) => cambiar({ boton: { ...registro.boton, texto: e.target.value.slice(0, MAX_BOTON) } })}
            className="w-full rounded-lg border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-right text-sm text-slate-400">
            {registro.boton.texto.length} / {MAX_BOTON} caracteres
          </p>
        </div>

        <AparienciaBoton
          valor={registro.boton}
          projectId={projectId}
          onChange={(boton) => setRegistro((actual) => ({ ...actual, boton }))}
        />

        <CampoTexto
          label="Texto junto al QR"
          ayuda="Se muestra en pantalla al lado del QR y el robot lo dice en voz alta."
          valor={registro.texto}
          max={MAX_TEXTO}
          filas={3}
          onChange={(texto) => cambiar({ texto })}
        />

        <div className="relative">
          <p className="mb-2 flex items-center gap-2 font-medium text-slate-800">
            Tiempo en pantalla
            <Ayuda>
              Cuenta regresiva para escanear y llenar el formulario ({SEGUNDOS_PANTALLA_MIN} a{' '}
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
            <span className="text-slate-600">segundos</span>
          </div>
        </div>

        <CamposDespedida
          conNombre={registro.despedida_nombre}
          sinNombre={registro.despedida}
          ayudaSinNombre="La dice el robot si se acaba el tiempo y nadie se registró."
          onConNombre={(despedida_nombre) => cambiar({ despedida_nombre })}
          onSinNombre={(despedida) => cambiar({ despedida })}
        />

        <ConfigFormulario origen="registro" valor={registro.formulario} onChange={(formulario) => cambiar({ formulario })} />
      </div>
    </Modal>
  )
}
