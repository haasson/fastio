import { jsPDF } from 'jspdf'
import { renderQrToDataUrl } from '~/shared/utils/renderQr'

type TableQrItem = {
  name: string
  url: string
  copies: number
}

const loadFont = async (doc: jsPDF) => {
  const [regular, bold] = await Promise.all([
    fetch('/fonts/Roboto-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Roboto-Bold.ttf').then((r) => r.arrayBuffer()),
  ])

  const toBase64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf)
    let binary = ''

    for (const byte of bytes) binary += String.fromCharCode(byte)

    return btoa(binary)
  }

  doc.addFileToVFS('Roboto-Regular.ttf', toBase64(regular))
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
  doc.addFileToVFS('Roboto-Bold.ttf', toBase64(bold))
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold')
}

export const generateTableQrPdf = async (
  items: TableQrItem[],
  restaurantName: string,
): Promise<void> => {
  const doc = new jsPDF('portrait', 'mm', 'a4')

  await loadFont(doc)

  const pageW = 210
  const pageH = 297
  const margin = 15
  const cols = 3
  const cardW = (pageW - margin * 2) / cols
  const cardH = 75
  const qrSize = 45
  const rows = Math.floor((pageH - margin * 2) / cardH)
  const perPage = cols * rows

  // Expand items by copies
  const expanded: { name: string; url: string }[] = []

  for (const item of items) {
    for (let c = 0; c < item.copies; c++) {
      expanded.push({ name: item.name, url: item.url })
    }
  }

  for (let i = 0; i < expanded.length; i++) {
    const indexOnPage = i % perPage
    const col = indexOnPage % cols
    const row = Math.floor(indexOnPage / cols)

    if (i > 0 && indexOnPage === 0) doc.addPage()

    const x = margin + col * cardW
    const y = margin + row * cardH

    // Dashed card border
    doc.setDrawColor(200)
    doc.setLineDashPattern([1, 1], 0)
    doc.rect(x, y, cardW, cardH)

    // QR code
    const imgData = await renderQrToDataUrl(expanded[i].url, qrSize * 4)
    const qrX = x + (cardW - qrSize) / 2
    const qrY = y + 5

    doc.addImage(imgData, 'PNG', qrX, qrY, qrSize, qrSize)

    // Table name
    doc.setFontSize(11)
    doc.setFont('Roboto', 'bold')
    doc.setTextColor(0)
    const nameY = qrY + qrSize + 6

    doc.text(expanded[i].name, x + cardW / 2, nameY, { align: 'center' })

    // Restaurant name
    doc.setFontSize(8)
    doc.setFont('Roboto', 'normal')
    doc.setTextColor(120)
    doc.text(restaurantName, x + cardW / 2, nameY + 5, { align: 'center' })
  }

  doc.save(`qr-${restaurantName}.pdf`)
}
