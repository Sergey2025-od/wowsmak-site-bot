// ============================================================
//  ЛОКАЛЬНИЙ ПРЕВЬЮ САЙТУ (без Supabase / Cloudinary)
//  Запуск:  node preview/preview-server.mjs
//  Відкрийти: http://localhost:8080
//
//  Це ТІЛЬКИ для перегляду дизайну та вёрстки на вигаданих товарах.
//  Реальні товари/замовлення працюють через npm start (з реальною БД).
//  Вхід через Telegram тут не працює (потрібен реальний домен у BotFather),
//  але є кнопка «Демо-вхід», щоб побачити стан «увійшов».
// ============================================================
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Ставимо безпечні змінні для превью (щоб не було попереджень і був username бота)
process.env.SITE_URL = process.env.SITE_URL || 'http://localhost:8080'
process.env.TELEGRAM_BOT_URL = process.env.TELEGRAM_BOT_URL || 'https://t.me/WowSmakBot'
process.env.SHOP_NAME = process.env.SHOP_NAME || 'WowSmak'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ASSETS_DIR = path.join(ROOT, 'public-site')

// Модулі рендерингу (без db.js!)
const pages = await import('../src/web/pages.js')
const seo = await import('../src/web/seo.js')
const content = await import('../src/web/content.js')
const cartLib = await import('../src/web/cart.js')
const util = await import('../src/web/util.js')

// ---------- МОКОВІ ДАНІ ----------
const CATEGORIES = [
  { id: 1, title: 'Шоколад', emoji: '🍫', image: null },
  { id: 2, title: 'Льодяники та карамель', emoji: '🍬', image: null },
  { id: 3, title: 'Мармелад та желейки', emoji: '🍮', image: null },
  { id: 4, title: 'Подарункові набори', emoji: '🎁', image: null },
]

function img(seed, w = 800) {
  return `https://picsum.photos/seed/wow${seed}/${w}/${w}`
}

function mkProduct(o) {
  const price = o.price
  const sale = o.salePrice ?? null
  const discount = sale != null && price > 0 ? Math.round((1 - sale / price) * 100) : null
  const cat = CATEGORIES.find((c) => c.id === o.categoryId)
  const p = {
    id: o.id,
    title: o.title,
    description: o.description || '',
    fullDescription: o.fullDescription || null,
    price,
    salePrice: sale,
    discount,
    effectivePrice: sale != null ? sale : price,
    stock: o.stock ?? 25,
    available: o.available !== false,
    weightG: o.weightG ?? 100,
    unitsPerPack: o.unitsPerPack ?? null,
    flavors: o.flavors || [],
    packs: o.packs || [],
    image: img(o.id, 800),
    imageLarge: img(o.id, 1200),
    images: [img(o.id, 1000), img(o.id + 100, 1000), img(o.id + 200, 1000)],
    video: null,
    categoryId: o.categoryId,
    category: cat ? { id: cat.id, title: cat.title, emoji: cat.emoji } : null,
    createdAt: o.createdAt || '2026-06-01',
    orderCount: o.orderCount ?? 0,
    rating: o.rating ?? Number((4.3 + ((o.id % 7) / 10)).toFixed(1)),
    ratingCount: o.ratingCount ?? ((o.orderCount ?? 0) * 4 + 27),
    soldToday: o.soldToday ?? Math.max(2, Math.round((o.orderCount ?? 0) / 4)),
    hit: o.hit ?? ((o.orderCount ?? 0) >= 45),
    proteins: 5, fats: 20, carbs: 60, calories: o.calories ?? 520,
    countryOfOrigin: 'Україна', shelfLife: '6 місяців',
  }
  p.path = util.productPath(p)
  return p
}

