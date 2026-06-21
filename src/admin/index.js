import { config } from '../config.js'
import * as db from '../db.js'
import { uploadImage, uploadVideo } from '../cloudinary.js'
import { notifyRestock } from '../notify.js'
import { adminProductCaption, markupCalc, price, earningsReport } from '../format.js'
import { mainMenuKeyboard } from '../keyboards.js'
import {
  adminMenuKeyboard,
  ADMIN_MENU_LABELS,
  adminCategoriesKeyboard,
  adminProductsKeyboard,
  productEditKeyboard,
  productCategoryKeyboard,
  backToProductKeyboard,
  confirmDeleteKeyboard,
  broadcastConfirmKeyboard,
  replyKeyboard,
  categoryManageKeyboard,
  categoryCardKeyboard,
  confirmDeleteCategoryKeyboard,
  earningsPeriodKeyboard,
  orderStatusKeyboard,
} from './keyboards.js'
import { sendInvoiceToClient } from '../notify.js'

export function isAdmin(id) {
  return config.adminIds.includes(id)
}

const TG_FILE_BASE = 'https://api.telegram.org/file/bot'

// Отримати прямий URL файлу Telegram (для завантаження в Cloudinary)
async function telegramFileUrl(ctx, fileId) {
  const file = await ctx.api.getFile(fileId)
  return TG_FILE_BASE + config.botToken + '/' + file.file_path
}

// Підписи полів для редагування
const FIELD_PROMPT = {
  title: 'Введіть нову назву:',
  description: 'Введіть новий опис:',
  cost_price: 'Введіть ціну закупівлі (число, або «-» щоб прибрати):',
  price: 'Введіть нову ціну продажу (число):',
  stock: 'Введіть залишок (число, або «-» щоб не враховувати):',
  sale_price: 'Введіть акційну ціну (число), або «0» / «-» щоб прибрати акцію:',
  units_per_pack: 'Введіть кількість штук в упаковці (число, або «-» щоб прибрати):',
  rec_markup: 'Введіть рекомендовану націнку у % (число, або «-» щоб прибрати):',
  barcode: 'Введіть штрих-код (або «-» щоб прибрати):',
  weight_g: 'Введіть вагу в грамах (число, або «-» щоб прибрати):',
  flavors: 'Введіть смаки через кому (напр. «Клубничний, Шоколадний, Лимонний»), або «-» щоб прибрати:',
  packs: 'Введіть фасовки (розміри) — кожна з нового рядка.\nНаприклад:\n0.5 кг\n1 кг\n250 г\n\nЦіна спільна для товару. «-» щоб прибрати фасовки.',
}

const ADD_STEPS = ['title', 'description', 'price', 'stock', 'cost_price', 'sale_price', 'units_per_pack', 'barcode', 'flavors', 'packs']
const ADD_PROMPT = {
  title:        'Крок 1/10. Введіть назву товару:',
  description:  'Крок 2/10. Опис товару (або «-» щоб пропустити):',
  price:        'Крок 3/10. Ціна продажу (число):',
  stock:        'Крок 4/10. Залишок на складі (число), або «-» якщо не відстежуєте:',
  cost_price:   'Крок 5/10. Ціна закупівлі (число), або «-» щоб пропустити:',
  sale_price:   'Крок 6/10. Акційна ціна (число), або «0» / «-» без акції:',
  units_per_pack: 'Крок 7/10. Штук в упаковці (число), або «-» щоб пропустити:',
  barcode:      'Крок 8/10. Штрих-код, або «-» щоб пропустити:',
  flavors:      'Крок 9/10. Смаки через кому (напр. «Полуниця, Шоколад, Ваніль»), або «-» щоб пропустити:',
  packs:        'Крок 10/10. Фасовки — кожна з нового рядка (напр.\n0.5 кг\n1 кг\n250 г), або «-» щоб пропустити:',
}

