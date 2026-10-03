import { GState, jsPDF } from 'jspdf'
import logoEsbotUrl from '../assets/logo-esbot.png'

type RGB = [number, number, number]

/* ── Paleta de la marca Esbot (tomada del logo) ── */
const MARINO: RGB = [26, 36, 64] // #1A2440, la "E" y el texto del logo
const REAL: RGB = [47, 85, 164] // #2F55A4, la "B"
const CELESTE: RGB = [163, 216, 230] // #A3D8E6, los nodos claros
const TINTA: RGB = [30, 41, 61]
const GRIS: RGB = [112, 122, 140]
const LINEA: RGB = [226, 232, 240]
const FONDO: RGB = [245, 248, 252]

/* Colores de cada tipo de evento: los mismos de la gráfica del panel */
const COLOR_TOQUE: RGB = [42, 120, 214]
const COLOR_JUGAR: RGB = [27, 175, 122]
const COLOR_VIDEO: RGB = [139, 92, 246]
const COLOR_UBICACION: RGB = [229, 122, 40]

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
  totalVideos: number
  totalUbicaciones: number
  buckets: string[]
  serieToques: number[]
  serieJugar: number[]
  serieVideos: number[]
  serieUbicaciones: number[]
  etiquetaBucket: (b: string) => string
  distribucion: PreguntaDist[]
}

/** Imágenes que el documento incrusta (data URL PNG) */
export interface RecursosReporte {
  /** logo de Esbot con la palabra, proporción 714 × 349 */
  logo?: string
}

const PROPORCION_LOGO = 714 / 349

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' }).replace('.', '')
}

function numero(n: number): string {
  return n.toLocaleString('es-CO')
}

/** El logo se baja como data URL: jsPDF no puede leer la ruta del asset */
async function cargarLogo(): Promise<string | undefined> {
  try {
    const respuesta = await fetch(logoEsbotUrl)
    const blob = await respuesta.blob()
    return await new Promise((resolve) => {
      const lector = new FileReader()
      lector.onload = () => resolve(lector.result as string)
      lector.onerror = () => resolve(undefined)
      lector.readAsDataURL(blob)
    })
  } catch {
    // Sin logo el reporte sale igual, con el nombre en texto
    return undefined
  }
}

export async function generarReportePdf(d: DatosReporte) {
  const doc = construirReportePdf(d, { logo: await cargarLogo() })
  const nombre = `Reporte_Esbot_${d.desde.slice(0, 10)}_a_${d.hasta.slice(0, 10)}.pdf`
  doc.save(nombre)
}

