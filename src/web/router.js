// ============================================================
//  Роутер сайту (публічний, БЕЗ Telegram-авторизації).
//  Монтується ОСТАННІМ у server.js.
// ============================================================
import { Router } from 'express'
import { site } from './site.js'
import { idFromParam } from './util.js'
import {
  getHomeData,
  getCategories,
  getShopProducts,
  getProductById,
  getRelatedProducts,
  getProductReviews,
  resolveCart,
  createWebOrder,
} from './data.js'
import { readCart, writeCart, clearCart, addItem, setQty, removeItem, cartCount } from './cart.js'
import { verifyTelegramLogin, setSession, clearSession, readSession, safeNext } from './auth.js'
import {
  homePage,
  catalogPage,
  productPage,
  cartPage,
  checkoutPage,
  successPage,
  blogPage,
  articlePage,
  infoPage,
  notFoundPage,
  favoritesPage,
} from './pages.js'
import { ARTICLES, getArticle, infoPages, STATIC_PATHS } from './content.js'
import { sitemapXml, robotsTxt } from './seo.js'

const html = (res, body, status = 200) =>
  res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(body)

export function createSiteRouter() {
  const router = Router()

  // Кошик — JSON стан (для бейджа в шапці)
  router.get('/cart/state', (req, res) => {
    res.json({ count: cartCount(readCart(req)) })
  })

  // ---------- Telegram-авторизація ----------
  // Стан авторизації (для індикатора в шапці)
  router.get('/auth/state', (req, res) => {
    const user = readSession(req)
    res.json(user ? { user: { id: user.id, name: user.first_name || user.username || '', username: user.username || '' } } : { user: null })
  })

  // Callback від Telegram Login Widget (data-auth-url)
  router.get('/auth/telegram/callback', (req, res) => {
    const user = verifyTelegramLogin(req.query)
    const next = safeNext(req.query.next)
    if (!user) {
      return html(res, checkoutPage({ cart: { items: [], total: 0, count: 0 } }).replace('</main>', '<div class="container"><div class="alert alert--error">Не вдалося підтвердити вхід через Telegram. Спробуйте ще раз.</div></div></main>'), 401)
    }
    setSession(res, user)
    res.redirect(next)
  })

  // Вихід
  router.get('/auth/logout', (req, res) => {
    clearSession(res)
    res.redirect(safeNext(req.query.next))
  })

  // ---------- Головна ----------
  router.get('/', async (req, res, next) => {
    try {
      const data = await getHomeData()
      html(res, homePage(data))
    } catch (e) {
      next(e)
    }
  })

  // ---------- Каталог ----------
  router.get('/catalog', async (req, res, next) => {
    try {
      const q = (req.query.q || '').toString().trim().slice(0, 80)
      const [categories, all] = await Promise.all([getCategories(), getShopProducts()])
      let products = all
      if (q) {
        const ql = q.toLowerCase()
        products = all.filter(
          (p) =>
            p.title.toLowerCase().includes(ql) ||
            (p.description || '').toLowerCase().includes(ql),
        )
      }
      html(res, catalogPage({ categories, products, activeCategory: null, query: q }))
    } catch (e) {
      next(e)
    }
  })

  router.get('/catalog/:cat', async (req, res, next) => {
    try {
      const catId = idFromParam(req.params.cat)
      const [categories, all] = await Promise.all([getCategories(), getShopProducts()])
      const activeCategory = categories.find((c) => c.id === catId)
      if (!activeCategory) return html(res, notFoundPage(), 404)
      const products = all.filter((p) => p.categoryId === catId)
      html(res, catalogPage({ categories, products, activeCategory, query: '' }))
    } catch (e) {
      next(e)
    }
  })

  // ---------- Картка товару ----------
  router.get('/product/:id', async (req, res, next) => {
    try {
      const id = idFromParam(req.params.id)
      const product = await getProductById(id)
      if (!product) return html(res, notFoundPage(), 404)
      const [related, reviews, categories] = await Promise.all([
        getRelatedProducts(product),
        getProductReviews(product.id),
        getCategories(),
      ])
      html(res, productPage({ product, related, reviews, categories }))
    } catch (e) {
      next(e)
    }
  })

  // ---------- Операції з кошиком (JSON) ----------
  router.post('/cart/add', (req, res) => {
    const cart = readCart(req)
    addItem(cart, req.body.id, req.body.qty || 1, req.body.pack || null)
    writeCart(res, cart)
    res.json({ ok: true, count: cartCount(cart) })
  })
  router.post('/cart/update', (req, res) => {
    const cart = readCart(req)
    setQty(cart, req.body.id, req.body.qty, req.body.pack || null)
    writeCart(res, cart)
    res.json({ ok: true, count: cartCount(cart) })
  })
  router.post('/cart/remove', (req, res) => {
    let cart = readCart(req)
    cart = removeItem(cart, req.body.id, req.body.pack || null)
    writeCart(res, cart)
    res.json({ ok: true, count: cartCount(cart) })
  })
  router.post('/cart/clear', (req, res) => {
    clearCart(res)
    res.json({ ok: true, count: 0 })
  })

  // ---------- Кошик (сторінка) ----------
  router.get('/cart', async (req, res, next) => {
    try {
      const cart = await resolveCart(readCart(req))
      html(res, cartPage({ cart }))
    } catch (e) {
      next(e)
    }
  })

  // ---------- Оформлення ----------
  router.get('/checkout', async (req, res, next) => {
    try {
      const cart = await resolveCart(readCart(req))
      const user = readSession(req)
      html(res, checkoutPage({ cart, user }))
    } catch (e) {
      next(e)
    }
  })

  router.post('/checkout', async (req, res, next) => {
    try {
      const cookieCart = readCart(req)
      const cart = await resolveCart(cookieCart)
      const user = readSession(req)
      const b = req.body || {}
      const contact = {
        fullName: (b.fullName || '').toString().trim().slice(0, 120),
        phone: (b.phone || '').toString().trim().slice(0, 40),
        email: (b.email || '').toString().trim().slice(0, 120) || null,
        address: (b.address || '').toString().trim().slice(0, 300),
        comment: (b.comment || '').toString().trim().slice(0, 500) || null,
      }
      if (!cart.items.length) {
        return html(res, checkoutPage({ cart, values: contact, error: 'Кошик порожній.', user }))
      }
      if (!contact.fullName || !contact.phone || !contact.address) {
        return html(res, checkoutPage({ cart, values: contact, error: 'Заповніть обов’язкові поля (ім’я, телефон, адреса).', user }))
      }
      const items = cookieCart.map((i) => ({ productId: i.id, qty: i.qty, packLabel: i.pack || null }))
      const result = await createWebOrder({ items, contact, tgId: user?.id || null, tgUser: user })
      clearCart(res)
      // Сповіщаємо адмінів у Telegram (якщо підключено)
      try {
        const notify = req.app.locals.notifyWebOrder
        if (notify) await notify(result)
      } catch (err) {
        console.error('notifyWebOrder failed:', err)
      }
      res.redirect(`/order/success?id=${result.order.id}`)
    } catch (e) {
      if (e && e.message === 'empty_cart') {
        const cart = await resolveCart(readCart(req))
        return html(res, checkoutPage({ cart, values: req.body, error: 'Товари закінчились. Оновіть кошик.', user: readSession(req) }))
      }
      next(e)
    }
  })

  router.get('/order/success', (req, res) => {
    html(res, successPage({ orderId: (req.query.id || '').toString().slice(0, 40) }))
  })

  // ---------- Обране (клієнтське) ----------
  router.get('/favorites', (req, res) => html(res, favoritesPage()))

  // ---------- Блог ----------
  router.get('/blog', (req, res) => html(res, blogPage()))
  router.get('/blog/:slug', (req, res) => {
    const a = getArticle((req.params.slug || '').toString())
    if (!a) return html(res, notFoundPage(), 404)
    html(res, articlePage(a))
  })

  // ---------- Інфо-сторінки ----------
  const pages = infoPages()
  router.get('/about', (req, res) => html(res, infoPage(pages.about, '/about')))
  router.get('/delivery', (req, res) => html(res, infoPage(pages.delivery, '/delivery')))
  router.get('/contacts', (req, res) => html(res, infoPage(pages.contacts, '/contacts')))

  // ---------- SEO: sitemap / robots ----------
  router.get('/sitemap.xml', async (req, res, next) => {
    try {
      const [categories, products] = await Promise.all([getCategories(), getShopProducts()])
      const xml = sitemapXml({
        products,
        categories,
        articles: ARTICLES,
        staticPaths: STATIC_PATHS,
      })
      res.set('Content-Type', 'application/xml; charset=utf-8').send(xml)
    } catch (e) {
      next(e)
    }
  })

  router.get('/robots.txt', (req, res) => {
    res.set('Content-Type', 'text/plain; charset=utf-8').send(robotsTxt())
  })

  // ---------- 404 ----------
  router.use((req, res) => html(res, notFoundPage(), 404))

  // ---------- Помилки ----------
  router.use((err, req, res, next) => {
    console.error('Site error:', err)
    if (res.headersSent) return next(err)
    html(
      res,
      notFoundPage().replace('Сторінку не знайдено', 'Сталася помилка').replace('404', '500'),
      500,
    )
  })

  return router
}
