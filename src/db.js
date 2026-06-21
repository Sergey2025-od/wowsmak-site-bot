import { createClient } from '@supabase/supabase-js'
import { config } from './config.js'

// service_role ключ обходить RLS — використовуємо лише на сервері.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
})

const PRODUCT_FIELDS = 'id, category_id, title, description, full_description, price, sale_price, stock, weight_g, units_per_pack, flavors, packs, image_url, images, video_url, in_stock, sort_order, created_at, proteins, fats, carbs, calories, country_of_origin, shelf_life'
// Поля для адміна: додатково ціна закупівлі та штрих-код (на вітрині не показуємо)
const ADMIN_PRODUCT_FIELDS = `${PRODUCT_FIELDS}, cost_price, barcode, rec_markup`

// ---------- Категорії ----------
export async function getCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data
}

// ---------- Категорії (адмін) ----------
export async function listAllCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order')
  if (error) throw error
  return data
}

export async function getCategory(id) {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createCategory({ title, emoji = '🍬', image_url = null }) {
  const { data: last } = await supabase
    .from('categories')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const sort_order = (last?.sort_order ?? 0) + 1
  const { data, error } = await supabase
    .from('categories')
    .insert({ title, emoji, image_url, sort_order, is_active: true })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategoryField(id, field, value) {
  const allowed = ['title', 'emoji', 'image_url', 'sort_order', 'is_active']
  if (!allowed.includes(field)) throw new Error(`Не можна редагувати поле ${field}`)
  const { error } = await supabase
    .from('categories')
    .update({ [field]: value })
    .eq('id', id)
  if (error) throw error
}

export async function deleteCategory(id) {
  // Товари залишаються: category_id стане NULL (on delete set null)
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

// ---------- Товари (вітрина) ----------
export async function getProductsByCategory(categoryId) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('category_id', categoryId)
    .eq('in_stock', true)
    .order('sort_order')
  if (error) throw error
  // Показуємо всі товари вітрини, включно з тими, що немає в наявності (сірі в UI)
  return data
}

export async function getProduct(productId) {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_FIELDS)
    .eq('id', productId)
    .single()
  if (error) throw error
  return data
}

// ---------- Кошик ----------
export async function addToCart(tgId, productId, qty = 1, pack = null) {
  const { data: existing } = await supabase
    .from('cart_items')
    .select('id, qty')
    .eq('tg_id', tgId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existing) {
    const patch = { qty: existing.qty + qty }
    if (pack) {
      patch.pack_label = pack.label
      patch.pack_price = pack.price
    }
    const { error } = await supabase
      .from('cart_items')
      .update(patch)
      .eq('id', existing.id)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('cart_items')
      .insert({
        tg_id: tgId,
        product_id: productId,
        qty,
        pack_label: pack ? pack.label : null,
        pack_price: pack ? pack.price : null,
      })
    if (error) throw error
  }
}

export async function getCart(tgId) {
  const { data, error } = await supabase
    .from('cart_items')
    .select('id, qty, pack_label, pack_price, product:products(id, title, price, sale_price, stock, image_url, cost_price)')
    .eq('tg_id', tgId)
  if (error) throw error
  return data
}

export async function setCartQty(tgId, productId, qty) {
  if (qty <= 0) return removeFromCart(tgId, productId)
  const { error } = await supabase
    .from('cart_items')
    .update({ qty })
    .eq('tg_id', tgId)
    .eq('product_id', productId)
  if (error) throw error
}

export async function removeFromCart(tgId, productId) {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('tg_id', tgId)
    .eq('product_id', productId)
  if (error) throw error
}

export async function clearCart(tgId) {
  const { error } = await supabase.from('cart_items').delete().eq('tg_id', tgId)
  if (error) throw error
}

// ---------- Клієнти ----------
export async function upsertCustomer({ tgId, username, fullName, phone, fop, address }) {
  // Оновлюємо лише передані поля, щоб не затерти існуючі дані (напр. fop).
  const row = { tg_id: tgId }
  if (username !== undefined) row.username = username
  if (fullName !== undefined) row.full_name = fullName
  if (phone !== undefined) row.phone = phone
  if (fop !== undefined) row.fop = fop
  if (address !== undefined) row.address = address
  const { error } = await supabase
    .from('customers')
    .upsert(row, { onConflict: 'tg_id' })
  if (error) throw error
}

export async function getAllCustomerIds() {
  const { data, error } = await supabase.from('customers').select('tg_id')
  if (error) throw error
  return data.map((c) => c.tg_id)
}

// ---------- Замовлення ----------
export async function createOrder(tgId, contact) {
  const cart = await getCart(tgId)
  if (!cart.length) throw new Error('Кошик порожній')

  const unitPrice = (i) =>
    i.pack_price != null
      ? Number(i.pack_price)
      : i.product.sale_price != null
        ? Number(i.product.sale_price)
        : Number(i.product.price)
  const total = cart.reduce((s, i) => s + unitPrice(i) * i.qty, 0)

  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      tg_id: tgId,
      total,
      full_name: contact.fullName,
      phone: contact.phone,
      fop: contact.fop || null,
      address: contact.address,
      comment: contact.comment || null,
      status: 'new',
    })
    .select()
    .single()
  if (error) throw error

  // Зберігаємо контактні дані клієнта для автозаповнення наступного разу
  try {
    await upsertCustomer({
      tgId,
      fullName: contact.fullName,
      phone: contact.phone,
      fop: contact.fop,
      address: contact.addressParts ?? undefined,
    })
  } catch (e) {
    console.error('upsertCustomer (order):', e.message)
  }

  const items = cart.map((i) => ({
    order_id: order.id,
    product_id: i.product.id,
    title: i.pack_label ? `${i.product.title} — ${i.pack_label}` : i.product.title,
    price: unitPrice(i),
    qty: i.qty,
    cost_price: i.product.cost_price != null ? Number(i.product.cost_price) : null,
  }))
  const { error: itemsError } = await supabase.from('order_items').insert(items)
  if (itemsError) throw itemsError

  // Списуємо залишки + збираємо товари, що закінчились (=0) або закінчуються (<3 шт)
  const stockOut = []
  const stockLow = []
  for (const i of cart) {
    if (i.product.stock != null) {
      const next = Math.max(0, i.product.stock - i.qty)
      await supabase.from('products').update({ stock: next }).eq('id', i.product.id)
      if (next === 0) stockOut.push({ id: i.product.id, title: i.product.title })
      else if (next < 3) stockLow.push({ id: i.product.id, title: i.product.title, stock: next })
    }
  }

  await clearCart(tgId)
  return { order, items, total, stockOut, stockLow }
}

