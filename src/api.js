import express from 'express'
import * as db from './db.js'
import { imageUrl, videoUrl, uploadImage, uploadVideo } from './cloudinary.js'
import { parsePacks, flavorList } from './format.js'
import { telegramAuth } from './telegramAuth.js'
import { config } from './config.js'

const effectivePrice = (p) => (p.sale_price != null ? Number(p.sale_price) : Number(p.price))

// Категорія для фронтенду: готовий URL картинки (або null — тоді показуємо емодзі)
function toClientCategory(c) {
  return {
    id: c.id,
    title: c.title,
    emoji: c.emoji || '🍬',
    image: c.image_url ? imageUrl(c.image_url, { width: 600, crop: 'fit', format: 'png' }) : null,
  }
}

// Приводимо товар до вигляду для фронтенду (готові URL медіа, ціни числами)
function toClientProduct(p, orderCount = 0) {
  const price = Number(p.price)
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const discount = sale != null && price > 0 ? Math.round((1 - sale / price) * 100) : null
  return {
    id: p.id,
    title: p.title,
    description: p.description || '',
    price,
    salePrice: sale,
    discount,
    effectivePrice: effectivePrice(p),
    stock: p.stock,
    weightG: p.weight_g ?? null,
    unitsPerPack: p.units_per_pack && p.units_per_pack > 0 ? p.units_per_pack : null,
    flavors: flavorList(p),
    packs: parsePacks(p),
    image: imageUrl(p.image_url, { width: 800 }),
    images: [p.image_url, ...(Array.isArray(p.images) ? p.images : [])]
      .filter(Boolean)
      .map((ref) => imageUrl(ref, { width: 800 })),
    video: videoUrl(p.video_url),
    categoryId: p.category_id,
    category: p.category ? { id: p.category.id, title: p.category.title, emoji: p.category.emoji } : null,
    createdAt: p.created_at || null,
    orderCount,
    fullDescription: p.full_description || null,
    proteins: p.proteins ?? null,
    fats: p.fats ?? null,
    carbs: p.carbs ?? null,
    calories: p.calories ?? null,
    countryOfOrigin: p.country_of_origin ?? null,
    shelfLife: p.shelf_life ?? null,
    barcode: p.barcode ?? null,
    inStock: p.in_stock,
  }
}