const PRODUCTS = [
  mkProduct({ id: 1, categoryId: 1, title: 'Молочний шоколад «WowSmak»', description: 'Ніжний молочний шоколад ручної роботи.', fullDescription: 'Натуральний молочний шоколад із відбірних какао-бобів. Без штучних домішок.', price: 120, salePrice: 95, orderCount: 42, packs: [{ label: '1 плитка', price: 95 }, { label: 'Набір 3 шт', price: 260 }], flavors: ['Молочний', 'Горіхи'] }),
  mkProduct({ id: 2, categoryId: 1, title: 'Чорний шоколад 70%', description: 'Насичений смак справжнього какао.', price: 140, orderCount: 30, flavors: ['Класичний'] }),
  mkProduct({ id: 3, categoryId: 2, title: 'Карамельні льодяники «Мікс»', description: 'Кольорові льодяники з фруктовими смаками.', price: 65, orderCount: 55, flavors: ['Полуниця', 'Яблуко', 'Цитрус'] }),
  mkProduct({ id: 4, categoryId: 2, title: 'Леденці на паличці', description: 'Класичні леденці різних кольорів.', price: 25, salePrice: 19, orderCount: 70 }),
  mkProduct({ id: 5, categoryId: 3, title: 'Желейні ведмедики', description: 'М’які желейки з натуральним соком.', price: 80, orderCount: 38, flavors: ['Асорті'] }),
  mkProduct({ id: 6, categoryId: 3, title: 'Мармелад «Цитрус»', description: 'Натуральний мармелад у цукровій посипці.', price: 90, salePrice: 75, orderCount: 25 }),
  mkProduct({ id: 7, categoryId: 4, title: 'Подарунковий набір «Lux»', description: 'Асорті солодощів у подарунковій коробці.', fullDescription: 'Великий подарунковий набір: шоколад, мармелад, льодяники та карамель. Ідеально на свято.', price: 450, salePrice: 390, orderCount: 18, packs: [{ label: 'Середній', price: 390 }, { label: 'Великий', price: 650 }] }),
  mkProduct({ id: 8, categoryId: 4, title: 'Солодкий бокс «Mini»', description: 'Невеличкий набір для приємного сюрпризу.', price: 220, orderCount: 22 }),
]

const byId = (id) => PRODUCTS.find((p) => p.id === Number(id))

function mockReviews(id) {
  const base = [
    { rating: 5, text: 'Дуже смачно, замовлятимемо ще!', name: 'Олена' },
    { rating: 5, text: 'Швидка доставка, все свіже.', name: 'Андрій' },
    { rating: 4, text: 'Смакота, рекомендую.', name: 'Марія' },
  ]
  if (id % 2 === 0) return { reviews: base.slice(0, 2), avg: 4.5, count: 2 }
  return { reviews: base, avg: 4.7, count: 3 }
}

function related(p) {
  return PRODUCTS.filter((x) => x.categoryId === p.categoryId && x.id !== p.id).slice(0, 4)
}

function homeData() {
  const hits = [...PRODUCTS].sort((a, b) => b.orderCount - a.orderCount).slice(0, 8)
  const novelties = [...PRODUCTS].slice(0, 8)
  const sales = PRODUCTS.filter((p) => p.salePrice != null).slice(0, 8)
  return { categories: CATEGORIES, products: PRODUCTS, hits, novelties, sales }
}

function resolveCart(cookieItems) {
  const items = []
  for (const ci of cookieItems) {
    const p = byId(ci.id)
    if (!p) continue
    let unit = p.effectivePrice
    let packLabel = null
    if (ci.pack && p.packs.length) {
      const pk = p.packs.find((x) => x.label === ci.pack)
      if (pk) { unit = pk.price; packLabel = pk.label }
    }
    items.push({ id: p.id, title: p.title, path: p.path, image: p.image, packLabel, unitPrice: unit, qty: ci.qty, lineTotal: unit * ci.qty, available: p.available, stock: p.stock })
  }
  const total = items.reduce((s, i) => s + i.lineTotal, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  return { items, total, count }
}

// ---------- HTTP хелпери ----------
const MIME = { '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon' }

function sendHtml(res, body, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' })
  res.end(body)
}
function sendJson(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(obj))
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy() })
    req.on('end', () => resolve(data))
  })
}