// =====================================================
//                   АДМІНСЬКІ ФУНКЦІЇ
// =====================================================

export async function listAllProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`${ADMIN_PRODUCT_FIELDS}, category:categories(id, title)`)
    .order('category_id')
    .order('sort_order')
  if (error) throw error
  return data
}

// Деталі товарів за списком id (для накладної: штрих-код, залишок, фото)
export async function getProductsByIds(ids) {
  if (!ids || !ids.length) return {}
  const { data, error } = await supabase
    .from('products')
    .select('id, title, barcode, stock, image_url')
    .in('id', ids)
  if (error) throw error
  const map = {}
  for (const p of data) map[p.id] = p
  return map
}

export async function getProductAdmin(productId) {
  const { data, error } = await supabase
    .from('products')
    .select(`${ADMIN_PRODUCT_FIELDS}, category:categories(id, title)`)
    .eq('id', productId)
    .single()
  if (error) throw error
  return data
}

export async function createProduct(fields) {
  const { data, error } = await supabase
    .from('products')
    .insert({
      category_id: fields.category_id,
      title: fields.title,
      description: fields.description ?? null,
      full_description: fields.full_description ?? null,
      cost_price: fields.cost_price ?? null,
      price: fields.price,
      sale_price: fields.sale_price ?? null,
      stock: fields.stock ?? null,
      weight_g: fields.weight_g ?? null,
      units_per_pack: fields.units_per_pack ?? null,
      rec_markup: fields.rec_markup ?? null,
      barcode: fields.barcode ?? null,
      flavors: fields.flavors ?? null,
      packs: fields.packs ?? null,
      in_stock: true,
      proteins: fields.proteins ?? null,
      fats: fields.fats ?? null,
      carbs: fields.carbs ?? null,
      calories: fields.calories ?? null,
      country_of_origin: fields.country_of_origin ?? null,
      shelf_life: fields.shelf_life ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateProductField(productId, field, value) {
  const allowed = ['title', 'description', 'cost_price', 'price', 'sale_price', 'stock', 'weight_g', 'units_per_pack', 'rec_markup', 'barcode', 'flavors', 'packs', 'image_url', 'images', 'video_url', 'in_stock', 'category_id', 'proteins', 'fats', 'carbs', 'calories', 'country_of_origin', 'shelf_life', 'full_description']
  if (!allowed.includes(field)) throw new Error(`Не можна редагувати поле ${field}`)
  const { error } = await supabase
    .from('products')
    .update({ [field]: value })
    .eq('id', productId)
  if (error) throw error
}

// === Підписки на повернення товару в наявність (restock) ===
export async function addRestockSub(tgId, productId) {
  const { error } = await supabase
    .from('restock_subs')
    .upsert({ tg_id: tgId, product_id: productId }, { onConflict: 'tg_id,product_id' })
  if (error) throw error
}

export async function removeRestockSub(tgId, productId) {
  const { error } = await supabase
    .from('restock_subs')
    .delete()
    .eq('tg_id', tgId)
    .eq('product_id', productId)
  if (error) throw error
}

export async function getRestockSubscribers(productId) {
  const { data, error } = await supabase
    .from('restock_subs')
    .select('tg_id')
    .eq('product_id', productId)
  if (error) throw error
  return data.map((r) => r.tg_id)
}

export async function clearRestockSubs(productId) {
  const { error } = await supabase
    .from('restock_subs')
    .delete()
    .eq('product_id', productId)
  if (error) throw error
}

export async function getProductStock(productId) {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, stock')
    .eq('id', productId)
    .single()
  if (error) throw error
  return data
}

// Додає фото товару: перше стає головним (image_url), решта — у галерею images.
export async function addProductImage(productId, publicId) {
  const { data, error } = await supabase
    .from('products')
    .select('image_url, images')
    .eq('id', productId)
    .single()
  if (error) throw error
  if (!data.image_url) {
    await updateProductField(productId, 'image_url', publicId)
    return 1
  }
  const images = Array.isArray(data.images) ? data.images.slice() : []
  images.push(publicId)
  await updateProductField(productId, 'images', images)
  return images.length + 1
}

// Прибирає всі медіа товару (головне фото, галерею та відео).
export async function clearProductMedia(productId) {
  const { error } = await supabase
    .from('products')
    .update({ image_url: null, images: [], video_url: null })
    .eq('id', productId)
  if (error) throw error
}

export async function deleteProduct(productId) {
  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) throw error
}

// ---------- Повідомлення / зв’язок з клієнтом ----------
export async function logMessage({ tgId, direction, text, adminId = null }) {
  const { error } = await supabase
    .from('messages')
    .insert({ tg_id: tgId, direction, text, admin_id: adminId })
  if (error) console.error('logMessage:', error.message)
}

// =====================================================
//            ЗАПИТИ ДЛЯ MINI APP
// =====================================================

// Усі доступні товари вітрини (з категорією)
export async function getShopProducts() {
  const { data, error } = await supabase
    .from('products')
    .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
    .eq('in_stock', true)
    .order('sort_order')
  if (error) throw error
  return data
}

// Сумарна кількість замовлених одиниць по кожному товару (для блоку «Хіти продажів»)
export async function getProductOrderCounts() {
  // exclude archived orders from counts
  const { data: activeOrders } = await supabase
    .from('orders')
    .select('id')
    .neq('status', 'archived')
    .neq('status', 'cancelled')
  const activeIds = (activeOrders || []).map((o) => o.id)
  if (!activeIds.length) return {}
  const { data, error } = await supabase
    .from('order_items')
    .select('product_id, qty')
    .in('order_id', activeIds)
  if (error) throw error
  const map = {}
  for (const r of data || []) {
    if (r.product_id == null) continue
    map[r.product_id] = (map[r.product_id] || 0) + Number(r.qty || 0)
  }
  return map
}

// Профіль клієнта
export async function getCustomer(tgId) {
  const { data, error } = await supabase
    .from('customers')
    .select('tg_id, username, full_name, phone, fop, address, created_at')
    .eq('tg_id', tgId)
    .maybeSingle()
  if (error) throw error
  return data
}

// Список замовлень клієнта
export async function getOrders(tgId, limit = 30) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, full_name, phone, fop, address, comment, created_at')
    .eq('tg_id', tgId)
    .eq('hidden_for_customer', false)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}

// Позиції замовлення (з перевіркою власника)
// Приховати всю історію замовлень клієнта (нак��адні зникають з його кабінету)
export async function hideCustomerOrders(tgId) {
  const { error } = await supabase
    .from('orders')
    .update({ hidden_for_customer: true })
    .eq('tg_id', tgId)
    .eq('hidden_for_customer', false)
  if (error) throw error
  return true
}

// ID товарів, які клієнт уже купував (по видимій історії замовлень)
export async function getPurchasedProductIds(tgId) {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id')
    .eq('tg_id', tgId)
    .eq('hidden_for_customer', false)
  if (error) throw error
  const orderIds = (orders || []).map((o) => o.id)
  if (!orderIds.length) return []
  const { data: items, error: itErr } = await supabase
    .from('order_items')
    .select('product_id')
    .in('order_id', orderIds)
  if (itErr) throw itErr
  const ids = new Set()
  for (const it of items || []) {
    if (it.product_id != null) ids.add(it.product_id)
  }
  return [...ids]
}

export async function getOrderWithItems(tgId, orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, total, full_name, phone, fop, address, comment, created_at, tg_id')
    .eq('id', orderId)
    .eq('tg_id', tgId)
    .maybeSingle()
  if (error) throw error
  if (!order) return null
  const { data: items, error: itErr } = await supabase
    .from('order_items')
    .select('id, title, price, qty')
    .eq('order_id', orderId)
  if (itErr) throw itErr
  return { ...order, items: items || [] }
}

// Замовлення + позиції для накладної (без перевірки власника — для адміна)
export async function getOrderForInvoice(orderId) {
  const { data: order, error } = await supabase
    .from('orders')
    .select('id, status, total, full_name, phone, fop, address, comment, created_at, tg_id')
    .eq('id', orderId)
    .maybeSingle()
  if (error) throw error
  if (!order) return null
  const { data: items, error: itErr } = await supabase
    .from('order_items')
    .select('id, product_id, title, price, qty')
    .eq('order_id', orderId)
  if (itErr) throw itErr
  return { order, items: items || [], total: Number(order.total) }
}

// Оновлення статусу замовлення
export async function updateOrderStatus(orderId, status) {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId)
  if (error) throw error
}

