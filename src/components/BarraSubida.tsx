import { formatoMB, type ProgresoSubida } from '../lib/storage'

function formatoVelocidad(bytesPorSegundo: number): string {
  if (bytesPorSegundo >= 1024 * 1024) return `${(bytesPorSegundo / 1024 / 1024).toFixed(1)} MB/s`
  return `${Math.round(bytesPorSegundo / 1024)} KB/s`
}

/**
 * Avance de una subida: porcentaje, megas enviados y velocidad.
 * La velocidad es lo que responde "¿es el internet?": si marca pocos KB/s,
 * la subida está bien pero la red es lenta.
 */
export function BarraSubida({ progreso }: { progreso: ProgresoSubida | null }) {
  const porcentaje = progreso && progreso.total > 0 ? Math.round((progreso.enviados / progreso.total) * 100) : 0
  const terminando = porcentaje >= 100

  return (
    <div className="w-full">
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-indigo-600 transition-[width] duration-300"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
      <p className="mt-2 flex justify-between gap-3 text-sm text-slate-500">
        <span className="font-semibold text-slate-700">
          {terminando ? 'Procesando…' : `Subiendo ${porcentaje}%`}
        </span>
        {progreso && (
          <span className="font-mono">
            {formatoMB(progreso.enviados)} de {formatoMB(progreso.total)}
            {!terminando && ` · ${formatoVelocidad(progreso.velocidad)}`}
          </span>
        )}
      </p>
    </div>
  )
}