export function createApiRouter() {
  const router = express.Router()
  router.use(express.json())
  router.use(telegramAuth)

  // Стартові дані: профіль + категорії + товари + кошик
  router.get('/bootstrap', async (req, res, next) => {
    try {
      const [categories, products, cart, customer, orderCounts, purchasedIds] = await Promise.all([
        db.getCategories(),
        db.getShopProducts(),
        db.getCart(req.tgId),
        db.getCustomer(req.tgId),
        db.getProductOrderCounts(),
        db.getPurchasedProductIds(req.tgId),
      ])
      res.json({
        user: {
          id: req.tgId,
          name: req.tgUser.first_name || customer?.full_name || 'Гість',
          username: req.tgUser.username || customer?.username || null,
          photoUrl: req.tgUser.photo_url || null,
          phone: customer?.phone || null,
          fop: customer?.fop || null,
          address: customer?.address || null,
          isAdmin: config.adminIds.includes(req.tgId),
        },
        shopName: '🍬 WowSmak',
        categories: categories.map(toClientCategory),
        products: products.map((p) => toClientProduct(p, orderCounts[p.id] || 0)),
        cart: cart.map(toClientCartItem),
        purchasedIds,
      })
    } catch (e) {
      next(e)
    }
  })

  router.get('/products', async (req, res, next) => {
    try {
      const products = await db.getShopProducts()
      const categoryId = req.query.category ? Number(req.query.category) : null
      const filtered = categoryId ? products.filter((p) => p.category_id === categoryId) : products
      res.json({ products: filtered.map(toClientProduct) })
    } catch (e) {
      next(e)
    }
  })

  router.get('/product/:id', async (req, res, next) => {
    try {
      const p = await db.getProduct(Number(req.params.id))
      if (!p) return res.status(404).json({ error: 'not_found' })
      res.json({ product: toClientProduct(p) })
    } catch (e) {
      next(e)
    }
  })

  // ---------- Кошик ----------
  router.get('/cart', async (req, res, next) => {
    try {
      const cart = await db.getCart(req.tgId)
      res.json(buildCart(cart))
    } catch (e) {
      next(e)
    }
  })

  router.post('/cart/add', async (req, res, next) => {
    try {
      const productId = Number(req.body.productId)
      const qty = Number(req.body.qty || 1)
      const product = await db.getProduct(productId)
      if (product.stock != null && product.stock <= 0) {
        return res.status(409).json({ error: 'out_of_stock' })
      }
      // Якщо у товару є фасовки — беремо обрану (або першу за замовчуванням)
      const packs = parsePacks(product)
      let pack = null
      if (packs.length) {
        pack = packs.find((x) => x.label === req.body.packLabel) || packs[0]
      }
      await db.addToCart(req.tgId, productId, qty, pack)
      const cart = await db.getCart(req.tgId)
      res.json(buildCart(cart))
    } catch (e) {
      next(e)
    }
  })

  router.post('/cart/set', async (req, res, next) => {
    try {
      await db.setCartQty(req.tgId, Number(req.body.productId), Number(req.body.qty))
      const cart = await db.getCart(req.tgId)
      res.json(buildCart(cart))
    } catch (e) {
      next(e)
    }
  })

  router.post('/cart/remove', async (req, res, next) => {
    try {
      await db.removeFromCart(req.tgId, Number(req.body.productId))
      const cart = await db.getCart(req.tgId)
      res.json(buildCart(cart))
    } catch (e) {
      next(e)
    }
  })

  router.post('/cart/clear', async (req, res, next) => {
    try {
      await db.clearCart(req.tgId)
      res.json(buildCart([]))
    } catch (e) {
      next(e)
    }
  })

  // ---------- Замовлення ----------
  router.post('/order', async (req, res, next) => {
    try {
      const { fullName, phone, address, comment, fop, addressParts } = req.body || {}
      if (!fullName || !phone || !address) {
        return res.status(400).json({ error: 'missing_fields' })
      }
      const { order, items, total, stockOut, stockLow } = await db.createOrder(req.tgId, {
        fullName,
        phone,
        address,
        comment: comment || null,
        fop: fop || null,
        addressParts: addressParts || undefined,
      })
      // Сповіщення адмінам (через переданий notify-колбек)
      if (req.app.locals.notifyOrder) {
        req.app.locals.notifyOrder({ order, items, total, stockOut, stockLow, tgUser: req.tgUser }).catch(() => {})
      }
      res.json({ orderId: order.id, total })
    } catch (e) {
      next(e)
    }
  })

  router.get('/orders', async (req, res, next) => {
    try {
      const orders = await db.getOrders(req.tgId)
      res.json({ orders })
    } catch (e) {
      next(e)
    }
  })

  router.post('/orders/clear', async (req, res, next) => {
    try {
      await db.hideCustomerOrders(req.tgId)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  router.get('/order/:id', async (req, res, next) => {
    try {
      const order = await db.getOrderWithItems(req.tgId, Number(req.params.id))
      if (!order) return res.status(404).json({ error: 'not_found' })
      res.json({ order })
    } catch (e) {
      next(e)
    }
  })

  // ---------- Підтримка / питання клієнта ----------
  router.post('/support', async (req, res, next) => {
    try {
      const text = String(req.body.text || '').trim()
      if (!text) return res.status(400).json({ error: 'empty' })
      if (text.length > 2000) return res.status(400).json({ error: 'too_long' })
      if (req.app.locals.notifySupport) {
        await req.app.locals.notifySupport({ tgId: req.tgId, tgUser: req.tgUser, text })
      }
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  router.get('/profile', async (req, res, next) => {
    try {
      const [customer, orders] = await Promise.all([
        db.getCustomer(req.tgId),
        db.getOrders(req.tgId, 100),
      ])
      const totalSpent = orders
        .filter((o) => o.status !== 'cancelled')
        .reduce((s, o) => s + Number(o.total || 0), 0)
      res.json({
        profile: {
          id: req.tgId,
          name: req.tgUser.first_name || customer?.full_name || 'Гість',
          username: req.tgUser.username || customer?.username || null,
          photoUrl: req.tgUser.photo_url || null,
          phone: customer?.phone || null,
          fop: customer?.fop || null,
          address: customer?.address || null,
          isAdmin: config.adminIds.includes(req.tgId),
          ordersCount: orders.length,
          totalSpent,
        },
      })
    } catch (e) {
      next(e)
    }
  })

  // ---------- Адмін: швидке керування залишками ----------
  function isAdminReq(req) {
    return config.adminIds.includes(req.tgId)
  }

  // Список усіх товарів для таблиці залишків
  router.post('/restock/subscribe', async (req, res, next) => {
    try {
      const productId = Number(req.body && req.body.productId)
      if (!productId) return res.status(400).json({ error: 'bad_product' })
      await db.addRestockSub(req.tgId, productId)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  router.post('/restock/unsubscribe', async (req, res, next) => {
    try {
      const productId = Number(req.body && req.body.productId)
      await db.removeRestockSub(req.tgId, productId)
      res.json({ ok: true })
    } catch (e) {
      next(e)
    }
  })

  router.get('/admin/products', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const products = await db.listAllProducts()
      res.json({
        products: products.map((p) => ({
          id: p.id,
          title: p.title,
          stock: p.stock,
          inStock: p.in_stock,
          image: imageUrl(p.image_url, { width: 100 }),
          category: p.category ? p.category.title : null,
        })),
      })
    } catch (e) {
      next(e)
    }
  })

  // Оновлення залишку одного товару
  router.post('/admin/stock', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { id, stock } = req.body || {}
      if (!id) return res.status(400).json({ error: 'missing_id' })
      let value = null
      if (stock !== null && stock !== '' && stock !== undefined && stock !== '-') {
        const n = Number(stock)
        if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'bad_stock' })
        value = Math.floor(n)
      }
      const beforeStock = await db.getProductStock(id)
      await db.updateProductField(id, 'stock', value)
      res.json({ ok: true, id, stock: value })
      if (beforeStock && beforeStock.stock != null && beforeStock.stock <= 0 && value != null && value > 0) {
        const notifyFn = req.app.locals.notifyRestock
        if (notifyFn) notifyFn({ productId: Number(id) }).catch(() => {})
      }
    } catch (e) {
      next(e)
    }
  })

  // ===== Адмін: повний товар =====
  router.get('/admin/product/:id', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const p = await db.getProductAdmin(Number(req.params.id))
      if (!p) return res.status(404).json({ error: 'not_found' })
      const cats = await db.listAllCategories()
      res.json({ product: p, categories: cats })
    } catch (e) { next(e) }
  })

  // ===== Адмін: створити товар =====
  router.post('/admin/product', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { title, price, cost_price, sale_price, stock, description, full_description,
        category_id, weight_g, barcode, units_per_pack, rec_markup,
        proteins, fats, carbs, calories, country_of_origin, shelf_life,
        flavors, packs } = req.body || {}
      if (!title || price == null) return res.status(400).json({ error: 'missing_fields' })
      const nn = (v) => (v === '' || v == null ? null : Number(v))
      const product = await db.createProduct({
        title, price: Number(price),
        cost_price: nn(cost_price),
        sale_price: nn(sale_price),
        stock: nn(stock),
        description: description || null,
        full_description: full_description || null,
        category_id: category_id ? Number(category_id) : null,
        weight_g: nn(weight_g),
        barcode: barcode || null,
        units_per_pack: nn(units_per_pack),
        rec_markup: nn(rec_markup),
        proteins: nn(proteins),
        fats: nn(fats),
        carbs: nn(carbs),
        calories: nn(calories),
        country_of_origin: country_of_origin || null,
        shelf_life: shelf_life || null,
        flavors: (Array.isArray(flavors) && flavors.length) ? flavors : null,
        packs: (Array.isArray(packs) && packs.length) ? packs : null,
      })
      res.json({ product })
    } catch (e) { next(e) }
  })

  // ===== Адмін: оновити товар =====
  router.put('/admin/product/:id', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const id = Number(req.params.id)
      const numFields = ['price', 'cost_price', 'sale_price', 'stock', 'category_id', 'proteins', 'fats', 'carbs', 'calories', 'weight_g', 'units_per_pack', 'rec_markup']
      const jsonFields = ['flavors', 'packs']
      const allowed = ['title', 'description', 'full_description', 'in_stock', 'country_of_origin', 'shelf_life', 'barcode', ...numFields, ...jsonFields]
      for (const [key, val] of Object.entries(req.body || {})) {
        if (!allowed.includes(key)) continue
        let v
        if (numFields.includes(key)) {
          v = (val === '' || val == null) ? null : Number(val)
        } else if (jsonFields.includes(key)) {
          v = (val == null || (Array.isArray(val) && val.length === 0)) ? null : val
        } else {
          v = val
        }
        await db.updateProductField(id, key, v)
      }
      const updated = await db.getProductAdmin(id)
      res.json({ product: updated })
    } catch (e) { next(e) }
  })

  // ===== Адмін: видалити товар =====
  router.delete('/admin/product/:id', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      await db.deleteProduct(Number(req.params.id))
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  // ===== Адмін: категорії =====
  router.get('/admin/categories-list', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const cats = await db.listAllCategories()
      res.json({ categories: cats })
    } catch (e) { next(e) }
  })
  router.post('/admin/category', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { title, emoji } = req.body || {}
      if (!title) return res.status(400).json({ error: 'missing_title' })
      const cat = await db.createCategory({ title, emoji: emoji || '🍬' })
      res.json({ category: cat })
    } catch (e) { next(e) }
  })
  router.delete('/admin/category/:id', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      await db.deleteCategory(Number(req.params.id))
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  // ===== Адмін: список замовлень =====
  router.get('/admin/orders-list', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const orders = await db.listAdminOrders()
      res.json({ orders })
    } catch (e) { next(e) }
  })
  router.post('/admin/order/:id/status', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { status } = req.body || {}
      if (!status) return res.status(400).json({ error: 'missing_status' })
      await db.updateOrderStatus(Number(req.params.id), status)
      res.json({ ok: true })
    } catch (e) { next(e) }
  })


  // ===== Адмін: upload фото =====
  router.post('/admin/upload-image', express.raw({ type: '*/*', limit: '25mb' }), async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { productId, isMain } = req.query
      const { v2: cld } = await import('cloudinary')
      const publicId = await new Promise((resolve, reject) => {
        const st = cld.uploader.upload_stream(
          { folder: 'candy-shop' },
          (err, r) => err ? reject(err) : resolve(r.public_id)
        )
        st.end(req.body)
      })
      if (productId) {
        const pid = Number(productId)
        if (isMain === '1') await db.updateProductField(pid, 'image_url', publicId)
        else await db.addProductImage(pid, publicId)
      }
      res.json({ publicId })
    } catch (e) { next(e) }
  })

  // ===== Адмін: upload відео =====
  router.post('/admin/upload-video', express.raw({ type: '*/*', limit: '100mb' }), async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const { productId } = req.query
      const { v2: cld } = await import('cloudinary')
      const publicId = await new Promise((resolve, reject) => {
        const st = cld.uploader.upload_stream(
          { folder: 'candy-shop', resource_type: 'video' },
          (err, r) => err ? reject(err) : resolve(r.public_id)
        )
        st.end(req.body)
      })
      if (productId) await db.updateProductField(Number(productId), 'video_url', publicId)
      res.json({ publicId })
    } catch (e) { next(e) }
  })

  // ===== Адмін: видалити всі медіа =====
  router.delete('/admin/product/:id/clear-media', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      await db.clearProductMedia(Number(req.params.id))
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  // Обробник помилок API
  router.use((err, _req, res, _next) => {
    console.error('API error:', err)
    res.status(500).json({ error: 'server_error' })
  })

  // ===== Відгуки =====
  router.post('/review', async (req, res, next) => {
    try {
      const { productId, rating, text } = req.body || {}
      const r = Number(rating)
      if (!productId || r < 1 || r > 5) return res.status(400).json({ error: 'bad_input' })
      const purchased = await db.getPurchasedProductIds(req.tgId)
      if (!purchased.includes(Number(productId))) return res.status(403).json({ error: 'not_purchased' })
      await db.addReview(req.tgId, Number(productId), r, text || null)
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  router.get('/reviews/:productId', async (req, res, next) => {
    try {
      const data = await db.getProductReviews(req.tgId, Number(req.params.productId))
      res.json(data)
    } catch (e) { next(e) }
  })

  // ===== Часто беруть =====
  router.get('/product/:id/also-bought', async (req, res, next) => {
    try {
      const products = await db.getFrequentlyBoughtWith(Number(req.params.id))
      res.json({ products: products.map((p) => toClientProduct(p)) })
    } catch (e) { next(e) }
  })

  // ===== Адмін: аналітика =====
  router.get('/admin/analytics', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const [day, week, month, orderStats, topProducts] = await Promise.all([
        db.getEarnings('day'),
        db.getEarnings('week'),
        db.getEarnings('month'),
        db.getOrderStats(),
        db.getTopProducts(10),
      ])
      res.json({ day, week, month, orderStats, topProducts })
    } catch (e) { next(e) }
  })

  // ===== Адмін: скидання аналітики =====
  router.post('/admin/reset-analytics', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      await db.resetAnalytics()
      res.json({ ok: true })
    } catch (e) { next(e) }
  })

  // ===== Адмін: CSV експорт =====
  router.get('/admin/export-csv', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const products = await db.getProductsForCsv()
      const cols = ['id', 'title', 'description', 'price', 'sale_price', 'cost_price', 'stock', 'weight_g', 'units_per_pack', 'barcode', 'proteins', 'fats', 'carbs', 'calories', 'country_of_origin', 'shelf_life', 'in_stock']
      const csvEsc = (v) => v == null ? '' : '"' + String(v).replace(/"/g, '""') + '"'
      const lines = [cols.join(','), ...products.map((p) => cols.map((c) => csvEsc(p[c])).join(','))]
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="wowsmak-products.csv"')
      res.send('﻿' + lines.join('\n'))
    } catch (e) { next(e) }
  })

  // ===== Адмін: CSV імпорт =====
  router.post('/admin/import-csv', async (req, res, next) => {
    try {
      if (!isAdminReq(req)) return res.status(403).json({ error: 'forbidden' })
      const rows = req.body && req.body.rows
      if (!Array.isArray(rows)) return res.status(400).json({ error: 'bad_input' })
      const results = await db.importProductsFromCsv(rows)
      res.json({ ok: true, results })
    } catch (e) { next(e) }
  })

  return router
}

// Позиція кошика для фронтенду
function toClientCartItem(i) {
  const p = i.product
  const base = p.sale_price != null ? Number(p.sale_price) : Number(p.price)
  const unit = i.pack_price != null ? Number(i.pack_price) : base
  return {
    productId: p.id,
    title: p.title,
    packLabel: i.pack_label || null,
    image: imageUrl(p.image_url, { width: 300 }),
    price: Number(p.price),
    salePrice: i.pack_price != null ? null : p.sale_price != null ? Number(p.sale_price) : null,
    unitPrice: unit,
    qty: i.qty,
    stock: p.stock,
    lineTotal: unit * i.qty,
  }
}

function buildCart(cart) {
  const items = cart.map(toClientCartItem)
  const total = items.reduce((s, i) => s + i.lineTotal, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  return { items, total, count }
}
