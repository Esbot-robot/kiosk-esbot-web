/**
 * Animación de carga: un círculo de 8 puntos que crecen y se oscurecen hacia
 * el más grande, girando a saltos. Color del menú (slate-800). Para lectores de
 * pantalla anuncia el texto, que no se ve.
 */
export function Cargando({ texto = 'Cargando…', className = 'py-12' }: { texto?: string; className?: string }) {
  const puntos = Array.from({ length: 8 }, (_, i) => {
    const angulo = (i * 45 - 90) * (Math.PI / 180)
    return { x: 20 + 14 * Math.cos(angulo), y: 20 + 14 * Math.sin(angulo), r: 1.8 + i * 0.35, opacidad: 0.15 + i * 0.12 }
  })
  return (
    <div role="status" aria-live="polite" className={`flex justify-center ${className}`}>
      <svg viewBox="0 0 40 40" className="cargando-giro h-10 w-10 text-slate-800" aria-hidden="true">
        {puntos.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={p.r} fill="currentColor" opacity={p.opacidad} />
        ))}
      </svg>
      <span className="sr-only">{texto}</span>
    </div>
  )
}
