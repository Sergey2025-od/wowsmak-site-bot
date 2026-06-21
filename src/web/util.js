// ============================================================
//  Допоміжні функції рендерингу та форматування для сайту
// ============================================================
import { site } from './site.js'

// Екранування HTML (для будь-якого тексту з БД / користувача)
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Екранування для значень всередині JSON-LD (script)
export function jsonLdSafe(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
}

// Ціна у форматі UA: "1 250 ₴"
export function price(value) {
  const n = Math.round(Number(value) * 100) / 100
  return `${n.toLocaleString('uk-UA')}\u00A0${site.currencySymbol}`
}

// Числова ціна без символу (для data-атрибутів, JSON-LD)
export function priceNumber(value) {
  return (Math.round(Number(value) * 100) / 100).toFixed(2)
}

// Транслітерація + slug (для ЛЮДЯНИХ URL товарів/категорій/статей)
const MAP = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', ы: 'y', э: 'e', ё: 'e', ъ: '',
}
export function slugify(text) {
  const s = String(text ?? '')
    .toLowerCase()
    .split('')
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return s || 'item'
}

// Канонічний шлях товару: /product/<id>-<slug>
export function productPath(p) {
  return `/product/${p.id}-${slugify(p.title)}`
}

// Канонічний шлях категорії: /catalog/<id>-<slug>
export function categoryPath(c) {
  return `/catalog/${c.id}-${slugify(c.title)}`
}

// Витягнути числовий id з параметра типу "12-shokolad"
export function idFromParam(param) {
  const m = String(param || '').match(/^(\d+)/)
  return m ? Number(m[1]) : null
}

// Обрізати текст до N символів (для meta description)
export function clamp(text, n = 160) {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (t.length <= n) return t
  return t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'
}

// Розбір cookie у простий об'єкт
export function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const k = part.slice(0, idx).trim()
    const v = part.slice(idx + 1).trim()
    if (k) out[k] = decodeURIComponent(v)
  }
  return out
}
