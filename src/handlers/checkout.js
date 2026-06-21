import { getCart, createOrder } from '../db.js'
import { mainMenuKeyboard } from '../keyboards.js'
import { price } from '../format.js'
import { notifyAdminsNewOrder } from '../notify.js'

// Простий покроковий збір даних через session (без оплати).
const STEPS = ['fullName', 'phone', 'address', 'comment']
const PROMPTS = {
  fullName: 'Введіть ваше ім’я та прізвище:',
  phone: 'Введіть номер телефону:',
  address: 'Введіть адресу доставки:',
  comment: 'Коментар до замовлення (або напишіть «-»):',
}

export function registerCheckout(bot) {
  // Старт оформлення
  bot.callbackQuery('checkout', async (ctx) => {
    const cart = await getCart(ctx.from.id)
    if (!cart.length) {
      return ctx.answerCallbackQuery({ text: 'Кошик порожній', show_alert: true })
    }
    await ctx.answerCallbackQuery()
    ctx.session.checkout = { step: 0, data: {} }
    await ctx.reply(PROMPTS[STEPS[0]])
  })

  // Обробка текстових відповідей під час оформлення
  bot.on('message:text', async (ctx, next) => {
    const flow = ctx.session.checkout
    if (!flow) return next() // не в процесі оформлення — пропускаємо далі

    const key = STEPS[flow.step]
    flow.data[key] = ctx.message.text.trim()
    flow.step += 1

    if (flow.step < STEPS.length) {
      return ctx.reply(PROMPTS[STEPS[flow.step]])
    }

    // Усі дані зібрано — створюємо замовлення
    try {
      const { order, items, total } = await createOrder(ctx.from.id, {
        fullName: flow.data.fullName,
        phone: flow.data.phone,
        address: flow.data.address,
        comment: flow.data.comment === '-' ? null : flow.data.comment,
      })
      ctx.session.checkout = undefined

      const list = items.map((i) => `• ${i.title} × ${i.qty}`).join('\n')
      await ctx.reply(
        `✅ <b>Замовлення #${order.id} прийнято!</b>\n\n${list}\n\nРазом: <b>${price(total)}</b>\n\nМи зв’яжемося з вами для підтвердження 💛`,
        { parse_mode: 'HTML', reply_markup: mainMenuKeyboard(ctx.from.id) },
      )

      // Сповіщення адмінам — накладна (текст + PDF) і кнопка відповіді клієнту
      await notifyAdminsNewOrder({ api: ctx.api, order, items, total })
    } catch (e) {
      ctx.session.checkout = undefined
      await ctx.reply('Ой, щось пішло не так під час оформлення. Спробуйте ще раз.')
      console.error(e)
    }
  })
}
