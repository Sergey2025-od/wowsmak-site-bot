import { getCart, getProduct, addToCart, setCartQty, clearCart } from '../db.js'
import { cartKeyboard } from '../keyboards.js'
import { cartSummary } from '../format.js'

async function renderCart(ctx, edit = false) {
  const cart = await getCart(ctx.from.id)
  const text = cartSummary(cart)
  const opts = { parse_mode: 'HTML', reply_markup: cartKeyboard(cart) }
  if (edit) {
    try {
      await ctx.editMessageText(text, opts)
      return
    } catch {
      /* повідомлення могло не змінитися — ігноруємо */
    }
  }
  await ctx.reply(text, opts)
}

export function registerCart(bot) {
  bot.command('cart', (ctx) => renderCart(ctx))
  bot.hears('🛒 Кошик', (ctx) => renderCart(ctx))

  bot.callbackQuery(/^inc:(\d+)$/, async (ctx) => {
    await addToCart(ctx.from.id, Number(ctx.match[1]), 1)
    await ctx.answerCallbackQuery()
    await renderCart(ctx, true)
  })

  bot.callbackQuery(/^dec:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1])
    const cart = await getCart(ctx.from.id)
    const item = cart.find((i) => i.product.id === productId)
    if (item) await setCartQty(ctx.from.id, productId, item.qty - 1)
    await ctx.answerCallbackQuery()
    await renderCart(ctx, true)
  })

  bot.callbackQuery('clear', async (ctx) => {
    await clearCart(ctx.from.id)
    await ctx.answerCallbackQuery({ text: 'Кошик очищено' })
    await renderCart(ctx, true)
  })

  bot.callbackQuery('noop', (ctx) => ctx.answerCallbackQuery())
}
