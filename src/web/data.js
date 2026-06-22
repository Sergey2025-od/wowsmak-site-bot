// ============================================================
//  Дані для сайту — та сама база Supabase і ті самі медіа Cloudinary,
//  що й бот/Mini App. Ніякої дублюючої БД.
// ============================================================
import { supabase, upsertCustomer } from '../db.js'
import { imageUrl, videoUrl } from '../cloudinary.js'
import { parsePacks, flavorList } from '../format.js'
import { productPath } from './util.js'

const PRODUCT_FIELDS =
  'id, category_id, title, description, full_description, price, sale_price, stock, weight_g, units_per_pack, flavors, packs, image_url, images, video_url, in_stock, sort_order, created_at, proteins, fats, carbs, calories, country_of_origin, shelf_life'

const effectivePrice = (p) => (p.sale_price != null ? Number(p.sale_price) : Number(p.price))

// Приводимо товар до вигляду для сайту (готові абсолютні URL медіа)
export function toClientProduct(p, orderCount = 0) {
  const priceVal = Number(p.price)
  const sale = p.sale_price != null ? Number(p.sale_price) : null
  const discount = sale != null && priceVal > 0 ? Math.round((1 - sale / priceVal) * 100) : null
  const gallery = [p.image_url, ...(Array.isArray(p.images) ? p.images : [])].filter(Boolean)
  const available = p.in_stock !== false && (p.stock == null || p.stock > 0)
  const obj = {
    id: p.id,
    title: p.title,
    description: p.description || '',
    fullDescription: p.full_description || null,
    price: priceVal,
    salePrice: sale,
    discount,
    effectivePrice: effectivePrice(p),
    stock: p.stock,
    available,
    weightG: p.weight_g ?? null,
    unitsPerPack: p.units_per_pack && p.units_per_pack > 0 ? p.units_per_pack : null,
    flavors: flavorList(p),
    packs: parsePacks(p),
    image: imageUrl(p.image_url, { width: 800 }),
    imageLarge: imageUrl(p.image_url, { width: 1200 }),
    images: gallery.map((ref) => imageUrl(ref, { width: 1000 })),
    video: videoUrl(p.video_url),
    categoryId: p.category_id,
    category: p.category ? { id: p.category.id, title: p.category.title, emoji: p.category.emoji } : null,
    createdAt: p.created_at || null,
    orderCount,
    proteins: p.proteins ?? null,
    fats: p.fats ?? null,
    carbs: p.carbs ?? null,
    calories: p.calories ?? null,
    countryOfOrigin: p.country_of_origin ?? null,
    shelfLife: p.shelf_life ?? null,
  }
  obj.path = productPath(obj)
  return obj
}

export function toClientCategory(c) {
  return {
    id: c.id,
    title: c.title,
    emoji: c.emoji || '🍬',
    image: c.image_url ? imageUrl(c.image_url, { width: 600, crop: 'fit', format: 'png' }) : null,
  }
}

export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return (data || []).map(toClientCategory)
}

async function getProductOrderCounts() {
  try {
    const { data: activeOrders } = await supabase
      .from('orders')
      .select('id')
      .neq('status', 'archived')
      .neq('status', 'cancelled')
    const activeIds = (activeOrders || []).map((o) => o.id)
    if (!activeIds.length) return {}
    const { data } = await supabase.from('order_items').select('product_id, qty').in('order_id', activeIds)
    const map = {}
    for (const r of data || []) {
      if (r.product_id == null) continue
      map[r.product_id] = (map[r.product_id] || 0) + Number(r.qty || 0)
    }
    return map
  } catch {
    return {}
  }
}

// Усі товари вітрини (з категорією)
export async function getShopProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
    .eq('in_stock', true)
    .order('sort_order')
  if (error) throw error
  const counts = await getProductOrderCounts()
  return (data || []).map((p) => toClientProduct(p, counts[p.id] || 0))
}

