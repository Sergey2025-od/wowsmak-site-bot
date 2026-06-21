import * as db from '../db.js'
import { isAdmin } from '../admin/index.js'
import { replyKeyboard } from '../admin/keyboards.js'
import { config } from '../config.js'

// Реле зв’язку з клієнтом: вільний текст клієнта пересилається адмінам
// з кнопкою «Відповісти». Реєструється ОСТАННІМ, щоб не перехоплювати
// кнопки меню та кроки оформлення замовлення.
export function registerSupport(bot) {
  bot.on('message:text', async (ctx, next) => {
    // Повідомлення адмінів не пересилаємо
    if (isAdmin(ctx.from.id)) return next()

    const text = ctx.message.text
    await db.upsertCustomer({
      tgId: ctx.from.id,
      username: ctx.from.username,
      fullName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    })
    await db.logMessage({ tgId: ctx.from.id, direction: 'in', text })

    const who = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name || ctx.from.id
    const header = `📩 <b>Повідомлення від клієнта</b>\n${who} (id <code>${ctx.from.id}</code>)\n\n${text}`
    for (const adminId of config.adminIds) {
      try {
        await ctx.api.sendMessage(adminId, header, {
          parse_mode: 'HTML',
          reply_markup: replyKeyboard(ctx.from.id),
        })
      } catch {
        /* адмін недоступний */
      }
    }

    await ctx.reply('Дякуємо за повідомлення! 🍬 Ми відповімо найближчим часом.')
  })
}