// ---------- Звіт прибутку (для адміна) ----------
// period: 'day' | 'week' | 'month'
// Прибуток = (ціна продажу − ціна закупівлі) × кількість.
// Товари без ціни закупівлі не враховуються в прибутку (позначаються «—»).
export async function getEarnings(period = 'day') {
  const now = new Date()
  let from
  if (period === 'week') {
    from = new Date(now)
    from.setDate(now.getDate() - 6)
    from.setHours(0, 0, 0, 0)
  } else if (period === 'month') {
    from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  } else {
    from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  }

  // Замовлення за період (без скасованих)
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('id, total, status, created_at')
    .gte('created_at', from.toISOString())
    .neq('status', 'cancelled')
    .neq('status', 'archived')
  if (oErr) throw oErr

  const orderIds = (orders || []).map((o) => o.id)
  if (!orderIds.length) {
    return { period, from: from.toISOString(), ordersCount: 0, revenue: 0, profit: 0, items: [] }
  }

  // Позиції цих замовлень
  const { data: rows, error: iErr } = await supabase
    .from('order_items')
    .select('product_id, title, price, qty, cost_price')
    .in('order_id', orderIds)
  if (iErr) throw iErr

  // Для старих позицій без знімку закупівлі — беремо актуальну ціну товару
  const needCost = [...new Set((rows || []).filter((r) => r.cost_price == null && r.product_id != null).map((r) => r.product_id))]
  const costMap = {}
  if (needCost.length) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, cost_price')
      .in('id', needCost)
    for (const p of prods || []) costMap[p.id] = p.cost_price
  }

  // Агрегація по товару
  const byProduct = new Map()
  let revenue = 0
  let profit = 0
  for (const r of rows || []) {
    const qty = Number(r.qty || 0)
    const sell = Number(r.price || 0)
    revenue += sell * qty
    const cost = r.cost_price != null
      ? Number(r.cost_price)
      : (costMap[r.product_id] != null ? Number(costMap[r.product_id]) : null)
    const key = r.product_id != null ? `p${r.product_id}` : `t:${r.title}`
    let agg = byProduct.get(key)
    if (!agg) {
      agg = { title: r.title, qty: 0, sell, cost, revenue: 0, profit: 0, hasCost: cost != null }
      byProduct.set(key, agg)
    }
    agg.qty += qty
    agg.revenue += sell * qty
    if (cost != null) {
      const p = (sell - cost) * qty
      agg.profit += p
      profit += p
    } else {
      agg.hasCost = false
    }
  }

  const items = [...byProduct.values()].sort((a, b) => b.profit - a.profit)
  return { period, from: from.toISOString(), ordersCount: orders.length, revenue, profit, items }
}