export async function getProductById(id) {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const counts = await getProductOrderCounts()
  return toClientProduct(data, counts[data.id] || 0)
}

// Лічильник переглядів товару: інкремент + повернення нового значення (RPC).
// Якщо міграція ще не виконана — тихо повертає null (лічильник просто не показується).
export async function incrementProductViews(id) {
  try {
    const { data, error } = await supabase.rpc('increment_product_views', { pid: Number(id) })
    if (error) throw error
    const v = Number(data)
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

// Приховані SEO-ключові слова товару (для мета-тегів). Стійко до відсутності колонки.
export async function getProductKeywords(id) {
  try {
    const { data, error } = await supabase.from('products').select('keywords').eq('id', id).maybeSingle()
    if (error) throw error
    return data && data.keywords ? data.keywords : null
  } catch {
    return null
  }
}

// Банери для головної (стійко до відсутності таблиці)
export async function getBanners() {
  try {
    const { data, error } = await supabase
      .from('banners')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data || []).map((b) => ({
      id: b.id,
      badge: b.badge || '',
      title: b.title || '',
      subtitle: b.subtitle || '',
      buttonText: b.button_text || '',
      buttonLink: b.button_link || '',
      bgColor: b.bg_color || '',
      image: b.image_url ? imageUrl(b.image_url, { width: 900, crop: 'fit', format: 'png' }) : null,
    }))
  } catch {
    return []
  }
}

export async function getBrands() {
  try {
    const { data, error } = await supabase
      .from('brands')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (error) throw error
    return (data || []).map((b) => ({
      id: b.id,
      title: b.title || '',
      logo: b.logo_url ? imageUrl(b.logo_url, { width: 240, crop: 'fit', format: 'png' }) : null,
      link: b.link || `/catalog?q=${encodeURIComponent(b.title || '')}`,
    }))
  } catch {
    return []
  }
}

// Дані для головної: категорії, хіти, новинки, акції
export async function getHomeData() {
  const [categories, products, banners, brands] = await Promise.all([getCategories(), getShopProducts(), getBanners(), getBrands()])
  const hits = [...products].sort((a, b) => b.orderCount - a.orderCount).slice(0, 8)
  const novelties = [...products]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 8)
  const sales = products.filter((p) => p.salePrice != null).slice(0, 8)
  return { categories, products, hits, novelties, sales, banners, brands }
}

// Відгуки товару (якщо таблиця існує)
export async function getProductReviews(productId) {
  try {
    const { data, error } = await supabase
      .from('reviews')
      .select('id, rating, text, created_at, customer:customers(full_name, username)')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    const reviews = (data || []).map((r) => ({
      rating: r.rating,
      text: r.text,
      name: r.customer?.full_name || r.customer?.username || 'Покупець',
      createdAt: r.created_at,
    }))
    const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null
    return { reviews, avg, count: reviews.length }
  } catch {
    return { reviews: [], avg: null, count: 0 }
  }
}

// Часто беруть разом (для блоку "Рекомендуємо")
export async function getRelatedProducts(product, limit = 4) {
  try {
    const { data } = await supabase
      .from('products')
      .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
      .eq('in_stock', true)
      .eq('category_id', product.categoryId)
      .neq('id', product.id)
      .limit(limit)
    return (data || []).map((p) => toClientProduct(p))
  } catch {
    return []
  }
}

