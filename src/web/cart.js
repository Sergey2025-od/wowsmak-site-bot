// ============================================================
//  Кошик для сайту — зберігається в cookie (анонімно, без Telegram).
//  Формат cookie wow_cart: [{ id, qty, pack }]
// ============================================================
import { parseCookies } from './util.js'

const COOKIE = 'wow_cart'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 днів
const MAX_ITEMS = 50
const MAX_QTY = 99

// Читаємо кошик з cookie -> [{ id, qty, pack }]
export function readCart(req) {
  const raw = parseCookies(req)[COOKIE]
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (!Array.isArray(arr)) return []
    return arr
      .map((i) => ({
        id: Number(i.id),
        qty: Math.min(MAX_QTY, Math.max(1, Number(i.qty) || 1)),
        pack: i.pack ? String(i.pack) : null,
      }))
      .filter((i) => Number.isFinite(i.id) && i.id > 0)
      .slice(0, MAX_ITEMS)
  } catch {
    return []
  }
}

// Записуємо кошик у cookie
export function writeCart(res, cart) {
  const value = encodeURIComponent(JSON.stringify(cart))
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly`)
}

export function clearCart(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`)
}

// Операції над кошиком (чисті функції)
export function addItem(cart, id, qty = 1, pack = null) {
  id = Number(id)
  qty = Math.max(1, Number(qty) || 1)
  const existing = cart.find((i) => i.id === id && (i.pack || null) === (pack || null))
  if (existing) {
    existing.qty = Math.min(MAX_QTY, existing.qty + qty)
  } else if (cart.length < MAX_ITEMS) {
    cart.push({ id, qty: Math.min(MAX_QTY, qty), pack: pack || null })
  }
  return cart
}

export function setQty(cart, id, qty, pack = null) {
  id = Number(id)
  qty = Number(qty) || 0
  const idx = cart.findIndex((i) => i.id === id && (i.pack || null) === (pack || null))
  if (idx === -1) return cart
  if (qty <= 0) cart.splice(idx, 1)
  else cart[idx].qty = Math.min(MAX_QTY, qty)
  return cart
}

export function removeItem(cart, id, pack = null) {
  id = Number(id)
  return cart.filter((i) => !(i.id === id && (i.pack || null) === (pack || null)))
}

export function cartCount(cart) {
  return cart.reduce((s, i) => s + i.qty, 0)
}
