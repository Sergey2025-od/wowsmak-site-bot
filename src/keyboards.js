import { InlineKeyboard, Keyboard } from 'grammy'
import { config } from './config.js'
import { parsePacks, price } from './format.js'

// Нижня постійна клавіатура.
// Для адміна додається кнопка «🛠 Адмінка» (інші користувачі її не бачать).
export function mainMenuKeyboard(tgId) {
  const kb = new Keyboard()
  // Єдина кнопка для клієнта — відкриває Mini App прямо з клавіатури
  if (config.publicUrl) {
    kb.webApp('🍬 Магазин', `${config.publicUrl}/app/`)
  }
  // Адміну додаємо кнопку «Адмінка» (інші користувачі її не бачать)
  if (tgId != null && config.adminIds.includes(Number(tgId))) {
    kb.row().text('🛠 Адмінка')
  }
  return kb.resized()
}

// Список категорій
export function categoriesKeyboard(categories) {
  const kb = new InlineKeyboard()
  categories.forEach((c, i) => {
    kb.text(`${c.emoji} ${c.title}`, `cat:${c.id}`)
    if (i % 2 === 1) kb.row()
  })
  return kb
}

// Кнопки під карткою товару.
// Якщо є фасовки — показуємо окрему кнопку на кожну (зі своєю ціною).
export function productKeyboard(product) {
  const id = typeof product === 'object' && product ? product.id : product
  const packs = typeof product === 'object' && product ? parsePacks(product) : []
  const kb = new InlineKeyboard()
  if (packs.length) {
    packs.forEach((pk) => {
      kb.text(`🛒 ${pk.label} · ${price(pk.price)}`, `addp:${id}:${pk.label}`).row()
    })
  } else {
    kb.text('➕ У кошик', `add:${id}`)
  }
  return kb
}

// Кошик: керування кількістю по кожній позиції
export function cartKeyboard(cart) {
  const kb = new InlineKeyboard()
  for (const item of cart) {
    const label = item.pack_label
      ? `${item.product.title} · ${item.pack_label} (${item.qty})`
      : `${item.product.title} (${item.qty})`
    kb.text('−', `dec:${item.product.id}`)
      .text(label, 'noop')
      .text('＋', `inc:${item.product.id}`)
      .row()
  }
  if (cart.length) {
    kb.text('✅ Оформити замовлення', 'checkout').row()
    kb.text('🗑 Очистити', 'clear')
  }
  return kb
}
