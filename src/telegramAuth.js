import crypto from 'node:crypto'
import { config } from './config.js'

// Перевірка підпису Telegram WebApp initData.
// Документація: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export function verifyInitData(initData) {
  if (!initData || typeof initData !== 'string') return null

  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  // Рядок перевірки: усі пари, крім hash, відсортовані за ключем
  const pairs = []
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue
    pairs.push(`${key}=${value}`)
  }
  pairs.sort()
  const dataCheckString = pairs.join('\n')

  // secret_key = HMAC_SHA256(<bot_token>, "WebAppData")
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(config.botToken || '')
    .digest()
  const computedHash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex')

  if (computedHash !== hash) return null

  // Свіжість (захист від повторів): не старше 24 годин
  const authDate = Number(params.get('auth_date') || 0)
  if (authDate && Date.now() / 1000 - authDate > 86400) return null

  let user = null
  try {
    user = JSON.parse(params.get('user') || 'null')
  } catch {
    return null
  }
  if (!user || !user.id) return null
  return user
}

// Express-middleware: додає req.tgUser та req.tgId.
// initData передається в заголовку X-Telegram-Init-Data.
// Для локальної розробки (без Telegram) можна задати DEV_TG_ID.
export function telegramAuth(req, res, next) {
  const initData = req.get('X-Telegram-Init-Data') || req.query.tgInitData || ''
  const user = verifyInitData(initData)
  if (user) {
    req.tgUser = user
    req.tgId = user.id
    return next()
  }
  const devId = process.env.DEV_TG_ID ? Number(process.env.DEV_TG_ID) : null
  if (devId && !config.publicUrl) {
    req.tgUser = { id: devId, first_name: 'Dev', username: 'dev' }
    req.tgId = devId
    return next()
  }
  return res.status(401).json({ error: 'unauthorized' })
}