function parseNumber(text) {
  const n = Number(String(text).replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

// Розбор введених фасовок: кожна з нового рядка «назва = ціна» → [{ label, price }]
function parsePacksInput(text) {
  // Кожен рядок — окрема фасовка (розмір). Старий формат «назва = ціна» теж приймаємо, ціну ігноруємо.
  const parts = String(text)
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const packs = []
  for (const part of parts) {
    const label = part.split(/[=:]/)[0].trim()
    if (label) packs.push({ label, price: null })
  }
  return packs
}

async function showProductCard(ctx, productId, edit = false) {
  const p = await db.getProductAdmin(productId)
  const text = adminProductCaption(p)
  const kb = productEditKeyboard(productId)
  if (edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb })
      return
    } catch {
      /* нічого оновлювати */
    }
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb })
}

async function showProductList(ctx, prefix, header) {
  const products = await db.listAllProducts()
  if (!products.length) {
    return ctx.reply('Товарів поки немає. Додайте перший через «➕ Додати товар».')
  }
  await ctx.reply(header, { reply_markup: adminProductsKeyboard(products, prefix) })
}

const CAT_FIELD_PROMPT = {
  title: 'Введіть нову назву категорії:',
  emoji: 'Надішліть емодзі для категорії (напр. 🍫), або «-» щоб прибрати:',
}

async function showCategoryList(ctx) {
  let categories
  try {
    categories = await db.listAllCategories()
  } catch (e) {
    console.error('Помилка завантаження категорій:', e)
    await ctx.reply(
      '⚠️ Не вдалося завантажити категорії.\n\n' +
        'Найімовірніше, у базі ще не виконано міграцію. Відкрийте Supabase → SQL Editor і виконайте файл ' +
        '`supabase/categories-migration.sql` (а якщо таблиці categories ще немає — спершу `supabase/schema.sql`), потім спробуйте ще раз.\n\n' +
        'Технічні деталі: ' + (e?.message || String(e)),
      { parse_mode: 'HTML' },
    )
    return
  }
  await ctx.reply(
    categories.length
      ? '🗂 Категорії. Натисніть, щоб редагувати, або додайте нову:'
      : 'Категорій ще немає. Додайте першу:',
    { reply_markup: categoryManageKeyboard(categories) },
  )
}

async function showCategoryCard(ctx, id, edit = false) {
  const c = await db.getCategory(id)
  const text =
    `🗂 <b>Категорія #${c.id}</b>\n\n` +
    `Назва: ${c.title}\n` +
    `Емодзі: ${c.emoji || '—'}\n` +
    `Картинка: ${c.image_url ? '✅ є' : '— немає'}`
  const kb = categoryCardKeyboard(id)
  if (edit) {
    try {
      await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: kb })
      return
    } catch {}
  }
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: kb })
}

