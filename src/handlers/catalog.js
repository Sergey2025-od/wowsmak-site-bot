import { getCategories, getProductsByCategory, getProduct, addToCart } from '../db.js'
import { categoriesKeyboard, productKeyboard } from '../keyboards.js'
import { imageUrl, videoUrl } from '../cloudinary.js'
import { productCaption, parsePacks } from '../format.js'

export function registerCatalog(bot) {
  const showCategories = async (ctx) => {
    const categories = await getCategories()
    if (!categories.length) {
      return ctx.reply('Каталог поки порожній. Завітайте пізніше 😊')
    }
    await ctx.reply('Оберіть категорію:', {
      reply_markup: categoriesKeyboard(categories),
    })
  }

  bot.command('catalog', showCategories)
  bot.hears('🍬 Каталог', showCategories)

  // Показати товари категорії
  bot.callbackQuery(/^cat:(\d+)$/, async (ctx) => {
    const categoryId = Number(ctx.match[1])
    await ctx.answerCallbackQuery()
    const products = await getProductsByCategory(categoryId)
    if (!products.length) {
      return ctx.reply('У цій категорії поки немає товарів.')
    }
    for (const p of products) {
      const caption = productCaption(p)
      const photo = imageUrl(p.image_url)
      const video = videoUrl(p.video_url)
      const markup = productKeyboard(p)
      if (photo) {
        await ctx.replyWithPhoto(photo, { caption, parse_mode: 'HTML', reply_markup: markup })
      } else if (video) {
        await ctx.replyWithVideo(video, { caption, parse_mode: 'HTML', reply_markup: markup })
      } else {
        await ctx.reply(caption, { parse_mode: 'HTML', reply_markup: markup })
      }
    }
  })

  // Додати в кошик (з перевіркою залишку)
  bot.callbackQuery(/^add:(\d+)$/, async (ctx) => {
    const productId = Number(ctx.match[1])
    const product = await getProduct(productId)
    if (product.stock != null && product.stock <= 0) {
      return ctx.answerCallbackQuery({ text: 'На жаль, товару немає в наявності', show_alert: true })
    }
    await addToCart(ctx.from.id, productId, 1)
    await ctx.answerCallbackQuery({ text: `Додано: ${product.title} ✅` })
  })

  // Додати в кошик конкретну фасовку
  bot.callbackQuery(/^addp:(\d+):(.+)$/, async (ctx) => {
    const productId = Number(ctx.match[1])
    const packLabel = ctx.match[2]
    const product = await getProduct(productId)
    if (product.stock != null && product.stock <= 0) {
      return ctx.answerCallbackQuery({ text: 'На жаль, товару немає в наявності', show_alert: true })
    }
    const packs = parsePacks(product)
    const pack = packs.find((x) => x.label === packLabel) || packs[0] || null
    await addToCart(ctx.from.id, productId, 1, pack)
    await ctx.answerCallbackQuery({ text: pack ? `Додано: ${product.title} · ${pack.label} ✅` : `Додано ✅` })
  })
}
