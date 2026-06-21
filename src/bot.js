import { Bot, session } from 'grammy'
import { config } from './config.js'
import { registerAdmin, isAdmin } from './admin/index.js'
import { registerMisc } from './handlers/misc.js'
import { registerCatalog } from './handlers/catalog.js'
import { registerCart } from './handlers/cart.js'
import { registerCheckout } from './handlers/checkout.js'
import { registerSupport } from './handlers/support.js'

export function createBot() {
  const bot = new Bot(config.botToken)

  // Session зберігає тимчасовий стан (оформлення замовлення, адмін-діалоги).
  // Для продакшену підключіть сховище (наприклад @grammyjs/storage-supabase).
  bot.use(session({ initial: () => ({}) }))

  // Порядок важливий!
  // 1) admin — першим: його текст/медіа-диспетчери мають перехоплювати ввід
  //    адміна раніше за меню/оформлення (за відсутності діалогу — next()).
  registerAdmin(bot)
  registerMisc(bot)
  registerCatalog(bot)
  registerCart(bot)
  registerCheckout(bot)
  // 2) support — останнім: ловить «решту» вільного тексту клієнта й пересилає адмінам.
  registerSupport(bot)

  bot.catch(async (err) => {
    console.error('Помилка в боті:', err)
    // Щоб дії адміна ніколи не «зависали» мовчки — показуємо причину адміну.
    try {
      const ctx = err.ctx
      if (ctx && isAdmin(ctx.from?.id)) {
        const msg = err.error?.message || err.message || String(err.error || err)
        await ctx.reply('⚠️ Сталася помилка під час обробки дії:\n\n' + msg)
      }
    } catch (e) {
      console.error('Не вдалося повідомити адміна про помилку:', e)
    }
  })

  return bot
}