export function registerAdmin(bot) {
  const onlyAdmin = (handler) => async (ctx, next) => {
    if (!isAdmin(ctx.from?.id)) return next ? next() : undefined
    return handler(ctx, next)
  }

  bot.command('admin', async (ctx) => {
    if (!isAdmin(ctx.from.id)) return
    ctx.session.admin = undefined
    await ctx.reply(
      '🔐 <b>Адмін-панель</b>\n\nОберіть дію нижче.',
      { parse_mode: 'HTML', reply_markup: adminMenuKeyboard },
    )
  })

  bot.command('cancel', onlyAdmin(async (ctx) => {
    ctx.session.admin = undefined
    await ctx.reply('Ок, скасував. Ви в адмін-меню.', { reply_markup: adminMenuKeyboard })
  }))

  // Завершити режим додавання медіа (кілька фото + відео)
  const finishMedia = async (ctx) => {
    const a = ctx.session.admin
    if (a?.flow !== 'collect_media') return false
    const productId = a.productId
    ctx.session.admin = undefined
    await ctx.reply('Готово ✅', { reply_markup: adminMenuKeyboard })
    await showProductCard(ctx, productId)
    return true
  }
  const finishCatImage = async (ctx) => {
    const a = ctx.session.admin
    if (a?.flow !== 'collect_cat_image') return false
    const categoryId = a.categoryId
    ctx.session.admin = undefined
    await ctx.reply('Готово ✅', { reply_markup: adminMenuKeyboard })
    await showCategoryCard(ctx, categoryId)
    return true
  }


  bot.command('skip', onlyAdmin(async (ctx) => {
    if (ctx.session.admin?.flow === 'collect_media') return finishMedia(ctx)
    if (ctx.session.admin?.flow === 'collect_cat_image') return finishCatImage(ctx)
  }))

  bot.command('done', onlyAdmin(async (ctx) => {
    if (await finishMedia(ctx)) return
    if (await finishCatImage(ctx)) return
    await ctx.reply('Немає активного додавання медіа.')
  }))

  // Кнопка «🛠 Адмінка» у нижньому меню (видно лише адміну) — відкриває панель без команди /admin
  bot.hears('🛠 Адмінка', onlyAdmin(async (ctx) => {
    ctx.session.admin = undefined
    await ctx.reply(
      '🔐 <b>Адмін-панель</b>\n\nОберіть дію нижче.',
      { parse_mode: 'HTML', reply_markup: adminMenuKeyboard },
    )
  }))

  bot.hears('⬅️ Вийти з адмінки', onlyAdmin(async (ctx) => {
    ctx.session.admin = undefined
    await ctx.reply('Ви вийшли з адмінки.', { reply_markup: mainMenuKeyboard(ctx.from.id) })
  }))

  bot.hears('🗂 Категорії', onlyAdmin((ctx) => {
    ctx.session.admin = undefined
    return showCategoryList(ctx)
  }))

  bot.callbackQuery('acatmgr', onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = undefined
    await showCategoryList(ctx)
  }))

  bot.callbackQuery('acatadd', onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = { flow: 'addcat', step: 'title', data: {} }
    await ctx.reply('Крок 1/3. Введіть назву нової категорії:')
  }))

  bot.callbackQuery(/^acatedit:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = undefined
    await showCategoryCard(ctx, Number(ctx.match[1]))
  }))

  bot.callbackQuery(/^acatfield:(\d+):(\w+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = { flow: 'editcatfield', categoryId: Number(ctx.match[1]), field: ctx.match[2] }
    await ctx.reply(CAT_FIELD_PROMPT[ctx.match[2]] || 'Введіть значення:')
  }))

  bot.callbackQuery(/^acatimg:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = { flow: 'collect_cat_image', categoryId: Number(ctx.match[1]) }
    await ctx.reply('🖼 Надішліть картинку категорії. Бажано тематичну, квадратну.\n\n⚠️ Щоб зберегти прозорий фон — надсилайте PNG як ФАЙЛ 📎 (скріпка → «Файл»), а НЕ як «фото» — інакше Telegram стисне його в JPEG і фон стане білим.\n/cancel — скасувати.')
  }))

  bot.callbackQuery(/^acatdel:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply('Видалити цю категорію? Товари залишаться, але без категорії.', {
      reply_markup: confirmDeleteCategoryKeyboard(Number(ctx.match[1])),
    })
  }))

  bot.callbackQuery(/^acatdelyes:(\d+)$/, onlyAdmin(async (ctx) => {
    await db.deleteCategory(Number(ctx.match[1]))
    await ctx.answerCallbackQuery({ text: 'Категорію ви��алено' })
    try {
      await ctx.editMessageText('🗑 Категорію видалено.')
    } catch {}
  }))

  bot.hears('📝 Товари', onlyAdmin((ctx) => showProductList(ctx, 'aprod', 'Оберіть товар для редагування:')))

  bot.hears('🏷 Акції', onlyAdmin((ctx) =>
    showProductList(ctx, 'aprod', '🏷 Оберіть товар, щоб призначити/прибрати акцію (у картці — кнопка «🏷 Акція»):'),
  ))

  bot.hears('➕ Додати товар', onlyAdmin(async (ctx) => {
    const categories = await db.getCategories()
    if (!categories.length) {
      return ctx.reply('Спочатку додайте категорії в таблицю categories.')
    }
    await ctx.reply('Оберіть категорію нового товару:', {
      reply_markup: adminCategoriesKeyboard(categories, 'acat'),
    })
  }))

  bot.hears('📢 Розсилка', onlyAdmin(async (ctx) => {
    ctx.session.admin = { flow: 'broadcast', step: 'compose' }
    await ctx.reply(
      '📢 Напишіть текст розсилки (можна прикріпити фото з підписом).\nПовідомлення отримають усі клієнти від імені магазину.\n\n/cancel — скасувати',
    )
  }))

  // 💰 Заробіток — вибір періоду
  bot.hears('💰 Заробіток', onlyAdmin(async (ctx) => {
    ctx.session.admin = undefined
    await ctx.reply('💰 <b>Заробіток</b>\n\nОберіть період:', {
      parse_mode: 'HTML',
      reply_markup: earningsPeriodKeyboard(),
    })
  }))

  bot.callbackQuery('earn:reset', onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery('⏳ Скидаємо...')
    try {
      await db.resetAnalytics()
      await ctx.reply('✅ <b>Статистику скинуто.</b>\n\nВсі замовлення заархівовано.\nОберіть період щоб побачити нові цифри:', {
        parse_mode: 'HTML',
        reply_markup: earningsPeriodKeyboard(),
      })
    } catch (e) {
      console.error('earn:reset', e)
      await ctx.reply('⚠️ Помилка при скиданні: ' + e.message)
    }
  }))

  bot.callbackQuery(/^earn:(day|week|month)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    try {
      const data = await db.getEarnings(ctx.match[1])
      await ctx.reply(earningsReport(data), {
        parse_mode: 'HTML',
        reply_markup: earningsPeriodKeyboard(),
      })
    } catch (e) {
      console.error('getEarnings:', e)
      await ctx.reply('⚠️ Не вдалося порахувати заробіток. Спробуйте ще раз.')
    }
  }))

  bot.callbackQuery(/^acat:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = {
      flow: 'add',
      step: 'title',
      data: { category_id: Number(ctx.match[1]) },
    }
    await ctx.reply(ADD_PROMPT.title)
  }))

  bot.callbackQuery(/^aprod:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    await showProductCard(ctx, Number(ctx.match[1]))
  }))

  // Зміна категорії вже опублікованого товару
  bot.callbackQuery(/^psetcat:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    const productId = Number(ctx.match[1])
    const [product, categories] = await Promise.all([
      db.getProductAdmin(productId),
      db.getCategories(),
    ])
    if (!categories.length) {
      return ctx.reply('Спочатку створіть категорії в розділі «🗂 Категорії».')
    }
    await ctx.reply(`Оберіть категорію для товару «${product.title}»:`, {
      reply_markup: productCategoryKeyboard(productId, categories, product.category?.id),
    })
  }))

  bot.callbackQuery(/^pcat:(\d+):(\d+)$/, onlyAdmin(async (ctx) => {
    const productId = Number(ctx.match[1])
    const categoryId = Number(ctx.match[2])
    await db.updateProductField(productId, 'category_id', categoryId === 0 ? null : categoryId)
    await ctx.answerCallbackQuery({ text: 'Категорію оновлено ✅' })
    try { await ctx.deleteMessage() } catch {}
    await showProductCard(ctx, productId)
  }))

  // Додавання медіа (кілька фото та/або відео)
  bot.callbackQuery(/^amedia:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    const productId = Number(ctx.match[1])
    ctx.session.admin = { flow: 'collect_media', productId }
    await ctx.reply(
      '📸 Надішліть фото товару (можна кілька — по одному або альбомом) та/або відео.\n\nКожне нове фото додається до галереї. Коли завершите — /done.\n/cancel — скасувати.',
    )
  }))

  bot.callbackQuery(/^amediaclr:(\d+)$/, onlyAdmin(async (ctx) => {
    const productId = Number(ctx.match[1])
    await db.clearProductMedia(productId)
    await ctx.answerCallbackQuery({ text: 'Медіа очищено' })
    ctx.session.admin = undefined
    await showProductCard(ctx, productId)
  }))

  bot.callbackQuery(/^acalc:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    const id = Number(ctx.match[1])
    const p = await db.getProductAdmin(id)
    await ctx.reply(markupCalc(p), {
      parse_mode: 'HTML',
      reply_markup: backToProductKeyboard(id),
    })
  }))

  bot.callbackQuery('alist', onlyAdmin((ctx) => {
    ctx.answerCallbackQuery()
    return showProductList(ctx, 'aprod', 'Оберіть товар:')
  }))

  bot.callbackQuery(/^aedit:(\d+):(\w+)$/, onlyAdmin(async (ctx) => {
    const productId = Number(ctx.match[1])
    const field = ctx.match[2]
    await ctx.answerCallbackQuery()

    ctx.session.admin = { flow: 'editfield', productId, field }
    await ctx.reply(FIELD_PROMPT[field] || 'Введіть значення:')
  }))

  bot.callbackQuery(/^adel:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    await ctx.reply('Видалити цей товар? Дію не можна скасувати.', {
      reply_markup: confirmDeleteKeyboard(Number(ctx.match[1])),
    })
  }))

  bot.callbackQuery(/^adelyes:(\d+)$/, onlyAdmin(async (ctx) => {
    await db.deleteProduct(Number(ctx.match[1]))
    await ctx.answerCallbackQuery({ text: 'Товар видалено' })
    try {
      await ctx.editMessageText('🗑 Товар видалено.')
    } catch {}
  }))

  bot.callbackQuery(/^reply:(\d+)$/, onlyAdmin(async (ctx) => {
    await ctx.answerCallbackQuery()
    ctx.session.admin = { flow: 'reply', targetTgId: Number(ctx.match[1]) }
    await ctx.reply('Напишіть відповідь клієнту. Вона надійде від імені магазину.\n/cancel — скасувати')
  }))

  // Підтвердити замовлення та надіслати накладну клієнту
  bot.callbackQuery(/^confirm:(\d+)$/, onlyAdmin(async (ctx) => {
    const orderId = Number(ctx.match[1])
    await ctx.answerCallbackQuery({ text: 'Підтверджую…' })
    const data = await db.getOrderForInvoice(orderId)
    if (!data) {
      return ctx.reply('⚠️ Замовлення не знайдено.')
    }
    try {
      await db.updateOrderStatus(orderId, 'confirmed')
      await sendInvoiceToClient({ api: ctx.api, ...data })
      await db.logMessage({
        tgId: data.order.tg_id,
        direction: 'out',
        text: `Накладна №${orderId} (підтвердження замовлення)`,
        adminId: ctx.from.id,
      })
      // Прибираємо кнопку підтвердження, залишаємо лише «Відповісти»
      try {
        await ctx.editMessageReplyMarkup({ reply_markup: orderStatusKeyboard(orderId, data.order.tg_id) })
      } catch {
        /* повідомлення могло змінитись */
      }
      await ctx.reply(`✅ Замовлення #${orderId} підтверджено. Накладну надіслано клієнту.`)
    } catch (e) {
      console.error('Підтвердження замовлення:', e)
      await ctx.reply('⚠️ Не вдалося надіслати накладну клієнту (можливо, він заблокував бота). Статус замовлення оновлено.')
    }
  }))

  // Зміна статусу замовлення: відправлено / виконано / скасовано
  bot.callbackQuery(/^ostatus:(\d+):(shipped|done|cancelled)$/, onlyAdmin(async (ctx) => {
    const orderId = Number(ctx.match[1])
    const status = ctx.match[2]
    const LABELS = {
      shipped: { admin: 'Відправлено 🚚', client: `🚚 Ваше замовлення №${orderId} відправлено!` },
      done: { admin: 'Виконано ✅', client: `✅ Замовлення №${orderId} виконано. Дякуємо за покупку! 🍬` },
      cancelled: { admin: 'Скасовано ❌', client: `❌ На жаль, замовлення №${orderId} скасовано. Напишіть нам, якщо є питання.` },
    }
    const lbl = LABELS[status]
    await ctx.answerCallbackQuery({ text: lbl.admin })
    const data = await db.getOrderForInvoice(orderId)
    if (!data) return ctx.reply('⚠️ Замовлення не знайдено.')
    try {
      await db.updateOrderStatus(orderId, status)
    } catch (e) {
      console.error('Оновлення статусу замовлення:', e)
      return ctx.reply('⚠️ Не вдалося оновити статус замовлення.')
    }
    // Сповіщаємо клієнта про новий статус
    try {
      await ctx.api.sendMessage(data.order.tg_id, lbl.client)
      await db.logMessage({
        tgId: data.order.tg_id,
        direction: 'out',
        text: `Статус замовлення №${orderId}: ${lbl.admin}`,
        adminId: ctx.from.id,
      })
    } catch {
      /* клієнт міг заблокувати бота */
    }
    try {
      await ctx.editMessageReplyMarkup({ reply_markup: orderStatusKeyboard(orderId, data.order.tg_id) })
    } catch {}
    await ctx.reply(`Статус замовлення #${orderId}: ${lbl.admin}`)
  }))

  bot.callbackQuery('bcastcancel', onlyAdmin(async (ctx) => {
    ctx.session.admin = undefined
    await ctx.answerCallbackQuery({ text: 'Скасовано' })
    try { await ctx.editMessageText('Розсилку скасовано.') } catch {}
  }))

  bot.callbackQuery('bcastsend', onlyAdmin(async (ctx) => {
    const a = ctx.session.admin
    await ctx.answerCallbackQuery()
    if (!a || a.flow !== 'broadcast' || !a.payload) {
      return ctx.reply('Нічого надсилати. Почніть знову через «📢 Розсилка».')
    }
    const ids = await db.getAllCustomerIds()
    let ok = 0
    let fail = 0
    for (const id of ids) {
      try {
        if (a.payload.photo) {
          await ctx.api.sendPhoto(id, a.payload.photo, { caption: a.payload.text, parse_mode: 'HTML' })
        } else {
          await ctx.api.sendMessage(id, a.payload.text, { parse_mode: 'HTML' })
        }
        ok++
      } catch {
        fail++
      }
    }
    ctx.session.admin = undefined
    await ctx.reply(`📨 Розсилку завершено.\nДоставлено: ${ok}, не доставлено: ${fail}.`, {
      reply_markup: adminMenuKeyboard,
    })
  }))

  // Текстовий диспетчер адмін-діалогів
  bot.on('message:text', async (ctx, next) => {
    const a = ctx.session.admin
    if (!a || !isAdmin(ctx.from.id)) return next()
    if (ADMIN_MENU_LABELS.has(ctx.message.text)) {
      ctx.session.admin = undefined
      return next()
    }

    const text = ctx.message.text.trim()

    if (a.flow === 'add') {
      const step = a.step
      if (step === 'price') {
        const n = parseNumber(text)
        if (n == null || n < 0) return ctx.reply('Ціна має бути числом. Спробуйте ще раз:')
        a.data.price = n
      } else if (step === 'cost_price') {
        a.data.cost_price = text === '-' ? null : parseNumber(text)
      } else if (step === 'stock') {
        a.data.stock = text === '-' ? null : parseNumber(text)
      } else if (step === 'units_per_pack') {
        a.data.units_per_pack = text === '-' ? null : parseNumber(text)
      } else if (step === 'barcode') {
        a.data.barcode = text === '-' ? null : text
      } else if (step === 'sale_price') {
        a.data.sale_price = text === '-' || text === '0' ? null : parseNumber(text)
      } else if (step === 'flavors') {
        a.data.flavors = text === '-' ? null : text
      } else if (step === 'packs') {
        if (text === '-') {
          a.data.packs = null
        } else {
          const packs = parsePacksInput(text)
          a.data.packs = packs.length ? packs : null
        }
      } else {
        a.data[step] = step === 'description' && text === '-' ? null : text
      }

      const idx = ADD_STEPS.indexOf(step)
      const nextStep = ADD_STEPS[idx + 1]
      if (nextStep) {
        a.step = nextStep
        return ctx.reply(ADD_PROMPT[nextStep])
      }

      const product = await db.createProduct(a.data)
      ctx.session.admin = { flow: 'collect_media', productId: product.id }
      await ctx.reply(
        `✅ Товар #${product.id} «${product.title}» створено!\n\n📸 Тепер надішліть фото товару (можна кілька — по одному або альбомом) та/або відео.\nКоли завершите — /done.\n/cancel — пропустити фото.`,
      )
      return
    }

    if (a.flow === 'editfield') {
      const { productId, field } = a
      let value = text
      if (field === 'price') {
        value = parseNumber(text)
        if (value == null || value < 0) return ctx.reply('Потрібне число. Спробуйте ще раз:')
      } else if (field === 'cost_price') {
        value = text === '-' || text === '0' ? null : parseNumber(text)
        if (value != null && value < 0) return ctx.reply('Потрібне число. Спробуйте ще раз:')
      } else if (field === 'stock') {
        value = text === '-' ? null : parseNumber(text)
      } else if (field === 'units_per_pack') {
        value = text === '-' || text === '0' ? null : parseNumber(text)
        if (value != null && value <= 0) return ctx.reply('Потрібне додатне число. Спробуйте ще раз:')
      } else if (field === 'rec_markup') {
        value = text === '-' ? null : parseNumber(text)
        if (value != null && value < 0) return ctx.reply('Потрібне число. Спробуйте ще раз:')
      } else if (field === 'barcode') {
        value = text === '-' ? null : text
      } else if (field === 'sale_price') {
        value = text === '-' || text === '0' ? null : parseNumber(text)
        if (value != null && value < 0) return ctx.reply('Потрібне число. Спробуйте ще раз:')
      } else if (field === 'description') {
        value = text === '-' ? null : text
      } else if (field === 'weight_g') {
        value = text === '-' || text === '0' ? null : parseNumber(text)
        if (value != null && value <= 0) return ctx.reply('Потрібне додатне число. Спробуйте ще раз:')
      } else if (field === 'flavors') {
        value = text === '-' ? null : text
      } else if (field === 'packs') {
        if (text === '-') {
          value = null
        } else {
          const packs = parsePacksInput(text)
          if (!packs.length) {
            return ctx.reply('Не вдалося розпізнати фасовки. Формат: «0.5 кг = 250», кожна з нового рядка. Спробуйте ще раз:')
          }
          value = packs
        }
      }
      let beforeStock = null
      if (field === 'stock') {
        try {
          beforeStock = await db.getProductStock(productId)
        } catch {}
      }
      await db.updateProductField(productId, field, value)
      if (field === 'stock' && beforeStock && beforeStock.stock != null && beforeStock.stock <= 0 && value != null && value > 0) {
        notifyRestock({ api: ctx.api, productId }).catch(() => {})
      }
      ctx.session.admin = undefined
      await ctx.reply('Готово ✅', { reply_markup: adminMenuKeyboard })
      return showProductCard(ctx, productId)
    }

    if (a.flow === 'addcat') {
      if (a.step === 'title') {
        a.data.title = text
        a.step = 'emoji'
        return ctx.reply('Крок 2/3. Надішліть емодзі категорії (напр. 🍫), або «-» щоб пропустити:')
      }
      if (a.step === 'emoji') {
        a.data.emoji = text === '-' ? '🍬' : text
        const cat = await db.createCategory(a.data)
        ctx.session.admin = { flow: 'collect_cat_image', categoryId: cat.id }
        return ctx.reply(`✅ Категорію «${cat.title}» створено.\n\nКрок 3/3. Надішліть тематичну картинку, або /skip — без картинки.\n\n⚠️ Для прозорого фону надсилайте PNG як ФАЙЛ 📎, а не як «фото».`)
      }
    }

    if (a.flow === 'editcatfield') {
      const { categoryId, field } = a
      const value = field === 'emoji' && text === '-' ? null : text
      await db.updateCategoryField(categoryId, field, value)
      ctx.session.admin = undefined
      await ctx.reply('Готово ✅', { reply_markup: adminMenuKeyboard })
      return showCategoryCard(ctx, categoryId)
    }

    if (a.flow === 'broadcast') {
      a.payload = { text }
      a.step = 'confirm'
      return ctx.reply(
        `Попередній перегляд розсилки:\n\n${text}\n\nНадіслати всім клієнтам?`,
        { parse_mode: 'HTML', reply_markup: broadcastConfirmKeyboard() },
      )
    }

    if (a.flow === 'reply') {
      try {
        await ctx.api.sendMessage(a.targetTgId, `🍬 <b>WowSmak</b>\n\n${text}`, { parse_mode: 'HTML' })
        await db.logMessage({ tgId: a.targetTgId, direction: 'out', text, adminId: ctx.from.id })
        await ctx.reply('Відповідь надіслано клієнту ✅', { reply_markup: adminMenuKeyboard })
      } catch {
        await ctx.reply('Не вдалося надіслати (можливо, клієнт заблокував бота).')
      }
      ctx.session.admin = undefined
      return
    }

    return next()
  })

  // Медіа-диспетчер адміна (фото/відео)
  bot.on(['message:photo', 'message:video', 'message:document'], async (ctx, next) => {
    const a = ctx.session.admin
    if (!a || !isAdmin(ctx.from.id)) return next()

    if (a.flow === 'broadcast' && ctx.message.photo) {
      const fileId = ctx.message.photo.at(-1).file_id
      a.payload = { text: ctx.message.caption || '', photo: fileId }
      a.step = 'confirm'
      return ctx.replyWithPhoto(fileId, {
        caption: `Попередній перегляд розсилки.\n\n${a.payload.text}\n\nНадіслати всім?`,
        parse_mode: 'HTML',
        reply_markup: broadcastConfirmKeyboard(),
      })
    }

    if (a.flow === 'collect_cat_image') {
      // Документ (файл) зберігає прозорість PNG; «фото» Telegram стискає в JPEG (білий фон).
      const doc = ctx.message.document
      if (doc && doc.mime_type && !doc.mime_type.startsWith('image/')) {
        return ctx.reply('Це не картинка. Надішліть зображення (PNG із прозорим фоном) файлом ���.')
      }
      const fileId = doc ? doc.file_id : (ctx.message.photo ? ctx.message.photo.at(-1).file_id : null)
      if (!fileId) return ctx.reply('Надішліть картинку. Щоб зберегти прозорість, надсилайте PNG файлом 📎 («Файл»), а не як «фото».')
      try {
        await ctx.reply('Завантажую картинку… ⏳')
        const url = await telegramFileUrl(ctx, fileId)
        const publicId = await uploadImage(url, 'candy-shop/categories')
        await db.updateCategoryField(a.categoryId, 'image_url', publicId)
        const categoryId = a.categoryId
        ctx.session.admin = undefined
        await ctx.reply('🖼 Картинку категорії збережено ✅', { reply_markup: adminMenuKeyboard })
        return showCategoryCard(ctx, categoryId)
      } catch (e) {
        console.error('Завантаження картинки категорії:', e)
        return ctx.reply('Не вдалося завантажити картинку. Спробуйте ще раз або /cancel.')
      }
    }

    if (a.flow === 'collect_media') {
      try {
        if (ctx.message.video) {
          await ctx.reply('Завантажую відео… ⏳')
          const url = await telegramFileUrl(ctx, ctx.message.video.file_id)
          const publicId = await uploadVideo(url)
          await db.updateProductField(a.productId, 'video_url', publicId)
          return ctx.reply('🎥 Відео збережено. Надішліть ще фото/відео або /done.')
        }
        if (ctx.message.photo) {
          const url = await telegramFileUrl(ctx, ctx.message.photo.at(-1).file_id)
          const publicId = await uploadImage(url)
          const count = await db.addProductImage(a.productId, publicId)
          return ctx.reply(`🖼 Фото додано (усього: ${count}). Надішліть ще або /done.`)
        }
      } catch (e) {
        console.error('Завантаження медіа:', e)
        return ctx.reply('Не вдалося завантажити файл. Спробуйте ще раз або /cancel.')
      }
      return
    }

    return next()
  })
}
