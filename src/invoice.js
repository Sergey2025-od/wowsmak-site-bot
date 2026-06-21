import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import PDFDocument from 'pdfkit'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FONT_REG = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans.ttf')
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'DejaVuSans-Bold.ttf')
const LOGO = path.join(__dirname, '..', 'assets', 'logo.png')

const SHOP_NAME = 'WowSmak'

// ---------- Допоміжні ----------
function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function money(value) {
  const n = Math.round(Number(value) * 100) / 100
  return `${n.toLocaleString('uk-UA')} ₴`
}

function stockText(stock) {
  if (stock == null) return '∞'
  return `${stock} шт.`
}

function formatDate(value) {
  const d = value ? new Date(value) : new Date()
  try {
    return d.toLocaleString('uk-UA', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Kyiv',
    })
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ')
  }
}

// ---------- Допоміжні для моноширинної таблиці ----------
function padR(s, n) {
  s = String(s ?? '')
  return s.length >= n ? s : s + ' '.repeat(n - s.length)
}

function padL(s, n) {
  s = String(s ?? '')
  return s.length >= n ? s : ' '.repeat(n - s.length) + s
}

// Переносить текст по словах у рядки шириною до width символів.
function wrapText(text, width) {
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const lines = []
  let cur = ''
  const hardPush = (w) => {
    let rest = w
    while (rest.length > width) {
      lines.push(rest.slice(0, width))
      rest = rest.slice(width)
    }
    cur = rest
  }
  for (const w of words) {
    if (!cur) {
      if (w.length <= width) cur = w
      else hardPush(w)
    } else if ((cur + ' ' + w).length <= width) {
      cur += ' ' + w
    } else {
      lines.push(cur)
      cur = ''
      if (w.length <= width) cur = w
      else hardPush(w)
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

// Будує вирівняну таблицю товарів (для <pre>).
// Назви не обрізаються — довгі переносяться на декілька рядків; штрих-код окремим рядком.
function itemsTable(items) {
  const W = { title: 13, qty: 4, price: 7, sum: 8 }
  const head =
    padR('Товар', W.title) +
    padL('К-ть', W.qty) +
    padL('Ціна', W.price) +
    padL('Сума', W.sum)
  const sep = '─'.repeat(W.title + W.qty + W.price + W.sum)
  const out = [head, sep]
  items.forEach((it, i) => {
    const prefix = `${i + 1}. `
    const indent = ' '.repeat(prefix.length)
    const titleLines = wrapText(it.title, W.title - prefix.length)
    out.push(
      padR(prefix + (titleLines[0] || ''), W.title) +
        padL(String(it.qty), W.qty) +
        padL(money(it.price), W.price) +
        padL(money(it.sum), W.sum),
    )
    for (let k = 1; k < titleLines.length; k++) out.push(indent + titleLines[k])
    if (it.barcode) out.push(padR('🔖', prefix.length) + it.barcode)
  })
  out.push(sep)
  out.push(padR('Разом:', W.title + W.qty + W.price) + padL(money(items.reduce((s, it) => s + it.sum, 0)), W.sum))
  return out.join('\n')
}

// ---------- Текст накладної для повідомлення в Telegram (HTML) ----------
export function invoiceMessageHtml(inv) {
  const lines = []
  lines.push(`🧾 <b>НАКЛАДНА № ${inv.id}</b>`)
  lines.push(`🗓 ${escapeHtml(formatDate(inv.createdAt))}`)
  lines.push('')
  lines.push(`👤 <b>Клієнт:</b> ${escapeHtml(inv.fullName || '—')}`)
  lines.push(`📞 <b>Телефон:</b> ${escapeHtml(inv.phone || '—')}`)
  if (inv.fop) lines.push(`🏢 <b>ФОП/ЧП:</b> ${escapeHtml(inv.fop)}`)
  lines.push(`📍 <b>Адреса:</b> ${escapeHtml(inv.address || '—')}`)
  if (inv.comment) lines.push(`💬 <b>Коментар:</b> ${escapeHtml(inv.comment)}`)
  lines.push('')
  lines.push('🛒 <b>Товари:</b>')
  lines.push(`<pre>${escapeHtml(itemsTable(inv.items))}</pre>`)
  lines.push(`💰 <b>Разом до сплати: ${money(inv.total)}</b>`)
  return lines.join('\n')
}

// ---------- Завантаження зображень (для таблиці в PDF) ----------
async function fetchBuffer(url) {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

// ---------- PDF-накладна ----------
// Колонки таблиці (x від лівого поля, ширина)
const COLS = {
  num: { x: 40, w: 24, label: '№' },
  photo: { x: 64, w: 46, label: 'Фото' },
  title: { x: 110, w: 180, label: 'Товар' },
  barcode: { x: 290, w: 110, label: 'Штрих-код' },
  qty: { x: 400, w: 45, label: 'К-сть' },
  price: { x: 445, w: 55, label: 'Ціна' },
  sum: { x: 500, w: 55, label: 'Сума' },
}
const TABLE_RIGHT = 555
const ROW_H = 46

function drawTableHeader(doc, y) {
  doc.save()
  doc.rect(40, y, TABLE_RIGHT - 40, 22).fill('#f3e8fb')
  doc.fillColor('#5b2a86').font('bold').fontSize(8)
  for (const key of Object.keys(COLS)) {
    const c = COLS[key]
    doc.text(c.label, c.x + 2, y + 7, { width: c.w - 4, align: key === 'title' || key === 'barcode' ? 'left' : 'center' })
  }
  doc.restore()
  return y + 22
}

export async function buildInvoicePdf(inv) {
  // Префетчимо мініатюри товарів
  const images = {}
  await Promise.all(
    inv.items.map(async (it, i) => {
      images[i] = await fetchBuffer(it.imageUrl)
    }),
  )

  return await new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 })
      const chunks = []
      doc.on('data', (c) => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      doc.registerFont('reg', FONT_REG)
      doc.registerFont('bold', FONT_BOLD)

      const pageBottom = doc.page.height - 40

      // Шапка з логотипом
      let headerBottom = 70
      try {
        if (fs.existsSync(LOGO)) {
          doc.image(LOGO, 40, 30, { fit: [170, 62] })
          headerBottom = 100
        } else {
          doc.font('bold').fontSize(20).fillColor('#d6248c').text(SHOP_NAME, 40, 40)
        }
      } catch {
        doc.font('bold').fontSize(20).fillColor('#d6248c').text(SHOP_NAME, 40, 40)
      }

      doc.font('bold').fontSize(16).fillColor('#1d0f25').text(`Накладна № ${inv.id}`, 40, headerBottom)
      doc.font('reg').fontSize(10).fillColor('#555').text(formatDate(inv.createdAt), 40, headerBottom + 22)

      // Блок клієнта
      let y = headerBottom + 48
      doc.font('reg').fontSize(11).fillColor('#1d0f25')
      doc.font('bold').text('Клієнт: ', 40, y, { continued: true }).font('reg').text(inv.fullName || '—')
      y += 18
      doc.font('bold').text('Телефон: ', 40, y, { continued: true }).font('reg').text(inv.phone || '—')
      y += 18
      if (inv.fop) {
        doc.font('bold').text('ФОП/ЧП: ', 40, y, { continued: true }).font('reg').text(inv.fop)
        y += 18
      }
      doc.font('bold').text('Адреса: ', 40, y, { continued: true }).font('reg').text(inv.address || '—', { width: TABLE_RIGHT - 40 })
      y = doc.y + 6
      if (inv.comment) {
        doc.font('bold').text('Коментар: ', 40, y, { continued: true }).font('reg').text(inv.comment, { width: TABLE_RIGHT - 40 })
        y = doc.y + 6
      }

      y += 6
      y = drawTableHeader(doc, y)

      // Рядки таблиці
      inv.items.forEach((it, i) => {
        if (y + ROW_H > pageBottom) {
          doc.addPage()
          y = 40
          y = drawTableHeader(doc, y)
        }
        const rowTop = y
        // роздільна лінія
        doc.save().strokeColor('#e7d7f0').lineWidth(0.5)
          .moveTo(40, rowTop + ROW_H).lineTo(TABLE_RIGHT, rowTop + ROW_H).stroke().restore()

        const cy = rowTop + 6
        doc.font('reg').fontSize(9).fillColor('#1d0f25')
        doc.text(String(i + 1), COLS.num.x + 2, cy + 12, { width: COLS.num.w - 4, align: 'center' })

        // фото
        const img = images[i]
        if (img) {
          try {
            doc.image(img, COLS.photo.x + 3, rowTop + 4, { fit: [38, 38], align: 'center', valign: 'center' })
          } catch {
            /* непідтримуваний формат — пропускаємо */
          }
        } else {
          doc.save().rect(COLS.photo.x + 3, rowTop + 4, 38, 38).fill('#f0e6f6').restore()
        }

        doc.font('reg').fontSize(9).fillColor('#1d0f25')
        doc.text(it.title || '', COLS.title.x + 2, cy + 4, { width: COLS.title.w - 4, height: ROW_H - 10, ellipsis: true })
        doc.fontSize(8).fillColor('#444')
        doc.text(it.barcode || '', COLS.barcode.x + 2, cy + 12, { width: COLS.barcode.w - 4 })
        doc.font('reg').fontSize(9).fillColor('#1d0f25')
        doc.text(String(it.qty), COLS.qty.x + 2, cy + 12, { width: COLS.qty.w - 4, align: 'center' })
        doc.text(money(it.price), COLS.price.x + 2, cy + 12, { width: COLS.price.w - 4, align: 'right' })
        doc.font('bold').text(money(it.sum), COLS.sum.x + 2, cy + 12, { width: COLS.sum.w - 4, align: 'right' })

        y = rowTop + ROW_H
      })

      // Разом
      y += 12
      if (y + 30 > pageBottom) {
        doc.addPage()
        y = 40
      }
      doc.font('bold').fontSize(13).fillColor('#1d0f25')
      doc.text('Разом до сплати:', 300, y, { width: 145, align: 'right', continued: true })
      doc.fillColor('#d6248c').text(`  ${money(inv.total)}`, { align: 'right' })

      y = doc.y + 24
      doc.font('reg').fontSize(9).fillColor('#888')
        .text(`${SHOP_NAME} — дякуємо за замовлення!`, 40, y, { width: TABLE_RIGHT - 40, align: 'center' })

      doc.end()
    } catch (e) {
      reject(e)
    }
  })
}
