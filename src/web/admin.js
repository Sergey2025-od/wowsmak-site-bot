// ============================================================
//  Повноцінна ВЕБ-АДМІНКА WowSmak (/admin)
//  Доступ лише для адміністраторів (Telegram ID у ADMIN_CHAT_ID).
//  Вхід — через Telegram Login Widget (та сама сесія, що й на сайті).
//  Функції: дашборд, товари (CRUD + медіа), категорії (CRUD),
//  замовлення + статуси, прибуток, аналітика, експорт/імпорт CSV, розсилка.
// ============================================================
import { Router } from 'express'
import express from 'express'
import { config } from '../config.js'
import * as db from '../db.js'
import { imageUrl, uploadImage } from '../cloudinary.js'
import { price, effectivePrice, parsePacks, flavorList } from '../format.js'
import { readSession } from './auth.js'
import { esc } from './util.js'
import { site } from './site.js'

const html = (res, body, status = 200) =>
  res.status(status).set('Content-Type', 'text/html; charset=utf-8').send(body)

// ---------- Хелпери розбору значень форм ----------
function num(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (s === '' || s === '-') return null
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}
function str(v) {
  const s = (v == null ? '' : String(v)).trim()
  return s === '' ? null : s
}
function parsePacksInput(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((label) => ({ label, price: null }))
}

// ---------- Статуси замовлень ----------
const STATUS = {
  new: { label: '\uD83C\uDD95 Нове', color: '#f59e0b' },
  confirmed: { label: '\u2705 Підтверджено', color: '#3b82f6' },
  shipped: { label: '\uD83D\uDE9A Відправлено', color: '#8b5cf6' },
  done: { label: '\uD83D\uDCE6 Виконано', color: '#22c55e' },
  cancelled: { label: '\u274C Скасовано', color: '#ef4444' },
  archived: { label: '\uD83D\uDDC4 Архів', color: '#6b7280' },
}
const STATUS_FLOW = ['new', 'confirmed', 'shipped', 'done', 'cancelled']
function statusBadge(s) {
  const st = STATUS[s] || { label: s, color: '#6b7280' }
  return `<span class="badge" style="background:${st.color}1a;color:${st.color};border:1px solid ${st.color}55">${esc(st.label)}</span>`
}

// ---------- Каркас сторінки адмінки ----------
const CSS = `
:root{--bg:#0e1016;--panel:#171a23;--panel2:#1e222e;--line:#2a2f3d;--txt:#e7e9ee;--muted:#9aa3b2;--acc:#ff7a1a;--acc2:#ffa454}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--txt);font-family:Manrope,system-ui,Segoe UI,Roboto,sans-serif;font-size:15px}
a{color:var(--acc2);text-decoration:none}a:hover{text-decoration:underline}
.wrap{display:flex;min-height:100vh}
.side{width:230px;background:var(--panel);border-right:1px solid var(--line);padding:18px 14px;position:sticky;top:0;height:100vh;overflow:auto;flex-shrink:0}
.brand{font-family:Comfortaa,sans-serif;font-weight:700;font-size:20px;margin:0 0 18px;display:flex;align-items:center;gap:8px}
.brand b{color:var(--acc)}
.side a{display:block;color:var(--txt);padding:10px 12px;border-radius:10px;margin-bottom:4px;font-weight:600}
.side a:hover{background:var(--panel2);text-decoration:none}
.side a.on{background:linear-gradient(135deg,var(--acc),var(--acc2));color:#1a1003}
.side .sep{height:1px;background:var(--line);margin:12px 0}
.side .small{color:var(--muted);font-size:12px;padding:0 12px}
.main{flex:1;padding:24px 28px;max-width:1100px}
h1{font-family:Comfortaa,sans-serif;font-size:26px;margin:0 0 18px}
h2{font-size:18px;margin:24px 0 12px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:14px;margin-bottom:8px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px}
.card .k{color:var(--muted);font-size:13px;margin-bottom:6px}
.card .v{font-size:24px;font-weight:800}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin-bottom:18px}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
th{color:var(--muted);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.03em}
tr:hover td{background:#ffffff05}
.thumb{width:46px;height:46px;border-radius:8px;object-fit:cover;background:var(--panel2)}
.btn{display:inline-block;background:linear-gradient(135deg,var(--acc),var(--acc2));color:#1a1003;font-weight:700;border:0;padding:10px 16px;border-radius:10px;cursor:pointer;font-size:14px}
.btn:hover{filter:brightness(1.06);text-decoration:none}
.btn--ghost{background:transparent;color:var(--txt);border:1px solid var(--line)}
.btn--sm{padding:6px 11px;font-size:13px}
.btn--danger{background:transparent;color:#ff6b6b;border:1px solid #ff6b6b55}
.btn--ok{background:transparent;color:#22c55e;border:1px solid #22c55e55}
.row{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px}
label.f{display:block;margin-bottom:14px;font-size:13px;color:var(--muted);font-weight:600}
label.f input,label.f textarea,label.f select{display:block;width:100%;margin-top:6px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px 12px;font-size:14px;font-family:inherit}
label.f textarea{min-height:80px;resize:vertical}
.inline{display:flex;align-items:center;gap:8px;color:var(--txt);font-weight:600;margin-bottom:14px}
.badge{display:inline-block;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700}
.muted{color:var(--muted)}
.alert{padding:12px 14px;border-radius:10px;margin-bottom:16px;font-weight:600}
.alert--ok{background:#22c55e1a;color:#7ee2a8;border:1px solid #22c55e55}
.alert--err{background:#ef44441a;color:#ffb4b4;border:1px solid #ef444455}
.media{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}
.media img{width:90px;height:90px;border-radius:10px;object-fit:cover;border:1px solid var(--line)}
.topbar{display:none}
@media(max-width:820px){.wrap{flex-direction:column}.side{width:auto;height:auto;position:static;display:flex;flex-wrap:wrap;gap:6px}.side a{flex:1 1 auto;text-align:center}.side .sep,.side .small,.brand{width:100%}.main{padding:18px}.grid2,.grid3{grid-template-columns:1fr}}
`

