// ============================================================
//  Авторизація на сайті через Telegram Login Widget.
//  Документація: https://core.telegram.org/widgets/login
//
//  Важливо: secret для Login Widget = SHA256(bot_token),
//  на відміну від Mini App initData (HMAC з ключем "WebAppData").
// ============================================================
import crypto from 'node:crypto'
import { config } from '../config.js'
import { parseCookies } from './util.js'

const SESSION_COOKIE = 'wow_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 днів
const SIGN_KEY = config.webhookSecret || config.botToken || 'wow-secret'

// ---------- Перевірка підпису від Telegram Login Widget ----------
export function verifyTelegramLogin(data) {
  if (!data || !data.hash) return null
  const botToken = config.botToken || ''
  if (!botToken) return null

  // Telegram підписує ЛИШЕ свої поля. Сторонні параметри (напр. next),
  // які дописуються до data-auth-url, треба виключити, інакше хеш не співпаде.
  const ALLOWED = ['auth_date', 'first_name', 'id', 'last_name', 'photo_url', 'username']
  const pairs = Object.keys(data)
    .filter((k) => k !== 'hash' && ALLOWED.includes(k))
    .sort()
    .map((k) => `${k}=${data[k]}`)
  const dataCheckString = pairs.join('\n')

  const secret = crypto.createHash('sha256').update(botToken).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')

  // Порівняння сталого часу
  const a = Buffer.from(hmac, 'hex')
  const b = Buffer.from(String(data.hash), 'hex')
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  // Свіжість (не старше 24 годин)
  const authDate = Number(data.auth_date || 0)
  if (authDate && Date.now() / 1000 - authDate > 86400) return null

  return {
    id: Number(data.id),
    first_name: data.first_name || '',
    last_name: data.last_name || '',
    username: data.username || '',
    photo_url: data.photo_url || '',
  }
}

// ---------- Підписана cookie-сесія ----------
function b64url(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(str, 'base64').toString('utf8')
}
function sign(body) {
  return crypto.createHmac('sha256', SIGN_KEY).update(body).digest('hex')
}

export function setSession(res, user) {
  const payload = {
    id: user.id,
    first_name: user.first_name,
    username: user.username,
    photo_url: user.photo_url,
  }
  const body = b64url(JSON.stringify(payload))
  const token = `${body}.${sign(body)}`
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; SameSite=Lax; HttpOnly`)
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly`)
}

export function readSession(req) {
  const raw = parseCookies(req)[SESSION_COOKIE]
  if (!raw) return null
  const dot = raw.lastIndexOf('.')
  if (dot === -1) return null
  const body = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const user = JSON.parse(b64urlDecode(body))
    if (!user || !user.id) return null
    return user
  } catch {
    return null
  }
}

// Допустиме локальне посилання для redirect (захист від open redirect)
export function safeNext(next) {
  if (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//')) return next
  return '/'
}
