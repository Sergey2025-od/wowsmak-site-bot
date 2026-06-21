import { TG } from './telegram.js'

const BASE = '/api'

async function request(pathname, { method = 'GET', body } = {}) {
  const headers = { 'X-Telegram-Init-Data': TG.initData }
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(BASE + pathname, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let detail = {}
    try {
      detail = await res.json()
    } catch {}
    const err = new Error(detail.error || `HTTP ${res.status}`)
    err.status = res.status
    err.code = detail.error
    throw err
  }
  return res.json()
}

export const API = {
  bootstrap: () => request('/bootstrap'),
  products: (categoryId) => request(categoryId ? `/products?category=${categoryId}` : '/products'),
  product: (id) => request(`/product/${id}`),
  cart: () => request('/cart'),
  cartAdd: (productId, qty = 1, packLabel = null) =>
    request('/cart/add', { method: 'POST', body: { productId, qty, packLabel } }),
  cartSet: (productId, qty) => request('/cart/set', { method: 'POST', body: { productId, qty } }),
  cartRemove: (productId) => request('/cart/remove', { method: 'POST', body: { productId } }),
  cartClear: () => request('/cart/clear', { method: 'POST' }),
  order: (data) => request('/order', { method: 'POST', body: data }),
  orders: () => request('/orders'),
  orderById: (id) => request(`/order/${id}`),
  clearOrders: () => request('/orders/clear', { method: 'POST' }),
  profile: () => request('/profile'),
  support: (text) => request('/support', { method: 'POST', body: { text } }),
  adminProducts: () => request('/admin/products'),
  adminSetStock: (id, stock) => request('/admin/stock', { method: 'POST', body: { id, stock } }),
  restockSubscribe: (productId) => request('/restock/subscribe', { method: 'POST', body: { productId } }),
  restockUnsubscribe: (productId) => request('/restock/unsubscribe', { method: 'POST', body: { productId } }),
  productReviews: (productId) => request(`/reviews/${productId}`),
  addReview: (productId, rating, text) => request('/review', { method: 'POST', body: { productId, rating, text } }),
  productAlsoBought: (productId) => request(`/product/${productId}/also-bought`),
  adminAnalytics: () => request('/admin/analytics'),
  adminImportCsv: (rows) => request('/admin/import-csv', { method: 'POST', body: { rows } }),
  adminResetAnalytics: () => request('/admin/reset-analytics', { method: 'POST' }),
  // ===== Admin panel =====
  adminGetProduct: (id) => request(`/admin/product/${id}`),
  adminCreateProduct: (data) => request('/admin/product', { method: 'POST', body: data }),
  adminUpdateProduct: (id, data) => request(`/admin/product/${id}`, { method: 'PUT', body: data }),
  adminDeleteProduct: (id) => request(`/admin/product/${id}`, { method: 'DELETE' }),
  adminCategoriesList: () => request('/admin/categories-list'),
  adminCreateCategory: (data) => request('/admin/category', { method: 'POST', body: data }),
  adminDeleteCategory: (id) => request(`/admin/category/${id}`, { method: 'DELETE' }),
  adminOrdersList: () => request('/admin/orders-list'),
  adminSetOrderStatus: (id, status) => request(`/admin/order/${id}/status`, { method: 'POST', body: { status } }),
  adminUploadImage: (productId, file, isMain = 0) => {
    const url = `/admin/upload-image?productId=${productId}&isMain=${isMain}`
    return fetch('/api' + url, {
      method: 'POST',
      headers: { 'X-Telegram-Init-Data': TG.initData, 'Content-Type': file.type },
      body: file,
    }).then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error || 'upload_error'))))
  },
  adminUploadVideo: (productId, file) => {
    const url = `/admin/upload-video?productId=${productId}`
    return fetch('/api' + url, {
      method: 'POST',
      headers: { 'X-Telegram-Init-Data': TG.initData, 'Content-Type': file.type },
      body: file,
    }).then(r => r.ok ? r.json() : r.json().then(d => Promise.reject(new Error(d.error || 'upload_error'))))
  },
  adminClearMedia: (productId) => request(`/admin/product/${productId}/clear-media`, { method: 'DELETE' }),
}