// =====================================================
//   СТВОРЕННЯ ЗАМОВЛЕННЯ З САЙТУ (гость, без Telegram id)
// =====================================================
export async function createWebOrder({ items, contact, tgId = null, tgUser = null }) {
  if (!Array.isArray(items) || !items.length) throw new Error('empty_cart')
  const ids = [...new Set(items.map((i) => Number(i.productId)).filter(Boolean))]
  const { data: products, error: pErr } = await supabase
    .from('products')
    .select('id, title, price, sale_price, stock, cost_price, packs, in_stock')
    .in('id', ids)
  if (pErr) throw pErr
  const pmap = {}
  for (const p of products || []) pmap[p.id] = p

  const lines = []
  for (const it of items) {
    const p = pmap[Number(it.productId)]
    if (!p) continue
    if (p.stock != null && p.stock <= 0) continue
    let unit = p.sale_price != null ? Number(p.sale_price) : Number(p.price)
    let title = p.title
    const packs = parsePacks(p)
    if (it.packLabel && packs.length) {
      const pk = packs.find((x) => x.label === it.packLabel)
      if (pk && pk.price != null) {
        unit = Number(pk.price)
        title = `${p.title} — ${pk.label}`
      }
    }
    const qty = Math.max(1, Number(it.qty) || 1)
    lines.push({ product: p, title, unit, qty })
  }
  if (!lines.length) throw new Error('empty_cart')
  const total = lines.reduce((s, l) => s + l.unit * l.qty, 0)

  // Якщо клієнт увійшов через Telegram — прив’язуємо замовлення до його tg_id,
  // щоб адмін міг спілкуватися з ним у боті.
  let customerTgId = tgId != null ? Number(tgId) : null
  if (customerTgId) {
    try {
      await upsertCustomer({
        tgId: customerTgId,
        username: tgUser?.username || null,
        fullName: contact.fullName,
        phone: contact.phone,
        address: contact.address,
      })
    } catch (e) {
      console.error('upsertCustomer (web) failed:', e?.message || e)
    }
  }

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tg_id: customerTgId,
      source: 'web',
      status: 'new',
      total,
      full_name: contact.fullName,
      phone: contact.phone,
      address: contact.address,
      comment: contact.comment || null,
      email: contact.email || null,
    })
    .select()
    .single()
  if (error) throw error

  const orderItems = lines.map((l) => ({
    order_id: order.id,
    product_id: l.product.id,
    title: l.title,
    price: l.unit,
    qty: l.qty,
    cost_price: l.product.cost_price != null ? Number(l.product.cost_price) : null,
  }))
  const { error: iErr } = await supabase.from('order_items').insert(orderItems)
  if (iErr) throw iErr

  // Списуємо залишки
  const stockOut = []
  const stockLow = []
  for (const l of lines) {
    if (l.product.stock != null) {
      const next = Math.max(0, l.product.stock - l.qty)
      await supabase.from('products').update({ stock: next }).eq('id', l.product.id)
      if (next === 0) stockOut.push({ id: l.product.id, title: l.product.title })
      else if (next < 3) stockLow.push({ id: l.product.id, title: l.product.title, stock: next })
    }
  }

  return { order, items: orderItems, total, stockOut, stockLow }
}

// =====================================================
//   КОШИК САЙТУ: розгортання cookie-кошика в позиції з цінами
// =====================================================
export async function resolveCart(cookieItems) {
  if (!Array.isArray(cookieItems) || !cookieItems.length) {
    return { items: [], total: 0, count: 0 }
  }
  const ids = [...new Set(cookieItems.map((i) => Number(i.id)).filter(Boolean))]
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
    .in('id', ids)
  if (error) throw error
  const pmap = {}
  for (const p of data || []) pmap[p.id] = toClientProduct(p)
  const items = []
  for (const ci of cookieItems) {
    const p = pmap[Number(ci.id)]
    if (!p) continue
    let unit = p.effectivePrice
    let packLabel = null
    if (ci.pack && p.packs && p.packs.length) {
      const pk = p.packs.find((x) => x.label === ci.pack)
      if (pk && pk.price != null) {
        unit = Number(pk.price)
        packLabel = pk.label
      }
    }
    items.push({
      id: p.id,
      title: p.title,
      path: p.path,
      image: p.image,
      packLabel,
      unitPrice: unit,
      qty: ci.qty,
      lineTotal: unit * ci.qty,
      available: p.available,
      stock: p.stock,
    })
  }
  const total = items.reduce((s, i) => s + i.lineTotal, 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  return { items, total, count }
}