// =====================================================
//            BATCH 4: відгуки, аналітика, часто беруть, CSV
// =====================================================

export async function addReview(tgId, productId, rating, text) {
  const { error } = await supabase
    .from('reviews')
    .upsert({ tg_id: tgId, product_id: productId, rating, text: text || null }, { onConflict: 'tg_id,product_id' })
  if (error) throw error
}

export async function getProductReviews(tgId, productId) {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, tg_id, rating, text, created_at, customer:customers(full_name, username)')
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (error) throw error
  const avg = data.length ? data.reduce((s, r) => s + r.rating, 0) / data.length : null
  return {
    reviews: data.map((r) => ({
      rating: r.rating,
      text: r.text,
      name: r.customer?.full_name || r.customer?.username || null,
      isMine: r.tg_id === tgId,
      createdAt: r.created_at,
    })),
    avg,
    count: data.length,
  }
}

export async function getOrderStats() {
  const { data, error } = await supabase
    .from('orders')
    .select('status')
    .neq('status', 'archived')
  if (error) throw error
  const counts = { new: 0, confirmed: 0, shipped: 0, done: 0, cancelled: 0 }
  for (const r of data || []) {
    if (r.status in counts) counts[r.status]++
  }
  return counts
}

export async function getTopProducts(limit = 10) {
  const counts = await getProductOrderCounts()
  const sorted = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
  if (!sorted.length) return []
  const topIds = sorted.map(([id]) => Number(id))
  const { data } = await supabase.from('products').select('id, title, price').in('id', topIds)
  const prodMap = {}
  for (const p of data || []) prodMap[p.id] = p
  return topIds.map((id) => ({ ...(prodMap[id] || { id, title: '?' }), orders: counts[id] || 0 }))
}

