import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { webhookCallback } from 'grammy'
import { config } from './config.js'
import { createBot } from './bot.js'
import { createApiRouter } from './api.js'
import { notifyAdminsNewOrder, notifyAdminsSupport, notifyRestock, notifyAdminsWebOrder } from './notify.js'
import { createSiteRouter } from './web/router.js'
console.log('VERSION 2026-06-11-01')
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MINIAPP_DIR = path.join(__dirname, '..', 'miniapp')
const SITE_PUBLIC_DIR = path.join(__dirname, '..', 'public-site')

const bot = createBot()
const app = express()

// Healthcheck для Render (сайт займає '/', тому окремий шлях)
app.get('/healthz', (_req, res) => res.send('Candy bot is running 🍬'))

// Webhook endpoint (до загального express.json, у grammY власний парсер)
const hookPath = `/webhook/${config.webhookSecret}`
app.use(hookPath, express.json(), webhookCallback(bot, 'express'))

// API для Mini App
app.use('/api', createApiRouter())

// Статика Mini App за /app
app.use('/app', express.static(MINIAPP_DIR))
app.get('/app/*', (_req, res) => res.sendFile(path.join(MINIAPP_DIR, 'index.html')))

// Статика сайту (CSS/JS/зображення) за /assets
app.use('/assets', express.static(SITE_PUBLIC_DIR))

// Колбек сповіщення адмінів про замовлення з Mini App — формує накладну + PDF
app.locals.notifyOrder = ({ order, items, total, stockOut, stockLow }) =>
  notifyAdminsNewOrder({ api: bot.api, order, items, total, stockOut, stockLow })

// Колбек питань клієнта з Mini App — пересилає адмінам
app.locals.notifySupport = ({ tgId, tgUser, text }) =>
  notifyAdminsSupport({ api: bot.api, tgId, tgUser, text })

app.locals.notifyRestock = ({ productId }) =>
  notifyRestock({ api: bot.api, productId })

// Колбек сповіщення адмінів про замовлення з САЙТУ
app.locals.notifyWebOrder = ({ order, items, total, stockOut, stockLow }) =>
  notifyAdminsWebOrder({ api: bot.api, order, items, total, stockOut, stockLow })

// Публічний сайт магазину — монтується ОСТАННІМ (обробляє '/', каталог, кошик тощо)
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use('/', createSiteRouter())

async function start() {
  await bot.init()

  if (config.publicUrl) {
    const url = `${config.publicUrl}${hookPath}`
    await bot.api.setWebhook(url, {
      secret_token:
        config.webhookSecret.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 256) || undefined,
    })
    console.log(`✅ Webhook встановлено: ${url}`)

    // Кнопка меню чату — відкриває Mini App
    try {
      await bot.api.setChatMenuButton({
        menu_button: {
          type: 'web_app',
          text: '🍬 Магазин',
          web_app: { url: `${config.publicUrl}/app/` },
        },
      })
      console.log('✅ Mini App прив’язано до кнопки меню')
    } catch (e) {
      console.warn('Не вдалося встановити кнопку меню:', e.message)
    }
  } else {
    await bot.api.deleteWebhook()
    bot.start()
    console.log('✅ Бот запущено в режимі polling')
  }

  app.listen(config.port, () => {
    console.log(`🌐 Сервер слухає порт ${config.port}`)
    if (config.publicUrl) console.log(`🖼 Mini App: ${config.publicUrl}/app/`)
  })
}

start().catch((e) => {
  console.error('Не вдалося запустити:', e)
  process.exit(1)
})
