import { InlineKeyboard, Keyboard } from 'grammy'

// Нижня клавіатура адміна
export const adminMenuKeyboard = new Keyboard()
  .text('➕ Додати товар').text('📝 Товари')
  .row()
  .text('🗂 Категорії').text('🏷 Акції')
  .row()
  .text('💰 Заробіток').text('📢 Розсилка')
  .row()
  .text('⬅️ Вийти з адмінки')
  .resized()

export const ADMIN_MENU_LABELS = new Set([
  '➕ Додати товар',
  '📝 Товари',
  '🗂 Категорії',
  '🏷 Акції',
  '💰 Заробіток',
  '📢 Розсилка',
  '⬅️ Вийти з адмінки',
])

// Клавіатура вибору періоду заробітку
export function earningsPeriodKeyboard() {
  return new InlineKeyboard()
    .text('📅 Сьогодні', 'earn:day')
    .text('🗓 Тиждень', 'earn:week')
    .text('📆 Місяць', 'earn:month')
    .row()
    .text('🔄 Скинути', 'earn:reset')
}

// Керування категоріями: список з кнопкою «додати»
export function categoryManageKeyboard(categories) {
  const kb = new InlineKeyboard()
  for (const c of categories) {
    const img = c.image_url ? ' 🖼' : ''
    kb.text(`${c.emoji || '🍬'} ${c.title}${img}`, `acatedit:${c.id}`).row()
  }
  kb.text('➕ Додати категорію', 'acatadd')
  return kb
}

// Картка однієї категорії
export function categoryCardKeyboard(id) {
  return new InlineKeyboard()
    .text('✏️ Назва', `acatfield:${id}:title`)
    .text('😀 Емодзі', `acatfield:${id}:emoji`)
    .row()
    .text('🖼 Картинка', `acatimg:${id}`)
    .row()
    .text('🗑 Видалити', `acatdel:${id}`)
    .text('⬅️ До списку', 'acatmgr')
}

export function confirmDeleteCategoryKeyboard(id) {
  return new InlineKeyboard()
    .text('✅ Так, видалити', `acatdelyes:${id}`)
    .text('❌ Скасувати', `acatedit:${id}`)
}

// Список категорій для адмін-дій
export function adminCategoriesKeyboard(categories, action) {
  const kb = new InlineKeyboard()
  categories.forEach((c, i) => {
    kb.text(`${c.emoji} ${c.title}`, `${action}:${c.id}`)
    if (i % 2 === 1) kb.row()
  })
  return kb
}

// Список товарів для адміна
export function adminProductsKeyboard(products, prefix) {
  const kb = new InlineKeyboard()
  for (const p of products) {
    const flag = p.sale_price != null ? '🔥 ' : ''
    kb.text(`${flag}#${p.id} ${p.title}`, `${prefix}:${p.id}`).row()
  }
  return kb
}

// Клавіатура редагування товару
export function productEditKeyboard(productId) {
  const id = productId
  return new InlineKeyboard()
    .text('✏️ Назва', `aedit:${id}:title`)
    .text('📄 Опис', `aedit:${id}:description`)
    .row()
    .text('🗂 Категорія', `psetcat:${id}`)
    .row()
    .text('💵 Закупівля', `aedit:${id}:cost_price`)
    .text('💰 Ціна продажу', `aedit:${id}:price`)
    .row()
    .text('📦 Залишок', `aedit:${id}:stock`)
    .text('🔖 Штрих-код', `aedit:${id}:barcode`)
    .row()
    .text('🔢 Шт. в упаковці', `aedit:${id}:units_per_pack`)
    .text('⭐ Реком.%', `aedit:${id}:rec_markup`)
    .row()
    .text('⚖️ Вага', `aedit:${id}:weight_g`)
    .text('🍓 Смаки', `aedit:${id}:flavors`)
    .row()
    .text('📦 Фасовки', `aedit:${id}:packs`)
    .row()
    .text('🧮 Калькулятор націнки', `acalc:${id}`)
    .row()
    .text('🏷 Акція', `aedit:${id}:sale_price`)
    .text('🖼 Фото/відео', `amedia:${id}`)
    .row()
    .text('🧹 Очистити медіа', `amediaclr:${id}`)
    .text('🗑 Видалити', `adel:${id}`)
    .row()
    .text('⬅️ До списку', 'alist')
}

// Вибір категорії для конкретного товару
export function productCategoryKeyboard(productId, categories, currentCategoryId) {
  const kb = new InlineKeyboard()
  for (const c of categories) {
    const mark = c.id === currentCategoryId ? '✅ ' : ''
    kb.text(`${mark}${c.emoji || '🍬'} ${c.title}`, `pcat:${productId}:${c.id}`).row()
  }
  kb.text('🚫 Без категорії', `pcat:${productId}:0`).row()
  kb.text('⬅️ До товару', `aprod:${productId}`)
  return kb
}

// Кнопка повернення до картки товару
export function backToProductKeyboard(productId) {
  return new InlineKeyboard().text('⬅️ До товару', `aprod:${productId}`)
}

export function confirmDeleteKeyboard(productId) {
  return new InlineKeyboard()
    .text('✅ Так, видалити', `adelyes:${productId}`)
    .text('❌ Скасувати', `aprod:${productId}`)
}

export function broadcastConfirmKeyboard() {
  return new InlineKeyboard()
    .text('✅ Надіслати всім', 'bcastsend')
    .text('❌ Скасувати', 'bcastcancel')
}

// Кнопка «Відповісти» під повідомленням клієнта (для адміна)
export function replyKeyboard(tgId) {
  return new InlineKeyboard().text('✍️ Відповісти клієнту', `reply:${tgId}`)
}

// Кнопки дій під новим замовленням (для адміна)
export function orderActionsKeyboard(orderId, clientTgId) {
  return new InlineKeyboard()
    .text('✅ Підтвердити та надіслати накладну', `confirm:${orderId}`)
    .row()
    .text('🚚 Відправлено', `ostatus:${orderId}:shipped`)
    .text('📦 Виконано', `ostatus:${orderId}:done`)
    .row()
    .text('❌ Скасувати замовлення', `ostatus:${orderId}:cancelled`)
    .row()
    .text('✍️ Відповісти клієнту', `reply:${clientTgId}`)
}

// Кнопки керування статусом замовлення (після підтвердження)
export function orderStatusKeyboard(orderId, clientTgId) {
  return new InlineKeyboard()
    .text('🚚 Відправлено', `ostatus:${orderId}:shipped`)
    .text('📦 Виконано', `ostatus:${orderId}:done`)
    .row()
    .text('❌ Скасувати замовлення', `ostatus:${orderId}:cancelled`)
    .row()
    .text('✍️ Відповісти клієнту', `reply:${clientTgId}`)
}