export async function getFrequentlyBoughtWith(productId, limit = 4) {
  const { data: myOrders } = await supabase
    .from('order_items')
    .select('order_id')
    .eq('product_id', productId)
    .limit(60)
  if (!myOrders || !myOrders.length) return []
  const orderIds = myOrders.map((r) => r.order_id)
  const { data: items } = await supabase
    .from('order_items')
    .select('product_id')
    .in('order_id', orderIds)
    .neq('product_id', productId)
    .not('product_id', 'is', null)
  if (!items || !items.length) return []
  const counts = {}
  for (const r of items) counts[r.product_id] = (counts[r.product_id] || 0) + 1
  const topIds = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => Number(id))
  if (!topIds.length) return []
  const { data: prods } = await supabase
    .from('products')
    .select(`${PRODUCT_FIELDS}, category:categories(id, title, emoji)`)
    .in('id', topIds)
    .eq('in_stock', true)
  return prods || []
}

export async function getProductsForCsv() {
  const { data, error } = await supabase
    .from('products')
    .select('id, title, description, price, sale_price, cost_price, stock, weight_g, units_per_pack, barcode, in_stock')
    .order('sort_order')
  if (error) throw error
  return data || []
}

export async function importProductsFromCsv(rows) {
  const results = []
  for (const row of rows) {
    if (!row.id || isNaN(Number(row.id))) continue
    const patch = {}
    if (row.stock !== undefined && row.stock !== '') patch.stock = row.stock === '-' ? null : Number(row.stock)
    if (row.price !== undefined && row.price !== '') { const n = Number(row.price); if (n >= 0) patch.price = n }
    if (row.sale_price !== undefined && row.sale_price !== '') patch.sale_price = (row.sale_price === '-' || row.sale_price === '0') ? null : Number(row.sale_price)
    if (row.in_stock !== undefined && row.in_stock !== '') patch.in_stock = row.in_stock === 'true' || row.in_stock === '1'
    if (!Object.keys(patch).length) continue
    const { error } = await supabase.from('products').update(patch).eq('id', Number(row.id))
    results.push({ id: Number(row.id), ok: !error, error: error?.message })
  }
  return results
}

export async function resetAnalytics() {
  // Архівуємо всі замовлення (окрім вже архівних і скасованих)
  const { error } = await supabase
    .from('orders')
    .update({ status: 'archived' })
    .neq('status', 'archived')
    .neq('status', 'cancelled')
  if (error) throw error
  return { ok: true }
}

export async function listAdminOrders(limit = 60) {
  const { data, error } = await supabase
    .from('orders')
    .select('id, status, total, full_name, phone, address, created_at, tg_id')
    .not('status', 'eq', 'archived')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data || []
}
