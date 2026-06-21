import { InlineKeyboard } from 'grammy'
import { supabase, upsertCustomer } from '../db.js'
import { mainMenuKeyboard } from '../keyboards.js'
import { price } from '../format.js'
import { config } from '../config.js'

export function registerMisc(bot) {
  // /start
  bot.command('start', async (ctx) => {
    await upsertCustomer({
      tgId: ctx.from.id,
      username: ctx.from.username,
      fullName: [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
    })
    const inline = config.publicUrl
      ? new InlineKeyboard().webApp('🍬 Відкрити магазин', `${config.publicUrl}/app/`)
      : undefined
    await ctx.reply(
      '🍬 <b>Ласкаво просимо до WowSmak!</b>\n\n' +
        'Найсмачніші цукерки, шоколад та подарункові набори.\n\n' +
        'Натисніть 🍬 <b>Магазин</b> — і обирайте у зручному застосунку. Усередині можна також написати нам запитання.',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(ctx.from.id) },
    )
    if (inline) {
      await ctx.reply('⤵️ Або відкрийте магазин тут:', { reply_markup: inline })
    }
  })

  // Допомога
  const help = (ctx) =>
    ctx.reply(
      'ℹ️ <b>Як замовити:</b>\n\n' +
        '1️⃣ Відкрийте 🍬 Каталог\n' +
        '2️⃣ Додайте товари до 🛒 Кошика\n' +
        '3️⃣ Натисніть ✅ Оформити замовлення\n\n' +
        'З будь-яких питань пишіть менеджеру 💛',
      { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(ctx.from.id) },
    )
  bot.command('help', help)
  bot.hears('ℹ️ Допомога', help)

  // Мої замовлення
  const myOrders = async (ctx) => {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, total, created_at')
      .eq('tg_id', ctx.from.id)
      .order('created_at', { ascending: false })
      .limit(10)
    if (!orders || !orders.length) {
      return ctx.reply('У вас поки немає замовлень.')
    }
    const statusUa = {
      new: '🆕 Нове',
      confirmed: '✅ Підтверджено',
      shipped: '🚚 Відправлено',
      done: '🎉 Виконано',
      cancelled: '❌ Скасовано',
    }
    const text = orders
      .map((o) => `#${o.id} — ${statusUa[o.status] || o.status} — ${price(o.total)}`)
      .join('\n')
    await ctx.reply(`📦 <b>Ваші замовлення:</b>\n\n${text}`, { parse_mode: 'HTML' })
  }
  bot.command('orders', myOrders)
  bot.hears('📦 Мої замовлення', myOrders)
}
