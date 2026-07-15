import { jsPDF } from 'jspdf'

/* ── Paleta de marca ── */
const NAVY: [number, number, number] = [22, 34, 63]
const BLUE: [number, number, number] = [42, 120, 214]
const AQUA: [number, number, number] = [27, 175, 122]
const MUTED: [number, number, number] = [110, 122, 150]
const TRACK: [number, number, number] = [225, 230, 240]
const INK: [number, number, number] = [26, 37, 66]

export interface RespuestaDist {
  texto: string
  conteo: number
}
export interface PreguntaDist {
  pregunta: string
  total: number
  respuestas: RespuestaDist[]
}

export interface DatosReporte {
  robotLabel: string
  desde: string // "YYYY-MM-DDTHH:mm"
  hasta: string
  granularidad: 'hora' | 'dia'
  totalToques: number
  totalJugar: number
  buckets: string[]
  serieToques: number[]
  serieJugar: number[]
  etiquetaBucket: (b: string) => string
  distribucion: PreguntaDist[]
}

function fechaLegible(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function generarReportePdf(d: DatosReporte) {
  const doc = construirReportePdf(d)
  const nombre = `Reporte_kioskEsbot_${d.desde.slice(0, 10)}_a_${d.hasta.slice(0, 10)}.pdf`
  doc.save(nombre)
}

/** Construye el documento (sin guardarlo) — separado para poder probarlo/renderizarlo */
export function construirReportePdf(d: DatosReporte): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth() // 595
  const H = doc.internal.pageSize.getHeight() // 842
  const M = 40
  let y = 0

  const pieDePagina = () => {
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text('Generado por Kiosk Esbot · esbot.co', M, H - 22)
    const pag = doc.getNumberOfPages()
    doc.text(`Página ${pag}`, W - M, H - 22, { align: 'right' })
  }

  const saltoSiHaceFalta = (alto: number) => {
    if (y + alto > H - 50) {
      pieDePagina()
      doc.addPage()
      y = M
    }
  }

  // ── Encabezado ──
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 96, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Reporte de interacciones', M, 46)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(200, 210, 232)
  doc.text('Kiosk Esbot · Experiencia interactiva con robot', M, 68)

  y = 128
  // Meta
  doc.setFontSize(10)
  doc.setTextColor(...MUTED)
  const robotTxt = d.robotLabel === 'todos' ? 'Todos los robots' : `Robot ${d.robotLabel}`
  doc.text(
    `${robotTxt}   ·   Del ${fechaLegible(d.desde)} al ${fechaLegible(d.hasta)}   ·   Generado ${fechaLegible(
      new Date().toISOString()
    )}`,
    M,
    y
  )
  y += 24

  // ── Resumen (dos tarjetas) ──
  const cardW = (W - 2 * M - 16) / 2
  const cardH = 78
  const dibujarKpi = (x: number, color: [number, number, number], valor: number, etiqueta: string) => {
    doc.setDrawColor(...TRACK)
    doc.setFillColor(250, 251, 253)
    doc.roundedRect(x, y, cardW, cardH, 6, 6, 'FD')
    doc.setFillColor(...color)
    doc.circle(x + 18, y + 22, 4, 'F')
    doc.setTextColor(...INK)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(26)
    doc.text(valor.toLocaleString('es-CO'), x + 16, y + 52)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text(etiqueta, x + 16, y + 68)
  }
  dibujarKpi(M, BLUE, d.totalToques, 'Toques de pantalla')
  dibujarKpi(M + cardW + 16, AQUA, d.totalJugar, 'Toques botón jugar')
  y += cardH + 30

  // ── Gráfica de interacciones ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text(`Interacciones por ${d.granularidad === 'hora' ? 'hora' : 'día'}`, M, y)
  y += 8
  // leyenda
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setFillColor(...BLUE)
  doc.circle(M + 6, y + 6, 3, 'F')
  doc.setTextColor(...MUTED)
  doc.text('Toques de pantalla', M + 14, y + 9)
  doc.setFillColor(...AQUA)
  doc.circle(M + 130, y + 6, 3, 'F')
  doc.text('Botón jugar', M + 138, y + 9)
  y += 20

  const chartX = M
  const chartY = y
  const chartW = W - 2 * M
  const chartH = 150
  const maxV = Math.max(1, ...d.serieToques, ...d.serieJugar)
  // eje base
  doc.setDrawColor(...TRACK)
  doc.line(chartX, chartY + chartH, chartX + chartW, chartY + chartH)
  const n = d.buckets.length
  const grupoW = chartW / Math.max(1, n)
  const barW = Math.min(10, grupoW / 3)
  const pasoEtiqueta = Math.max(1, Math.ceil(n / 12))
  for (let i = 0; i < n; i++) {
    const cx = chartX + i * grupoW + grupoW / 2
    const hT = (d.serieToques[i] / maxV) * chartH
    const hJ = (d.serieJugar[i] / maxV) * chartH
    doc.setFillColor(...BLUE)
    doc.rect(cx - barW - 1, chartY + chartH - hT, barW, hT, 'F')
    doc.setFillColor(...AQUA)
    doc.rect(cx + 1, chartY + chartH - hJ, barW, hJ, 'F')
    if (i % pasoEtiqueta === 0) {
      doc.setFontSize(7)
      doc.setTextColor(...MUTED)
      doc.text(d.etiquetaBucket(d.buckets[i]), cx, chartY + chartH + 12, { align: 'center' })
    }
  }
  y = chartY + chartH + 34

  // ── Distribución de respuestas ──
  saltoSiHaceFalta(40)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...INK)
  doc.text('Respuestas por pregunta', M, y)
  y += 20

  if (d.distribucion.length === 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...MUTED)
    doc.text('No se registraron respuestas de quiz en este rango.', M, y)
    y += 20
  } else {
    for (const preg of d.distribucion) {
      const altoPregunta = 22 + preg.respuestas.length * 24 + 12
      saltoSiHaceFalta(altoPregunta)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(11)
      doc.setTextColor(...INK)
      const lineas = doc.splitTextToSize(preg.pregunta, W - 2 * M)
      doc.text(lineas, M, y)
      y += lineas.length * 14 + 6
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      for (const r of preg.respuestas) {
        const pct = preg.total > 0 ? Math.round((r.conteo / preg.total) * 100) : 0
        // etiqueta
        doc.setTextColor(...INK)
        const etq = doc.splitTextToSize(r.texto, W - 2 * M - 120)[0]
        doc.text(etq, M, y + 9)
        // barra
        const barY = y + 13
        const barMaxW = W - 2 * M
        doc.setFillColor(...TRACK)
        doc.roundedRect(M, barY, barMaxW, 6, 3, 3, 'F')
        doc.setFillColor(...BLUE)
        const w = Math.max(2, (pct / 100) * barMaxW)
        doc.roundedRect(M, barY, w, 6, 3, 3, 'F')
        // conteo + %
        doc.setTextColor(...MUTED)
        doc.text(`${r.conteo} (${pct}%)`, W - M, y + 9, { align: 'right' })
        y += 24
      }
      y += 10
    }
  }

  pieDePagina()
  return doc
}