function navItem(href, label, active) {
  return `<a href="${href}" class="${active === href ? 'on' : ''}">${label}</a>`
}
function shell(active, body, flash = '') {
  return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>Адмінка — ${esc(site.name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Comfortaa:wght@600;700&display=swap" rel="stylesheet"/>
<style>${CSS}</style></head><body><div class="wrap">
<aside class="side">
  <div class="brand">\uD83C\uDF6C <span>Wow<b>Smak</b></span></div>
  ${navItem('/admin', '\uD83D\uDCCA Дашборд', active)}
  ${navItem('/admin/products', '\uD83C\uDF6C Товари', active)}
  ${navItem('/admin/categories', '\uD83D\uDCC1 Категорії', active)}
  ${navItem('/admin/orders', '\uD83E\uDDFE Замовлення', active)}
  ${navItem('/admin/earnings', '\uD83D\uDCB0 Прибуток', active)}
  ${navItem('/admin/stats', '\uD83D\uDCC8 Аналітика', active)}
  ${navItem('/admin/broadcast', '\uD83D\uDCE2 Розсилка', active)}
  ${navItem('/admin/tools', '\uD83D\uDEE0 Експорт / Імпорт', active)}
  <div class="sep"></div>
  <a href="/" target="_blank">\uD83C\uDF10 Відкрити сайт</a>
  <a href="/auth/logout?next=/admin">\uD83D\uDEAA Вийти</a>
</aside>
<main class="main">${flash}${body}</main></div></body></html>`
}

function flashFrom(req) {
  const ok = req.query.ok
  const err = req.query.err
  if (ok) return `<div class="alert alert--ok">${esc(ok)}</div>`
  if (err) return `<div class="alert alert--err">${esc(err)}</div>`
  return ''
}

// ---------- Сторінка входу (не адмін) ----------
function loginPage(message, showWidget = true) {
  const widget = showWidget && site.botUsername
    ? `<script async src="https://telegram.org/js/telegram-widget.js?22" data-telegram-login="${esc(site.botUsername)}" data-size="large" data-radius="12" data-request-access="write" data-auth-url="/auth/telegram/callback?next=/admin"></script>`
    : `<p class="muted">Вхід через Telegram недоступний: задайте змінну <code>BOT_USERNAME</code> та виконайте <code>/setdomain</code> у BotFather.</p>`
  return `<!DOCTYPE html><html lang="uk"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><meta name="robots" content="noindex"/><title>Вхід в адмінку</title><style>${CSS}
body{display:flex;align-items:center;justify-content:center}.box{background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:36px;max-width:420px;text-align:center;margin:40px auto}</style></head><body>
<div class="box"><div class="brand" style="justify-content:center">\uD83C\uDF6C Wow<b>Smak</b></div>
<h1 style="font-size:22px">Адмін-панель</h1>
<p class="muted">${esc(message || 'Увійдіть, щоб продовжити')}</p>
<div style="margin:18px 0">${widget}</div>
<p class="muted" style="font-size:13px">Доступ лише для адміністраторів магазину.</p>
<p><a href="/">\u2190 На сайт</a></p></div></body></html>`
}

// ---------- Middleware: лише адмін ----------
function requireAdmin(req, res, next) {
  const user = readSession(req)
  if (!user) return html(res, loginPage('Спочатку увійдіть через Telegram'), 401)
  if (!config.adminIds.includes(Number(user.id))) {
    return html(res, loginPage('У цього акаунта немає прав адміністратора. Перевірте ADMIN_CHAT_ID.', false), 403)
  }
  req.adminUser = user
  next()
}

const back = (res, path, ok, err) => {
  const q = ok ? `?ok=${encodeURIComponent(ok)}` : err ? `?err=${encodeURIComponent(err)}` : ''
  res.redirect(path + q)
}

export function createAdminRouter() {
  const router = Router()
  router.use(requireAdmin)

  // ============ ДАШБОРД ============
  router.get('/', async (req, res, next) => {
    try {
      const [stats, earn, top, products, cats] = await Promise.all([
        db.getOrderStats(),
        db.getEarnings('day'),
        db.getTopProducts(8),
        db.listAllProducts(),
        db.listAllCategories(),
      ])
      const totalOrders = Object.values(stats).reduce((a, b) => a + b, 0)
      const cards = `
      <div class="cards">
        <div class="card"><div class="k">Виручка сьогодні</div><div class="v">${esc(price(earn.revenue))}</div></div>
        <div class="card"><div class="k">Прибуток сьогодні</div><div class="v" style="color:${earn.profit >= 0 ? '#22c55e' : '#ef4444'}">${esc(price(earn.profit))}</div></div>
        <div class="card"><div class="k">Замовлень сьогодні</div><div class="v">${earn.ordersCount}</div></div>
        <div class="card"><div class="k">Товарів</div><div class="v">${products.length}</div></div>
        <div class="card"><div class="k">Категорій</div><div class="v">${cats.length}</div></div>
      </div>`
      const statusCards = `<div class="cards">${STATUS_FLOW.map((s) => `<div class="card"><div class="k">${esc(STATUS[s].label)}</div><div class="v">${stats[s] || 0}</div></div>`).join('')}</div>`
      const topRows = top.length
        ? top.map((p) => `<tr><td>#${p.id}</td><td>${esc(p.title)}</td><td>${esc(price(p.price))}</td><td>${p.orders} замовл.</td></tr>`).join('')
        : `<tr><td colspan="4" class="muted">Поки немає продажів</td></tr>`
      const body = `<h1>Дашборд</h1>${cards}
      <h2>Замовлення за статусами (${totalOrders})</h2>${statusCards}
      <div class="panel"><h2 style="margin-top:0">\uD83D\uDD25 Хіти продажів</h2>
      <table><thead><tr><th>ID</th><th>Товар</th><th>Ціна</th><th>Продажів</th></tr></thead><tbody>${topRows}</tbody></table></div>
      <div class="row"><a class="btn" href="/admin/products/new">\u2795 Додати товар</a><a class="btn btn--ghost" href="/admin/orders">Переглянути замовлення</a></div>`
      html(res, shell('/admin', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  // ============ ТОВАРИ ============
  router.get('/products', async (req, res, next) => {
    try {
      const products = await db.listAllProducts()
      const rows = products.length ? products.map((p) => {
        const img = p.image_url ? `<img class="thumb" src="${esc(imageUrl(p.image_url, { width: 90 }))}" alt=""/>` : '<div class="thumb"></div>'
        const stock = p.stock == null ? '<span class="muted">\u221E</span>' : (p.stock <= 0 ? '<span style="color:#ef4444">0</span>' : p.stock)
        return `<tr><td>${img}</td><td>#${p.id}</td><td><b>${esc(p.title)}</b></td><td class="muted">${esc(p.category?.title || '\u2014')}</td><td>${esc(price(p.price))}${p.sale_price != null ? ` <span style="color:var(--acc)">${esc(price(p.sale_price))}</span>` : ''}</td><td>${stock}</td><td>${p.in_stock ? '\u2705' : '\uD83D\uDEAB'}</td><td class="row"><a class="btn btn--sm btn--ghost" href="/admin/products/${p.id}">Редагувати</a></td></tr>`
      }).join('') : `<tr><td colspan="8" class="muted">Товарів ще немає</td></tr>`
      const body = `<h1>Товари <span class="muted" style="font-size:16px">(${products.length})</span></h1>
      <div class="row" style="margin-bottom:14px"><a class="btn" href="/admin/products/new">\u2795 Додати товар</a></div>
      <div class="panel"><table><thead><tr><th>Фото</th><th>ID</th><th>Назва</th><th>Категорія</th><th>Ціна</th><th>Залишок</th><th>Вітрина</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      html(res, shell('/admin/products', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  // Форма нового товару
  router.get('/products/new', async (req, res, next) => {
    try {
      const cats = await db.listAllCategories()
      html(res, shell('/admin/products', productForm(null, cats), flashFrom(req)))
    } catch (e) { next(e) }
  })

  // Створення товару
  router.post('/products/new', async (req, res, next) => {
    try {
      const b = req.body || {}
      const title = str(b.title)
      const priceV = num(b.price)
      if (!title || priceV == null) return back(res, '/admin/products/new', null, 'Вкажіть назву та ціну продажу')
      const fields = {
        category_id: num(b.category_id), title, description: str(b.description), full_description: str(b.full_description),
        cost_price: num(b.cost_price), price: priceV, sale_price: num(b.sale_price), stock: num(b.stock),
        weight_g: num(b.weight_g), units_per_pack: num(b.units_per_pack), rec_markup: num(b.rec_markup),
        barcode: str(b.barcode), flavors: str(b.flavors), packs: parsePacksInput(b.packs),
        proteins: num(b.proteins), fats: num(b.fats), carbs: num(b.carbs), calories: num(b.calories),
        country_of_origin: str(b.country_of_origin), shelf_life: str(b.shelf_life),
      }
      const created = await db.createProduct(fields)
      if (str(b.image_url)) { try { await db.addProductImage(created.id, str(b.image_url)) } catch {} }
      back(res, `/admin/products/${created.id}`, 'Товар створено')
    } catch (e) { back(res, '/admin/products/new', null, e.message) }
  })

  // Форма редагування
  router.get('/products/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id)
      const [p, cats] = await Promise.all([db.getProductAdmin(id), db.listAllCategories()])
      html(res, shell('/admin/products', productForm(p, cats), flashFrom(req)))
    } catch (e) { next(e) }
  })

  // Збереження редагування
  router.post('/products/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id)
      const b = req.body || {}
      const patch = {
        category_id: num(b.category_id), title: str(b.title), description: str(b.description),
        full_description: str(b.full_description), cost_price: num(b.cost_price), price: num(b.price) ?? 0,
        sale_price: num(b.sale_price), stock: num(b.stock), weight_g: num(b.weight_g),
        units_per_pack: num(b.units_per_pack), rec_markup: num(b.rec_markup), barcode: str(b.barcode),
        flavors: str(b.flavors), packs: parsePacksInput(b.packs), proteins: num(b.proteins), fats: num(b.fats),
        carbs: num(b.carbs), calories: num(b.calories), country_of_origin: str(b.country_of_origin),
        shelf_life: str(b.shelf_life), in_stock: b.in_stock === 'on' || b.in_stock === 'true',
      }
      const { error } = await db.supabase.from('products').update(patch).eq('id', id)
      if (error) throw error
      back(res, `/admin/products/${id}`, 'Зміни збережено')
    } catch (e) { back(res, `/admin/products/${req.params.id}`, null, e.message) }
  })

  // Видалення товару
  router.post('/products/:id/delete', async (req, res) => {
    try { await db.deleteProduct(Number(req.params.id)); back(res, '/admin/products', 'Товар видалено') }
    catch (e) { back(res, `/admin/products/${req.params.id}`, null, e.message) }
  })

  // Додати фото за URL
  router.post('/products/:id/image-url', async (req, res) => {
    try {
      const url = str((req.body || {}).url)
      if (!url) return back(res, `/admin/products/${req.params.id}`, null, 'Вкажіть URL зображення')
      await db.addProductImage(Number(req.params.id), url)
      back(res, `/admin/products/${req.params.id}`, 'Фото додано')
    } catch (e) { back(res, `/admin/products/${req.params.id}`, null, e.message) }
  })

  // Завантажити фото файлом (через Cloudinary). Приймає JSON { dataUrl }.
  router.post('/products/:id/image-file', express.json({ limit: '16mb' }), async (req, res) => {
    try {
      const dataUrl = (req.body || {}).dataUrl
      if (!dataUrl) return res.status(400).json({ ok: false, error: 'Немає файлу' })
      if (!config.cloudinary.cloudName) return res.status(400).json({ ok: false, error: 'Cloudinary не налаштовано (CLOUDINARY_*). Додайте фото за URL.' })
      const publicId = await uploadImage(dataUrl)
      await db.addProductImage(Number(req.params.id), publicId)
      res.json({ ok: true })
    } catch (e) { res.status(500).json({ ok: false, error: e.message }) }
  })

  // Встановити / змінити відео (URL або Cloudinary public_id)
  router.post('/products/:id/video', async (req, res) => {
    try {
      await db.updateProductField(Number(req.params.id), 'video_url', str((req.body || {}).url))
      back(res, `/admin/products/${req.params.id}`, 'Відео оновлено')
    } catch (e) { back(res, `/admin/products/${req.params.id}`, null, e.message) }
  })

  // Очистити всі медіа
  router.post('/products/:id/media-clear', async (req, res) => {
    try { await db.clearProductMedia(Number(req.params.id)); back(res, `/admin/products/${req.params.id}`, 'Медіа очищено') }
    catch (e) { back(res, `/admin/products/${req.params.id}`, null, e.message) }
  })

  // ============ КАТЕГОРІЇ ============
  router.get('/categories', async (req, res, next) => {
    try {
      const cats = await db.listAllCategories()
      const rows = cats.length ? cats.map((c) => `
        <tr><td>#${c.id}</td>
        <td><form method="post" action="/admin/categories/${c.id}" class="row">
          <input name="emoji" value="${esc(c.emoji || '')}" style="width:60px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px"/>
          <input name="title" value="${esc(c.title)}" style="flex:1;min-width:140px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px"/>
          <input name="sort_order" value="${c.sort_order ?? 0}" title="Порядок" style="width:70px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:8px;padding:8px"/>
          <label class="inline" style="margin:0"><input type="checkbox" name="is_active" ${c.is_active ? 'checked' : ''}/> Активна</label>
          <button class="btn btn--sm">Зберегти</button>
        </form></td>
        <td><form method="post" action="/admin/categories/${c.id}/delete" onsubmit="return confirm('Видалити категорію? Товари залишаться без категорії.')"><button class="btn btn--sm btn--danger">Видалити</button></form></td></tr>`).join('')
        : `<tr><td colspan="3" class="muted">Категорій ще немає</td></tr>`
      const body = `<h1>Категорії <span class="muted" style="font-size:16px">(${cats.length})</span></h1>
      <div class="panel"><h2 style="margin-top:0">\u2795 Нова категорія</h2>
        <form method="post" action="/admin/categories/new" class="row">
          <input name="emoji" placeholder="\uD83C\uDF6B" value="\uD83C\uDF6C" style="width:70px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px"/>
          <input name="title" placeholder="Назва категорії" required style="flex:1;min-width:180px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px"/>
          <button class="btn">Створити</button>
        </form></div>
      <div class="panel"><table><thead><tr><th>ID</th><th>Категорія</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      html(res, shell('/admin/categories', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.post('/categories/new', async (req, res) => {
    try {
      const b = req.body || {}
      if (!str(b.title)) return back(res, '/admin/categories', null, 'Вкажіть назву')
      await db.createCategory({ title: str(b.title), emoji: str(b.emoji) || '\uD83C\uDF6C' })
      back(res, '/admin/categories', 'Категорію створено')
    } catch (e) { back(res, '/admin/categories', null, e.message) }
  })

  router.post('/categories/:id', async (req, res) => {
    try {
      const id = Number(req.params.id)
      const b = req.body || {}
      const { error } = await db.supabase.from('categories').update({
        title: str(b.title), emoji: str(b.emoji), sort_order: num(b.sort_order) ?? 0,
        is_active: b.is_active === 'on' || b.is_active === 'true',
      }).eq('id', id)
      if (error) throw error
      back(res, '/admin/categories', 'Збережено')
    } catch (e) { back(res, '/admin/categories', null, e.message) }
  })

  router.post('/categories/:id/delete', async (req, res) => {
    try { await db.deleteCategory(Number(req.params.id)); back(res, '/admin/categories', 'Категорію видалено') }
    catch (e) { back(res, '/admin/categories', null, e.message) }
  })

  // ============ ЗАМОВЛЕННЯ ============
  router.get('/orders', async (req, res, next) => {
    try {
      const orders = await db.listAdminOrders(100)
      const rows = orders.length ? orders.map((o) => `<tr>
        <td>#${o.id}</td>
        <td>${new Date(o.created_at).toLocaleString('uk-UA')}</td>
        <td><b>${esc(o.full_name || '\u2014')}</b><br><span class="muted">${esc(o.phone || '')}</span></td>
        <td>${esc(price(o.total))}</td>
        <td>${statusBadge(o.status)}</td>
        <td><a class="btn btn--sm btn--ghost" href="/admin/orders/${o.id}">Деталі</a></td></tr>`).join('')
        : `<tr><td colspan="6" class="muted">Замовлень ще немає</td></tr>`
      const body = `<h1>Замовлення <span class="muted" style="font-size:16px">(${orders.length})</span></h1>
      <div class="panel"><table><thead><tr><th>ID</th><th>Дата</th><th>Клієнт</th><th>Сума</th><th>Статус</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
      html(res, shell('/admin/orders', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.get('/orders/:id', async (req, res, next) => {
    try {
      const data = await db.getOrderForInvoice(Number(req.params.id))
      if (!data) return html(res, shell('/admin/orders', '<h1>Замовлення не знайдено</h1>'), 404)
      const { order, items, total } = data
      const itemRows = items.map((it) => `<tr><td>${esc(it.title)}</td><td>${it.qty}</td><td>${esc(price(it.price))}</td><td>${esc(price(Number(it.price) * Number(it.qty)))}</td></tr>`).join('')
      const statusBtns = STATUS_FLOW.map((s) => `<form method="post" action="/admin/orders/${order.id}/status" style="display:inline"><input type="hidden" name="status" value="${s}"/><button class="btn btn--sm ${s === order.status ? '' : 'btn--ghost'}" ${s === order.status ? 'disabled' : ''}>${esc(STATUS[s].label)}</button></form>`).join(' ')
      const body = `<h1>Замовлення #${order.id}</h1>
      <div class="row" style="margin-bottom:14px"><a href="/admin/orders">\u2190 До списку</a></div>
      <div class="grid2">
        <div class="panel"><h2 style="margin-top:0">Клієнт</h2>
          <p><b>${esc(order.full_name || '\u2014')}</b></p>
          <p class="muted">\uD83D\uDCDE ${esc(order.phone || '\u2014')}</p>
          <p class="muted">\uD83D\uDCCD ${esc(order.address || '\u2014')}</p>
          ${order.fop ? `<p class="muted">\uD83E\uDDFE ФОП: ${esc(order.fop)}</p>` : ''}
          ${order.comment ? `<p class="muted">\uD83D\uDCAC ${esc(order.comment)}</p>` : ''}
          <p class="muted">\uD83D\uDD52 ${new Date(order.created_at).toLocaleString('uk-UA')}</p>
        </div>
        <div class="panel"><h2 style="margin-top:0">Статус</h2>
          <p>${statusBadge(order.status)}</p>
          <div class="row">${statusBtns}</div>
        </div>
      </div>
      <div class="panel"><h2 style="margin-top:0">Позиції</h2>
        <table><thead><tr><th>Товар</th><th>К-сть</th><th>Ціна</th><th>Сума</th></tr></thead><tbody>${itemRows}</tbody>
        <tfoot><tr><td colspan="3" style="text-align:right"><b>Разом:</b></td><td><b>${esc(price(total))}</b></td></tr></tfoot></table></div>`
      html(res, shell('/admin/orders', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.post('/orders/:id/status', async (req, res) => {
    try {
      const id = Number(req.params.id)
      const status = str((req.body || {}).status)
      if (!STATUS[status]) return back(res, `/admin/orders/${id}`, null, 'Невідомий статус')
      await db.updateOrderStatus(id, status)
      // Сповістити клієнта в Telegram (якщо бот доступний)
      try {
        const api = req.app.locals.botApi
        const data = await db.getOrderForInvoice(id)
        if (api && data?.order?.tg_id) {
          await api.sendMessage(data.order.tg_id, `\u2139\uFE0F Статус вашого замовлення #${id}: ${STATUS[status].label}`)
        }
      } catch {}
      back(res, `/admin/orders/${id}`, 'Статус оновлено')
    } catch (e) { back(res, `/admin/orders/${req.params.id}`, null, e.message) }
  })

  // ============ ПРИБУТОК ============
  router.get('/earnings', async (req, res, next) => {
    try {
      const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'day'
      const data = await db.getEarnings(period)
      const tab = (p, l) => `<a class="btn btn--sm ${p === period ? '' : 'btn--ghost'}" href="/admin/earnings?period=${p}">${l}</a>`
      const itemRows = data.items.length ? data.items.map((it) => `<tr><td>${esc(it.title)}</td><td>${it.qty}</td><td>${it.hasCost ? esc(price(it.cost)) : '\u2014'}</td><td>${esc(price(it.sell))}</td><td style="color:${it.profit >= 0 ? '#22c55e' : '#ef4444'}">${it.hasCost ? esc(price(it.profit)) : '\u2014'}</td></tr>`).join('')
        : `<tr><td colspan="5" class="muted">За період продажів немає</td></tr>`
      const body = `<h1>Прибуток</h1>
      <div class="row" style="margin-bottom:14px">${tab('day', 'Сьогодні')} ${tab('week', 'Тиждень')} ${tab('month', 'Місяць')}</div>
      <div class="cards">
        <div class="card"><div class="k">Замовлень</div><div class="v">${data.ordersCount}</div></div>
        <div class="card"><div class="k">Виручка</div><div class="v">${esc(price(data.revenue))}</div></div>
        <div class="card"><div class="k">Чистий прибуток</div><div class="v" style="color:${data.profit >= 0 ? '#22c55e' : '#ef4444'}">${esc(price(data.profit))}</div></div>
      </div>
      <div class="panel"><h2 style="margin-top:0">Продані товари</h2>
        <table><thead><tr><th>Товар</th><th>К-сть</th><th>Закупівля</th><th>Продаж</th><th>Прибуток</th></tr></thead><tbody>${itemRows}</tbody></table>
        <p class="muted" style="font-size:13px;margin-top:10px">Товари без вказаної ціни закупівлі не враховуються в прибутку (\u2014).</p></div>`
      html(res, shell('/admin/earnings', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  // ============ АНАЛІТИКА ============
  router.get('/stats', async (req, res, next) => {
    try {
      const [stats, top] = await Promise.all([db.getOrderStats(), db.getTopProducts(20)])
      const statusCards = `<div class="cards">${Object.keys(STATUS).filter((s) => s !== 'archived').map((s) => `<div class="card"><div class="k">${esc(STATUS[s].label)}</div><div class="v">${stats[s] || 0}</div></div>`).join('')}</div>`
      const topRows = top.length ? top.map((p, i) => `<tr><td>${i + 1}</td><td>#${p.id}</td><td>${esc(p.title)}</td><td>${esc(price(p.price))}</td><td>${p.orders}</td></tr>`).join('')
        : `<tr><td colspan="5" class="muted">Поки немає даних</td></tr>`
      const body = `<h1>Аналітика</h1>${statusCards}
      <div class="panel"><h2 style="margin-top:0">\uD83C\uDFC6 Топ товарів</h2>
        <table><thead><tr><th>#</th><th>ID</th><th>Товар</th><th>Ціна</th><th>Продажів</th></tr></thead><tbody>${topRows}</tbody></table></div>
      <div class="panel"><h2 style="margin-top:0">\u26A0\uFE0F Скидання аналітики</h2>
        <p class="muted">Архівує всі активні замовлення (вони перестають враховуватись у статистиці й прибутку). Дію не можна відмінити.</p>
        <form method="post" action="/admin/stats/reset" onsubmit="return confirm('Точно архівувати всі замовлення та обнулити аналітику?')"><button class="btn btn--danger">Скинути аналітику</button></form></div>`
      html(res, shell('/admin/stats', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.post('/stats/reset', async (req, res) => {
    try { await db.resetAnalytics(); back(res, '/admin/stats', 'Аналітику скинуто') }
    catch (e) { back(res, '/admin/stats', null, e.message) }
  })

  // ============ РОЗСИЛКА ============
  router.get('/broadcast', async (req, res, next) => {
    try {
      const ids = await db.getAllCustomerIds()
      const body = `<h1>Розсилка</h1>
      <div class="panel"><p class="muted">Повідомлення отримають усі клієнти бота: <b>${ids.length}</b>. Підтримується HTML (&lt;b&gt;, &lt;i&gt;, посилання).</p>
        <form method="post" action="/admin/broadcast" onsubmit="return confirm('Надіслати повідомлення ${ids.length} клієнтам?')">
          <label class="f">Текст повідомлення<textarea name="text" required style="min-height:140px"></textarea></label>
          <button class="btn">\uD83D\uDCE2 Надіслати всім</button>
        </form>
        <p class="muted" style="font-size:13px">Потрібен робочий бот (BOT_TOKEN). Telegram обмежує ~30 повідомлень/сек — розсилка йде з паузами.</p></div>`
      html(res, shell('/admin/broadcast', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.post('/broadcast', async (req, res) => {
    try {
      const text = str((req.body || {}).text)
      if (!text) return back(res, '/admin/broadcast', null, 'Введіть текст')
      const api = req.app.locals.botApi
      if (!api) return back(res, '/admin/broadcast', null, 'Бот недоступний (немає BOT_TOKEN)')
      const ids = await db.getAllCustomerIds()
      let sent = 0, failed = 0
      for (const id of ids) {
        try { await api.sendMessage(id, text, { parse_mode: 'HTML', disable_web_page_preview: false }); sent++ }
        catch { failed++ }
        await new Promise((r) => setTimeout(r, 40))
      }
      back(res, '/admin/broadcast', `Надіслано: ${sent}, не вдалося: ${failed}`)
    } catch (e) { back(res, '/admin/broadcast', null, e.message) }
  })

  // ============ ЕКСПОРТ / ІМПОРТ ============
  router.get('/tools', async (req, res, next) => {
    try {
      const body = `<h1>Експорт / Імпорт</h1>
      <div class="panel"><h2 style="margin-top:0">\u2B07\uFE0F Експорт товарів (CSV)</h2>
        <p class="muted">Вивантажити всі товари у CSV (id, назва, ціни, залишок, штрих-код тощо).</p>
        <a class="btn" href="/admin/export.csv">Завантажити CSV</a></div>
      <div class="panel"><h2 style="margin-top:0">\u2B06\uFE0F Імпорт / масове оновлення (CSV)</h2>
        <p class="muted">Вставте CSV з колонками <code>id</code> та будь-якими з: <code>stock, price, sale_price, in_stock</code>. Оновлюються лише вказані поля існуючих товарів (за id). «-» прибирає значення.</p>
        <form method="post" action="/admin/import">
          <label class="f">CSV (перший рядок — заголовки)<textarea name="csv" required placeholder="id,price,stock,in_stock&#10;12,250,40,true" style="min-height:160px;font-family:monospace"></textarea></label>
          <button class="btn">Застосувати</button></form></div>`
      html(res, shell('/admin/tools', body, flashFrom(req)))
    } catch (e) { next(e) }
  })

  router.get('/export.csv', async (req, res, next) => {
    try {
      const rows = await db.getProductsForCsv()
      const cols = ['id', 'title', 'description', 'price', 'sale_price', 'cost_price', 'stock', 'weight_g', 'units_per_pack', 'barcode', 'in_stock']
      const csvCell = (v) => {
        const s = v == null ? '' : String(v)
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
      }
      const out = [cols.join(',')].concat(rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))).join('\n')
      res.set('Content-Type', 'text/csv; charset=utf-8').set('Content-Disposition', 'attachment; filename="wowsmak-products.csv"').send('\uFEFF' + out)
    } catch (e) { next(e) }
  })

  router.post('/import', async (req, res) => {
    try {
      const csv = str((req.body || {}).csv)
      if (!csv) return back(res, '/admin/tools', null, 'Вставте CSV')
      const lines = csv.split(/\r?\n/).filter((l) => l.trim())
      if (lines.length < 2) return back(res, '/admin/tools', null, 'Потрібні заголовки та хоча б один рядок')
      const headers = lines[0].split(',').map((h) => h.trim())
      const rows = lines.slice(1).map((line) => {
        const cells = line.split(',')
        const obj = {}
        headers.forEach((h, i) => { obj[h] = (cells[i] || '').trim() })
        return obj
      })
      const results = await db.importProductsFromCsv(rows)
      const ok = results.filter((r) => r.ok).length
      back(res, '/admin/tools', `Оновлено товарів: ${ok} з ${results.length}`)
    } catch (e) { back(res, '/admin/tools', null, e.message) }
  })

  return router
}

// ============ Форма товару (create/edit) ============
function productForm(p, cats) {
  const isNew = !p
  const v = (x) => (x == null ? '' : esc(String(x)))
  const catOptions = ['<option value="">— без категорії —</option>'].concat(
    cats.map((c) => `<option value="${c.id}" ${p && p.category_id === c.id ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.title)}</option>`),
  ).join('')
  const packsText = p ? parsePacks(p).map((x) => x.label).join('\n') : ''
  const action = isNew ? '/admin/products/new' : `/admin/products/${p.id}`
  const media = isNew ? '' : mediaBlock(p)
  return `<h1>${isNew ? '\u2795 Новий товар' : `\u270F\uFE0F Товар #${p.id}`}</h1>
  <div class="row" style="margin-bottom:14px"><a href="/admin/products">\u2190 До списку</a></div>
  <form method="post" action="${action}">
    <div class="panel">
      <div class="grid2">
        <label class="f">Назва *<input name="title" required value="${v(p && p.title)}"/></label>
        <label class="f">Категорія<select name="category_id">${catOptions}</select></label>
      </div>
      <label class="f">Короткий опис<input name="description" value="${v(p && p.description)}"/></label>
      <label class="f">Повний опис<textarea name="full_description">${v(p && p.full_description)}</textarea></label>
    </div>
    <div class="panel"><h2 style="margin-top:0">Ціни та склад</h2>
      <div class="grid3">
        <label class="f">Ціна продажу, \u20B4 *<input name="price" required value="${v(p && p.price)}"/></label>
        <label class="f">Акційна ціна, \u20B4<input name="sale_price" value="${v(p && p.sale_price)}"/></label>
        <label class="f">Ціна закупівлі, \u20B4<input name="cost_price" value="${v(p && p.cost_price)}"/></label>
        <label class="f">Залишок (шт.)<input name="stock" value="${v(p && p.stock)}" placeholder="порожньо = \u221E"/></label>
        <label class="f">Штук в упаковці<input name="units_per_pack" value="${v(p && p.units_per_pack)}"/></label>
        <label class="f">Реком. націнка, %<input name="rec_markup" value="${v(p && p.rec_markup)}"/></label>
      </div>
    </div>
    <div class="panel"><h2 style="margin-top:0">Характеристики</h2>
      <div class="grid3">
        <label class="f">Вага, г<input name="weight_g" value="${v(p && p.weight_g)}"/></label>
        <label class="f">Штрих-код<input name="barcode" value="${v(p && p.barcode)}"/></label>
        <label class="f">Країна<input name="country_of_origin" value="${v(p && p.country_of_origin)}"/></label>
        <label class="f">Термін придатності<input name="shelf_life" value="${v(p && p.shelf_life)}"/></label>
        <label class="f">Білки, г<input name="proteins" value="${v(p && p.proteins)}"/></label>
        <label class="f">Жири, г<input name="fats" value="${v(p && p.fats)}"/></label>
        <label class="f">Вуглеводи, г<input name="carbs" value="${v(p && p.carbs)}"/></label>
        <label class="f">Калорійність, ккал<input name="calories" value="${v(p && p.calories)}"/></label>
      </div>
      <label class="f">Смаки (через кому)<input name="flavors" value="${v(p && p.flavors)}" placeholder="Полуниця, Шоколад, Ваніль"/></label>
      <label class="f">Фасовки (кожна з нового рядка)<textarea name="packs" placeholder="0.5 кг&#10;1 кг&#10;250 г">${packsText}</textarea></label>
      ${isNew ? '<label class="f">Головне фото за URL (необов\u02BCязково)<input name="image_url" placeholder="https://..."/></label>' : `<label class="inline"><input type="checkbox" name="in_stock" ${p.in_stock ? 'checked' : ''}/> Показувати на вітрині</label>`}
    </div>
    <div class="row"><button class="btn">${isNew ? 'Створити товар' : 'Зберегти зміни'}</button>
    ${isNew ? '' : `<a class="btn btn--ghost" href="/product/${p.id}" target="_blank">Переглянути на сайті</a>`}</div>
  </form>
  ${isNew ? '' : `<form method="post" action="/admin/products/${p.id}/delete" onsubmit="return confirm('Видалити товар назавжди?')" style="margin-top:14px"><button class="btn btn--danger">\uD83D\uDDD1 Видалити товар</button></form>`}
  ${media}`
}

// Блок медіа (тільки для існуючого товару)
function mediaBlock(p) {
  const gallery = []
  if (p.image_url) gallery.push(`<img src="${esc(imageUrl(p.image_url, { width: 180 }))}" title="Головне"/>`)
  const extra = Array.isArray(p.images) ? p.images : []
  for (const im of extra) gallery.push(`<img src="${esc(imageUrl(im, { width: 180 }))}"/>`)
  return `<div class="panel"><h2 style="margin-top:0">\uD83D\uDDBC Медіа</h2>
    <div class="media">${gallery.length ? gallery.join('') : '<span class="muted">Фото ще немає</span>'}</div>
    <div class="grid2">
      <form method="post" action="/admin/products/${p.id}/image-url" class="row">
        <input name="url" placeholder="URL зображення https://..." style="flex:1;min-width:160px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px"/>
        <button class="btn btn--sm">Додати за URL</button>
      </form>
      <div class="row">
        <input type="file" id="imgFile" accept="image/*" style="color:var(--muted)"/>
        <button class="btn btn--sm" type="button" onclick="uploadImg(${p.id})">Завантажити файл</button>
      </div>
    </div>
    <form method="post" action="/admin/products/${p.id}/video" class="row" style="margin-top:12px">
      <input name="url" value="${p.video_url ? esc(p.video_url) : ''}" placeholder="URL відео або Cloudinary public_id" style="flex:1;min-width:160px;background:var(--panel2);border:1px solid var(--line);color:var(--txt);border-radius:9px;padding:10px"/>
      <button class="btn btn--sm">Зберегти відео</button>
    </form>
    <form method="post" action="/admin/products/${p.id}/media-clear" onsubmit="return confirm('Очистити всі фото та відео товару?')" style="margin-top:12px"><button class="btn btn--sm btn--danger">Очистити медіа</button></form>
    <script>
      async function uploadImg(id){
        var f=document.getElementById('imgFile').files[0];
        if(!f){alert('Оберіть файл');return}
        var r=new FileReader();
        r.onload=async function(){
          try{
            var resp=await fetch('/admin/products/'+id+'/image-file',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl:r.result})});
            var j=await resp.json();
            if(j.ok){location.href='/admin/products/'+id+'?ok='+encodeURIComponent('Фото завантажено')}
            else{alert(j.error||'Помилка')}
          }catch(e){alert('Помилка завантаження')}
        };
        r.readAsDataURL(f);
      }
    </script></div>`
}
