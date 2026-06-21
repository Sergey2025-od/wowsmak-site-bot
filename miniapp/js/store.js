// Простий глобальний стан без фреймворку.
export const store = {
  user: null,
  shopName: '🍬 WowSmak',
  categories: [],
  products: [],
  purchasedIds: [],
  favorites: loadFavorites(),
  cart: { items: [], total: 0, count: 0 },
  _subs: new Set(),

  set(patch) {
    Object.assign(this, patch)
    this._subs.forEach((fn) => fn(this))
  },

  setCart(cart) {
    this.cart = cart
    this._subs.forEach((fn) => fn(this))
  },

  subscribe(fn) {
    this._subs.add(fn)
    return () => this._subs.delete(fn)
  },

  productById(id) {
    return this.products.find((p) => p.id === Number(id)) || null
  },

  hasPurchased(id) {
    return this.purchasedIds.includes(Number(id))
  },

  isFav(id) {
    return this.favorites.includes(Number(id))
  },

  toggleFav(id) {
    id = Number(id)
    const i = this.favorites.indexOf(id)
    if (i === -1) this.favorites.push(id)
    else this.favorites.splice(i, 1)
    saveFavorites(this.favorites)
    this._subs.forEach((fn) => fn(this))
    return this.isFav(id)
  },

  favProducts() {
    return this.favorites
      .map((id) => this.productById(id))
      .filter(Boolean)
  },
}

function loadFavorites() {
  try {
    const raw = localStorage.getItem('wow_favs')
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr.map(Number).filter(Boolean) : []
  } catch {
    return []
  }
}

function saveFavorites(list) {
  try {
    localStorage.setItem('wow_favs', JSON.stringify(list))
  } catch {}
}

// Формат ціни
export const fmt = (n) => `${Number(n || 0).toLocaleString('uk-UA')} ₴`