const DEMO_COOKIE = 'wow_session'
function demoUser(req) {
  return util.parseCookies(req)[DEMO_COOKIE] ? { id: 1, first_name: 'Демо', username: 'demo_user' } : null
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost')
    const p = decodeURIComponent(url.pathname)

    // ---- Статика ----
    if (p.startsWith('/assets/')) {
      const rel = p.replace('/assets/', '')
      const file = path.join(ASSETS_DIR, rel)
      if (!file.startsWith(ASSETS_DIR) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); return res.end('not found')
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' })
      return res.end(fs.readFileSync(file))
    }

    // ---- JSON стани ----
    if (p === '/cart/state') return sendJson(res, { count: cartLib.cartCount(cartLib.readCart(req)) })
    if (p === '/auth/state') {
      const u = demoUser(req)
      return sendJson(res, u ? { user: { id: u.id, name: u.first_name, username: u.username } } : { user: null })
    }

    // ---- Операції кошика ----
    if (req.method === 'POST' && p.startsWith('/cart/')) {
      const body = JSON.parse((await readBody(req)) || '{}')
      let cart = cartLib.readCart(req)
      if (p === '/cart/add') cartLib.addItem(cart, body.id, body.qty || 1, body.pack || null)
      else if (p === '/cart/update') cartLib.setQty(cart, body.id, body.qty, body.pack || null)
      else if (p === '/cart/remove') cart = cartLib.removeItem(cart, body.id, body.pack || null)
      else if (p === '/cart/clear') { cartLib.clearCart(res); return sendJson(res, { ok: true, count: 0 }) }
      cartLib.writeCart(res, cart)
      return sendJson(res, { ok: true, count: cartLib.cartCount(cart) })
    }

    // ---- Демо-вхід/вихід (замість справжнього Telegram) ----
    if (p === '/auth/demo') {
      res.writeHead(302, { 'Set-Cookie': `${DEMO_COOKIE}=1; Path=/; SameSite=Lax`, Location: url.searchParams.get('next') || '/checkout' })
      return res.end()
    }
    if (p === '/auth/logout') {
      res.writeHead(302, { 'Set-Cookie': `${DEMO_COOKIE}=; Path=/; Max-Age=0`, Location: url.searchParams.get('next') || '/' })
      return res.end()
    }
    if (p === '/auth/telegram/callback') {
      // У превью справжній Telegram-вхід недоступний — робимо демо-вхід
      res.writeHead(302, { 'Set-Cookie': `${DEMO_COOKIE}=1; Path=/; SameSite=Lax`, Location: '/checkout' })
      return res.end()
    }

    // ---- Сторінки ----
    if (p === '/') return sendHtml(res, pages.homePage(homeData()))
    if (p === '/catalog') {
      const q = (url.searchParams.get('q') || '').trim()
      let products = PRODUCTS
      if (q) products = PRODUCTS.filter((x) => x.title.toLowerCase().includes(q.toLowerCase()))
      return sendHtml(res, pages.catalogPage({ categories: CATEGORIES, products, activeCategory: null, query: q }))
    }
    if (p.startsWith('/catalog/')) {
      const id = util.idFromParam(p.split('/')[2])
      const activeCategory = CATEGORIES.find((c) => c.id === id)
      if (!activeCategory) return sendHtml(res, pages.notFoundPage(), 404)
      const products = PRODUCTS.filter((x) => x.categoryId === id)
      return sendHtml(res, pages.catalogPage({ categories: CATEGORIES, products, activeCategory, query: '' }))
    }
    if (p.startsWith('/product/')) {
      const id = util.idFromParam(p.split('/')[2])
      const product = byId(id)
      if (!product) return sendHtml(res, pages.notFoundPage(), 404)
      return sendHtml(res, pages.productPage({ product, related: related(product), reviews: mockReviews(id), categories: CATEGORIES }))
    }
    if (p === '/favorites') return sendHtml(res, pages.favoritesPage())
    if (p === '/cart') return sendHtml(res, pages.cartPage({ cart: resolveCart(cartLib.readCart(req)) }))
    if (p === '/checkout' && req.method === 'GET') {
      return sendHtml(res, pages.checkoutPage({ cart: resolveCart(cartLib.readCart(req)), user: demoUser(req) }))
    }
    if (p === '/checkout' && req.method === 'POST') {
      await readBody(req) // у превью не зберігаємо
      cartLib.clearCart(res)
      res.writeHead(302, { Location: '/order/success?id=DEMO-1001' })
      return res.end()
    }
    if (p === '/order/success') return sendHtml(res, pages.successPage({ orderId: url.searchParams.get('id') || 'DEMO-1001' }))
    if (p === '/blog') return sendHtml(res, pages.blogPage())
    if (p.startsWith('/blog/')) {
      const a = content.getArticle(p.split('/')[2])
      if (!a) return sendHtml(res, pages.notFoundPage(), 404)
      return sendHtml(res, pages.articlePage(a))
    }
    const info = content.infoPages()
    if (p === '/about') return sendHtml(res, pages.infoPage(info.about, '/about'))
    if (p === '/delivery') return sendHtml(res, pages.infoPage(info.delivery, '/delivery'))
    if (p === '/contacts') return sendHtml(res, pages.infoPage(info.contacts, '/contacts'))
    if (p === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8' })
      return res.end(seo.sitemapXml({ products: PRODUCTS, categories: CATEGORIES.map((c) => ({ ...c, path: util.categoryPath(c) })), articles: content.ARTICLES, staticPaths: content.STATIC_PATHS }))
    }
    if (p === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
      return res.end(seo.robotsTxt())
    }

    return sendHtml(res, pages.notFoundPage(), 404)
  } catch (e) {
    console.error(e)
    sendHtml(res, '<pre>' + (e && e.stack ? e.stack : String(e)) + '</pre>', 500)
  }
})

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080
server.listen(PORT, () => {
  console.log('\n  🍬 WowSmak — превью сайту (мокові дані)')
  console.log('  Відкрийте у браузері:  http://localhost:' + PORT + '\n')
})