/** Construye el documento (sin guardarlo): separado para poder probarlo */
export function construirReportePdf(d: DatosReporte, recursos: RecursosReporte = {}): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth() // 595
  const H = doc.internal.pageSize.getHeight() // 842
  const M = 44

  // ───── Utilidades de dibujo ─────

  /** Polígono relleno a partir de sus esquinas */
  const poligono = (puntos: [number, number][], color: RGB, opacidad = 1) => {
    if (opacidad < 1) {
      doc.saveGraphicsState()
      doc.setGState(new GState({ opacity: opacidad }))
    }
    doc.setFillColor(...color)
    const [x0, y0] = puntos[0]
    const tramos = puntos.slice(1).map(([x, y], i) => [x - puntos[i][0], y - puntos[i][1]])
    doc.lines(tramos, x0, y0, [1, 1], 'F', true)
    if (opacidad < 1) doc.restoreGraphicsState()
  }

  const texto = (
    contenido: string | string[],
    x: number,
    y: number,
    { tam = 10, color = TINTA, negrita = false, alinear = 'left' as 'left' | 'right' | 'center' } = {}
  ) => {
    doc.setFont('helvetica', negrita ? 'bold' : 'normal')
    doc.setFontSize(tam)
    doc.setTextColor(...color)
    doc.text(contenido, x, y, { align: alinear })
  }

  /** Etiqueta pequeña en mayúsculas con espaciado, como en un informe impreso */
  const etiqueta = (contenido: string, x: number, y: number, color: RGB = GRIS, alinear: 'left' | 'right' = 'left') => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...color)
    doc.setCharSpace(1.2)
    doc.text(contenido.toUpperCase(), x, y, { align: alinear })
    doc.setCharSpace(0)
  }

  /** Titular en dos tonos: "RESUMEN DE" marino + "INTERACCIONES" real */
  const titular = (parte1: string, parte2: string, x: number, y: number, tam: number) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(tam)
    doc.setTextColor(...MARINO)
    doc.text(parte1, x, y)
    // getTextWidth ignora el espacio final: se suma un espacio proporcional al tamaño
    const ancho = doc.getTextWidth(parte1) + tam * 0.45
    doc.setTextColor(...REAL)
    doc.text(parte2, x + ancho, y)
  }

  const logo = (x: number, y: number, ancho: number) => {
    if (recursos.logo) {
      // Mismo alias en todas las páginas: el PNG se incrusta una sola vez, comprimido
      doc.addImage(recursos.logo, 'PNG', x, y, ancho, ancho / PROPORCION_LOGO, 'logo-esbot', 'FAST')
    } else {
      texto('EsBot', x, y + ancho / PROPORCION_LOGO / 2 + 8, { tam: ancho / 5, color: MARINO, negrita: true })
    }
  }

  const robotTxt = d.robotLabel === 'todos' ? 'Todos los robots' : `Robot ${d.robotLabel}`
  const rangoTxt = `${fechaLarga(d.desde)} — ${fechaLarga(d.hasta)}`

  /** Encabezado de las páginas interiores */
  const encabezado = (seccion: string) => {
    logo(M, 26, 92)
    etiqueta(seccion, W - M, 44, REAL, 'right')
    texto(`${robotTxt} · ${fechaCorta(d.desde)} – ${fechaCorta(d.hasta)}`, W - M, 58, { tam: 8.5, color: GRIS, alinear: 'right' })
    doc.setDrawColor(...CELESTE)
    doc.setLineWidth(1)
    doc.line(M, 84, W - M, 84)
    // Acento diagonal arriba a la derecha
    poligono([[W - 70, 0], [W, 0], [W, 26]], REAL)
    poligono([[W - 34, 0], [W, 0], [W, 13]], CELESTE)
  }

  // ═════════════ Página 1: portada de Esbot ═════════════

  // Esquina superior derecha
  poligono([[W - 210, 0], [W, 0], [W, 120]], MARINO)
  poligono([[W - 130, 0], [W, 0], [W, 74]], REAL)
  poligono([[W - 60, 0], [W, 0], [W, 34]], CELESTE)

  logo(M, 52, 170)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(40)
  doc.setTextColor(...MARINO)
  doc.text('REPORTE DE', M, 345)
  doc.setTextColor(...REAL)
  doc.text('INTERACCIONES', M, 390)
  doc.setFillColor(...CELESTE)
  doc.rect(M, 410, 64, 5, 'F')
  texto('Experiencias interactivas con robots', M, 440, { tam: 12, color: GRIS })

  // Franjas diagonales de la parte de abajo
  poligono([[0, 585], [W, 470], [W, 492], [0, 607]], CELESTE)
  poligono([[0, 622], [W, 507], [W, H], [0, H]], REAL)
  poligono([[W * 0.42, H], [W, 610], [W, H]], MARINO)
  poligono([[0, 622], [W, 507], [W, 560], [0, 675]], MARINO, 0.18)

  const anioDesde = d.desde.slice(0, 4)
  const anioHasta = d.hasta.slice(0, 4)
  texto(anioDesde === anioHasta ? anioHasta : `${anioDesde}–${anioHasta}`, M, 715, { tam: 54, color: [255, 255, 255], negrita: true })
  texto(rangoTxt, M, 742, { tam: 11, color: [255, 255, 255] })
  texto(robotTxt, M, 760, { tam: 10, color: CELESTE })

  // ═════════════ Página 2: resumen ═════════════

  doc.addPage()
  encabezado('Resumen')
  titular('RESUMEN DE', 'INTERACCIONES', M, 126, 22)

  const tipos = [
    { nombre: 'Toques de pantalla', valor: d.totalToques, serie: d.serieToques, color: COLOR_TOQUE },
    { nombre: 'Botón jugar', valor: d.totalJugar, serie: d.serieJugar, color: COLOR_JUGAR },
    { nombre: 'Botón video', valor: d.totalVideos, serie: d.serieVideos, color: COLOR_VIDEO },
    { nombre: 'Guías a ubicación', valor: d.totalUbicaciones, serie: d.serieUbicaciones, color: COLOR_UBICACION },
  ]
  const total = tipos.reduce((s, t) => s + t.valor, 0)
  const porBucket = d.buckets.map((_, i) => tipos.reduce((s, t) => s + (t.serie[i] ?? 0), 0))
  const iPico = porBucket.reduce((mejor, v, i) => (v > porBucket[mejor] ? i : mejor), 0)
  const unidad = d.granularidad === 'hora' ? 'hora' : 'día'
  const promedio = d.buckets.length > 0 ? Math.round(total / d.buckets.length) : 0

  // Bloque de la cifra principal
  const bloqueY = 150
  doc.setFillColor(...FONDO)
  doc.rect(M, bloqueY, W - 2 * M, 104, 'F')
  doc.setFillColor(...REAL)
  doc.rect(M, bloqueY, 5, 104, 'F')
  texto(numero(total), M + 26, bloqueY + 60, { tam: 46, color: REAL, negrita: true })
  texto('interacciones en total', M + 28, bloqueY + 82, { tam: 11, color: GRIS })

  const colDer = M + (W - 2 * M) * 0.56
  etiqueta(`${unidad} con más actividad`, colDer, bloqueY + 32)
  texto(
    d.buckets.length > 0 && porBucket[iPico] > 0
      ? `${d.etiquetaBucket(d.buckets[iPico])}  ·  ${numero(porBucket[iPico])}`
      : '—',
    colDer,
    bloqueY + 50,
    { tam: 15, color: MARINO, negrita: true }
  )
  etiqueta(`Promedio por ${unidad}`, colDer, bloqueY + 74)
  texto(numero(promedio), colDer, bloqueY + 92, { tam: 15, color: MARINO, negrita: true })

  // Los cuatro tipos, numerados
  const gridY = 282
  const celdaW = (W - 2 * M - 24) / 2
  const celdaH = 74
  tipos.forEach((tipo, i) => {
    const x = M + (i % 2) * (celdaW + 24)
    const y = gridY + Math.floor(i / 2) * (celdaH + 14)
    doc.setFillColor(...tipo.color)
    doc.circle(x + 14, y + 16, 14, 'F')
    texto(String(i + 1), x + 14, y + 20.5, { tam: 12, color: [255, 255, 255], negrita: true, alinear: 'center' })
    etiqueta(tipo.nombre, x + 40, y + 12)
    texto(numero(tipo.valor), x + 40, y + 34, { tam: 20, color: MARINO, negrita: true })
    const pct = total > 0 ? Math.round((tipo.valor / total) * 100) : 0
    texto(`${pct}%`, x + celdaW, y + 34, { tam: 11, color: GRIS, negrita: true, alinear: 'right' })
    // Participación sobre el total
    doc.setFillColor(...LINEA)
    doc.rect(x + 40, y + 46, celdaW - 40, 4, 'F')
    doc.setFillColor(...tipo.color)
    doc.rect(x + 40, y + 46, Math.max(2, ((celdaW - 40) * pct) / 100), 4, 'F')
  })

  // Gráfica de actividad
  const secY = gridY + 2 * (celdaH + 14) + 22
  etiqueta(`Actividad por ${unidad}`, M, secY, REAL)
  let leyendaX = W - M
  ;[...tipos].reverse().forEach((tipo) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    const ancho = doc.getTextWidth(tipo.nombre)
    leyendaX -= ancho
    texto(tipo.nombre, leyendaX, secY, { tam: 8, color: GRIS })
    doc.setFillColor(...tipo.color)
    doc.circle(leyendaX - 7, secY - 2.6, 3, 'F')
    leyendaX -= 22
  })

  const gX = M + 26
  const gY = secY + 22
  const gW = W - M - gX
  const gH = 190
  const n = d.buckets.length
  const maxV = Math.max(1, ...tipos.flatMap((t) => t.serie))
  // Escala "redonda" para el eje: 4 divisiones
  const paso = Math.max(1, Math.ceil(maxV / 4 / Math.pow(10, Math.floor(Math.log10(maxV / 4 || 1)))) * Math.pow(10, Math.floor(Math.log10(maxV / 4 || 1))))
  const tope = paso * 4
  doc.setLineWidth(0.5)
  for (let k = 0; k <= 4; k++) {
    const yy = gY + gH - (gH * k) / 4
    doc.setDrawColor(...LINEA)
    doc.line(gX, yy, gX + gW, yy)
    texto(numero(paso * k), gX - 6, yy + 3, { tam: 7, color: GRIS, alinear: 'right' })
  }
  const xDe = (i: number) => (n <= 1 ? gX + gW / 2 : gX + (gW * i) / (n - 1))
  const yDe = (v: number) => gY + gH - (gH * v) / tope

  if (total === 0) {
    texto('Sin interacciones en este rango.', gX + gW / 2, gY + gH / 2, { tam: 10, color: GRIS, alinear: 'center' })
  } else {
    // Área suave bajo los toques, la serie principal
    if (n > 1) {
      poligono(
        [[xDe(0), gY + gH], ...d.serieToques.map((v, i) => [xDe(i), yDe(v)] as [number, number]), [xDe(n - 1), gY + gH]],
        COLOR_TOQUE,
        0.12
      )
    }
    tipos.forEach((tipo) => {
      doc.setDrawColor(...tipo.color)
      doc.setLineWidth(1.6)
      for (let i = 1; i < n; i++) doc.line(xDe(i - 1), yDe(tipo.serie[i - 1]), xDe(i), yDe(tipo.serie[i]))
      if (n <= 31) {
        doc.setFillColor(...tipo.color)
        for (let i = 0; i < n; i++) doc.circle(xDe(i), yDe(tipo.serie[i]), 1.8, 'F')
      }
    })
  }
  const pasoEtiqueta = Math.max(1, Math.ceil(n / 10))
  for (let i = 0; i < n; i += pasoEtiqueta) {
    texto(d.etiquetaBucket(d.buckets[i]), xDe(i), gY + gH + 14, { tam: 7, color: GRIS, alinear: 'center' })
  }

  // ═════════════ Página 3 en adelante: respuestas del quiz ═════════════

  if (d.distribucion.length === 0) {
    texto('No se registraron respuestas del quiz en este rango.', M, gY + gH + 44, { tam: 9.5, color: GRIS })
  } else {
    doc.addPage()
    encabezado('Quiz')
    titular('RESPUESTAS DEL', 'QUIZ', M, 126, 22)

    const colW = (W - 2 * M - 28) / 2
    const altoPregunta = (p: PreguntaDist) => {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      const lineas = doc.splitTextToSize(p.pregunta, colW - 40).length
      return 38 + Math.max(lineas, 1) * 13 + p.respuestas.length * 30
    }
    let y = 150
    for (let i = 0; i < d.distribucion.length; i += 2) {
      const fila = d.distribucion.slice(i, i + 2)
      const altoFila = Math.max(...fila.map(altoPregunta))
      if (y + altoFila > H - 70) {
        doc.addPage()
        encabezado('Quiz')
        y = 112
      }
      fila.forEach((p, j) => {
        const x = M + j * (colW + 28)
        const num = i + j + 1
        // Número de la pregunta
        doc.setFillColor(...REAL)
        doc.rect(x, y, 26, 26, 'F')
        texto(String(num).padStart(2, '0'), x + 13, y + 17.5, { tam: 11, color: [255, 255, 255], negrita: true, alinear: 'center' })
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10)
        const lineas = doc.splitTextToSize(p.pregunta, colW - 40)
        texto(lineas, x + 38, y + 10, { tam: 10, color: MARINO, negrita: true })
        let yy = y + 18 + lineas.length * 13
        texto(`${numero(p.total)} ${p.total === 1 ? 'respuesta' : 'respuestas'}`, x + 38, yy, { tam: 8, color: GRIS })
        yy += 16
        const maxConteo = Math.max(...p.respuestas.map((r) => r.conteo))
        p.respuestas.forEach((r) => {
          const pct = p.total > 0 ? Math.round((r.conteo / p.total) * 100) : 0
          const gana = r.conteo === maxConteo && r.conteo > 0
          const etq = doc.splitTextToSize(r.texto, colW - 60)[0]
          texto(etq, x, yy + 8, { tam: 9, color: TINTA, negrita: gana })
          texto(`${pct}%`, x + colW, yy + 8, { tam: gana ? 11 : 9, color: gana ? REAL : GRIS, negrita: true, alinear: 'right' })
          doc.setFillColor(...LINEA)
          doc.rect(x, yy + 13, colW, 6, 'F')
          doc.setFillColor(...(gana ? REAL : CELESTE))
          doc.rect(x, yy + 13, Math.max(2, (colW * pct) / 100), 6, 'F')
          yy += 30
        })
      })
      y += altoFila + 26
    }
  }

  // ───── Franja al pie de las páginas interiores (la portada no lleva) ─────
  const paginas = doc.getNumberOfPages()
  for (let p = 2; p <= paginas; p++) {
    doc.setPage(p)
    poligono([[0, H - 10], [W, H - 22], [W, H], [0, H]], REAL)
    poligono([[0, H - 14], [W, H - 26], [W, H - 22], [0, H - 10]], CELESTE)
  }
  doc.setPage(paginas)
  return doc
}
