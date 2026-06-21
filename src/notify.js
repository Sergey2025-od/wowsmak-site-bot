import { InputFile } from 'grammy'
import { config } from './config.js'
import * as db from './db.js'
import { thumbUrl } from './cloudinary.js'
import { orderActionsKeyboard, replyKeyboard } from './admin/keyboards.js'
import { invoiceMessageHtml, buildInvoicePdf } from './invoice.js'

const SHOP_NAME = 'WowSmak'

// Будує об’єкт накладної з даних замовлення
// (дотягує штрих-код, залишок та фото товарів).
async function buildInvoice({ order, items, total }) {
  const ids = items.map((i) => i.product_id).filter(Boolean)
  let productMap = {}
  try {
    productMap = await db.getProductsByIds(ids)
  } catch (e) {
    console.error('getProductsByIds:', e.message)
  }

  const invItems = items.map((i) => {
    const p = productMap[i.product_id] || {}
    return {
      id: i.product_id,
      title: i.title,
      qty: i.qty,
      price: Number(i.price),
      sum: Number(i.price) * i.qty,
      barcode: p.barcode || null,
      stock: p.stock ?? null,
      imageUrl: thumbUrl(p.image_url, 120),
    }
  })

  return {
    id: order.id,
    createdAt: order.created_at,
    fullName: order.full_name,
    phone: order.phone,
    fop: order.fop,
    address: order.address,
    comment: order.comment,
    total,
    items: invItems,
  }
}

// Спільна відправка накладної (текст + PDF) у вказаний чат.
async function sendInvoice(api, chatId, invoice, { intro, replyMarkup } = {}) {
  const html = (intro ? `${intro}\n\n` : '') + invoiceMessageHtml(invoice)
  await api.sendMessage(chatId, html, { parse_mode: 'HTML', reply_markup: replyMarkup })

  let pdf = null
  try {
    pdf = await buildInvoicePdf(invoice)
  } catch (e) {
    console.error('Генерація PDF-накладної:', e)
  }
  if (pdf) {
    await api.sendDocument(chatId, new InputFile(pdf, `nakladna-${invoice.id}.pdf`), {
      caption: `📄 Накладна № ${invoice.id} — можна роздрукувати або зберегти`,
    })
  }
}

// Сповіщає всіх адмінів про нове замовлення:
//  • текстова накладна + PDF
//  • кнопки «Підтвердити та надіслати накладну» і «Відповісти клієнту»
export async function notifyAdminsNewOrder({ api, order, items, total, stockOut = [], stockLow = [] }) {
  if (!config.adminIds.length) return
  const invoice = await buildInvoice({ order, items, total })
  for (const adminId of config.adminIds) {
    try {
      await sendInvoice(api, adminId, invoice, {
        replyMarkup: orderActionsKeyboard(order.id, order.tg_id),
      })
    } catch (e) {
      console.error(`Сповіщення адміна ${adminId}:`, e.message)
    }
  }
  await notifyAdminsStock({ api, stockOut, stockLow })
}

// Повідомляє адмінів про товари, що закінчились (=0) або закінчуються (<3 шт)
const escHtml = (s) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function notifyAdminsStock({ api, stockOut = [], stockLow = [] }) {
  if (!config.adminIds.length) return
  if (!stockOut.length && !stockLow.length) return
  const parts = []
  if (stockOut.length) {
    parts.push(
      '🚫 <b>Закінчились товари:</b>\n' +
        stockOut.map((p) => `• ${escHtml(p.title)} (#${p.id})`).join('\n'),
    )
  }
  if (stockLow.length) {
    parts.push(
      '⚠️ <b>Закінчуються (менше 3 шт):</b>\n' +
        stockLow.map((p) => `• ${escHtml(p.title)} — ${p.stock} шт`).join('\n'),
    )
  }
  const msg = parts.join('\n\n')
  for (const adminId of config.adminIds) {
    try {
      await api.sendMessage(adminId, msg, { parse_mode: 'HTML' })
    } catch (e) {
      console.error(`Сповіщення про залишки ${adminId}:`, e.message)
    }
  }
}

// Пересилає адмінам питання клієнта з Mini App (з кнопкою «Відповісти»).
export async function notifyAdminsSupport({ api, tgId, tgUser, text }) {
  if (!config.adminIds.length) return
  try {
    await db.upsertCustomer({
      tgId,
      username: tgUser?.username,
      fullName: [tgUser?.first_name, tgUser?.last_name].filter(Boolean).join(' '),
    })
  } catch (e) {
    console.error('upsertCustomer (support):', e.message)
  }
  try {
    await db.logMessage({ tgId, direction: 'in', text })
  } catch {}
  const safe = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const who = tgUser?.username ? `@${tgUser.username}` : tgUser?.first_name || tgId
  const header = `📩 <b>Питання з Mini App</b>\n${who} (id <code>${tgId}</code>)\n\n${safe}`
  for (const adminId of config.adminIds) {
    try {
      await api.sendMessage(adminId, header, {
        parse_mode: 'HTML',
        reply_markup: replyKeyboard(tgId),
      })
    } catch (e) {
      console.error(`Питання адміну ${adminId}:`, e.message)
    }
  }
}

// Надсилає накладну клієнту (при підтвердженні замовлення) — від імені магазину.
export async function sendInvoiceToClient({ api, order, items, total }) {
  const invoice = await buildInvoice({ order, items, total })
  await sendInvoice(api, order.tg_id, invoice, {
    intro: `🍬 <b>${SHOP_NAME}</b>\n✅ Ваше замовлення підтверджено! Дякуємо 💛`,
  })
}


// Сповіщення підписникам, що товар знову в наявності
export async function notifyRestock({ api, productId }) {
  let subs = []
  try {
    subs = await db.getRestockSubscribers(productId)
  } catch (e) {
    console.error('getRestockSubscribers:', e.message)
    return
  }
  if (!subs.length) return
  let title = 'Товар'
  try {
    const prod = await db.getProductStock(productId)
    if (prod && prod.title) title = prod.title
  } catch {}
  const text = `🎉 Гарна новина! «${title}» знову в наявності. Встигніть замовити — відкрийте магазин 🍬`
  for (const tgId of subs) {
    try {
      await api.sendMessage(tgId, text)
      await db.logMessage({ tgId, direction: 'out', text: `Сповіщення про наявність: ${title}` })
    } catch {}
  }
  try {
    await db.clearRestockSubs(productId)
  } catch {}
}

// Сповіщає адмінів про нове замовлення з САЙТУ (гість, без Telegram id).
// Використовує ту саму накладну + PDF, що й бот.
export async function notifyAdminsWebOrder({ api, order, items, total, stockOut = [], stockLow = [] }) {
  if (!config.adminIds.length) return
  const invoice = await buildInvoice({ order, items, total })
  const contactLines = []
  if (order.email) contactLines.push(`✉️ ${escHtml(order.email)}`)
  const intro =
    `🌐 <b>Замовлення з сайту</b>` + (contactLines.length ? `\n${contactLines.join('\n')}` : '')
  for (const adminId of config.adminIds) {
    try {
      await sendInvoice(api, adminId, invoice, {
        intro,
        replyMarkup: orderActionsKeyboard(order.id, order.tg_id),
      })
    } catch (e) {
      console.error(`Сповіщення адміна про веб-замовлення ${adminId}:`, e.message)
    }
  }
  await notifyAdminsStock({ api, stockOut, stockLow })
}
