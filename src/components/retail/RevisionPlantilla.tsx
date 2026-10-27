import { Modal } from '../Modal'
import { Advertencia } from '../Advertencia'
import { avisosZonas, estadoCupon, hoyColombia } from '../../lib/retail'
import type { FilaOmitida } from '../../lib/retailPlantilla'
import type { CuponRetail } from '../../types/config'

/**
 * Lo que trae la plantilla antes de usarla: cuántos cupones están activos hoy,
 * cuántos se activan después y cuántos ya vencieron, las filas que no se pueden
 * usar (con su motivo) y las zonas que quedarían sin cupones activos. Aceptar
 * reemplaza la lista completa: la plantilla es la única fuente de los cupones.
 */
export function RevisionPlantilla({
  archivo,
  cupones,
  omitidas,
  pendientes,
  cuponesActuales,
  onAceptar,
  onCancelar,
}: {
  archivo: string
  cupones: CuponRetail[]
  omitidas: FilaOmitida[]
  /** cupones que nombran una imagen aún no subida al panel: entran, pero el robot no los ofrece hasta tenerla */
  pendientes: FilaOmitida[]
  cuponesActuales: number
  onAceptar: () => void
  onCancelar: () => void
}) {
  const hoy = hoyColombia()
  const estados = cupones.map((c) => estadoCupon(c, hoy).estado)
  const activos = estados.filter((e) => e === 'activo').length
  const proximos = estados.filter((e) => e === 'por_activar').length
  const vencidos = estados.filter((e) => e === 'vencido').length
  const avisos = avisosZonas(cupones.filter((c) => c.imagen_url), hoy)

  return (
    <Modal
      titulo="Revisión de la plantilla"
      ancho="max-w-2xl"
      onCancelar={onCancelar}
      onAceptar={onAceptar}
      aceptarDeshabilitado={cupones.length === 0}
      textoAceptar="Aplicar cupones"
    >
      <p className="truncate font-semibold text-slate-900">{archivo}</p>

      {cupones.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-emerald-50 px-3 py-4">
            <p className="text-2xl font-bold text-emerald-700">{activos}</p>
            <p className="text-sm text-emerald-700">{activos === 1 ? 'Activo hoy' : 'Activos hoy'}</p>
          </div>
          <div className="rounded-lg bg-sky-50 px-3 py-4">
            <p className="text-2xl font-bold text-sky-700">{proximos}</p>
            <p className="text-sm text-sky-700">{proximos === 1 ? 'Próximo' : 'Próximos'}</p>
          </div>
          <div className="rounded-lg bg-slate-100 px-3 py-4">
            <p className="text-2xl font-bold text-slate-600">{vencidos}</p>
            <p className="text-sm text-slate-600">{vencidos === 1 ? 'Vencido' : 'Vencidos'}</p>
          </div>
        </div>
      ) : (
        <Advertencia className="mt-4">Ninguna fila de la plantilla es válida. Revise los motivos a continuación.</Advertencia>
      )}

      {avisos.length > 0 && (
        <div className="mt-4 space-y-1">
          {avisos.map((aviso) => (
            <Advertencia key={aviso}>{aviso}</Advertencia>
          ))}
        </div>
      )}

      {pendientes.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold text-slate-800">
            {pendientes.length === 1 ? '1 cupón espera su imagen' : `${pendientes.length} cupones esperan su imagen`}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-amber-50 px-4 py-3 text-sm text-slate-700">
            {pendientes.map((o) => (
              <li key={`${o.fila}-${o.motivo}`}>
                <span className="font-semibold">
                  Fila {o.fila}
                  {o.nombre && ` (${o.nombre})`}:
                </span>{' '}
                {o.motivo}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-slate-500">
            Se cargan igual: súbalas después con «Subir imágenes». Mientras tanto, el robot no ofrecerá esos cupones.
          </p>
        </div>
      )}

      {omitidas.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold text-slate-800">
            {omitidas.length === 1 ? '1 fila no se cargará' : `${omitidas.length} filas no se cargarán`}
          </p>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {omitidas.map((o) => (
              <li key={`${o.fila}-${o.motivo}`}>
                <span className="font-semibold">
                  Fila {o.fila}
                  {o.nombre && ` (${o.nombre})`}:
                </span>{' '}
                {o.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {cuponesActuales > 0 && cupones.length > 0 && (
        <p className="mt-5 text-sm text-slate-500">
          {cupones.length === 1 ? 'El cupón de esta plantilla reemplazará' : `Los ${cupones.length} cupones de esta plantilla reemplazarán`}{' '}
          {cuponesActuales === 1 ? 'el cupón actual' : `los ${cuponesActuales} actuales`}. Los cambios se aplicarán al pulsar «Guardar».
        </p>
      )}
    </Modal>
  )
}
