// ============================================================
//  Налаштування публічного сайту WowSmak
//  Усі значення можна перевизначити через змінні оточення (Render).
// ============================================================
import { config } from '../config.js'

function env(name, fallback = '') {
  const v = process.env[name]
  return v == null || v === '' ? fallback : v
}

// Базовий публічний URL сайту (для канонічних посилань, sitemap, OG).
// Пріоритет: SITE_URL → PUBLIC_URL → localhost.
const rawUrl = env('SITE_URL', config.publicUrl || 'http://localhost:' + (config.port || 3000))
const baseUrl = rawUrl.replace(/\/+$/, '')

export const site = {
  baseUrl,
  name: env('SHOP_NAME', 'WowSmak'),
  legalName: env('SHOP_LEGAL_NAME', 'WowSmak'),
  tagline: env('SHOP_TAGLINE', 'Магазин солодощів та конфет з доставкою'),
  description: env(
    'SHOP_DESCRIPTION',
    'WowSmak — інтернет-магазин солодощів: шоколад, льодяники, мармелад та подарункові набори. Свіжі смаколики з доставкою. Замовляйте онлайн на сайті або в Telegram.',
  ),
  keywords: env(
    'SHOP_KEYWORDS',
    'купити цукерки, солодощі, шоколад, льодяники, мармелад, подарункові набори, доставка солодощів',
  ),
  // Контакти / локальне SEO
  phone: env('SHOP_PHONE', '0 800 33 00 57'),
  email: env('SHOP_EMAIL', 'hello@wowsmak.com.ua'),
  // Магазин працює на всю Україну (без прив'язки до міста). За потреби
  // вкажіть SHOP_CITY — тоді місто з'явиться у футері та локальній розмітці.
  city: env('SHOP_CITY', ''),
  region: env('SHOP_REGION', ''),
  country: env('SHOP_COUNTRY', 'UA'),
  areaServed: env('SHOP_AREA_SERVED', 'Україна'),
  postalCode: env('SHOP_POSTAL_CODE', ''),
  streetAddress: env('SHOP_STREET', ''),
  geoLat: env('SHOP_GEO_LAT', ''),
  geoLng: env('SHOP_GEO_LNG', ''),
  openingHours: env('SHOP_HOURS', 'Mo-Su 09:00-21:00'),
  // Соцмережі / месенджери
  telegramBot: env('TELEGRAM_BOT_URL', ''), // напр. https://t.me/WowSmakBot
  // Username бота (без @) — потрібен для входу через Telegram Login Widget.
  // Якщо не задано явно, береться з посилання TELEGRAM_BOT_URL (t.me/<username>).
  botUsername: env('BOT_USERNAME', '').replace(/^@/, '') ||
    (env('TELEGRAM_BOT_URL', '').match(/t\.me\/([A-Za-z0-9_]+)/)?.[1] || ''),
  miniAppPath: '/app/',
  instagram: env('SHOP_INSTAGRAM', ''),
  facebook: env('SHOP_FACEBOOK', ''),
  // Аналітика
  gaId: env('GA_ID', ''), // Google Analytics 4, напр. G-XXXXXXX
  metaPixelId: env('META_PIXEL_ID', ''),
  googleSiteVerification: env('GOOGLE_SITE_VERIFICATION', ''),
  // Інше
  currency: 'UAH',
  currencySymbol: '₴',
  locale: 'uk_UA',
  lang: 'uk',
  // Безкоштовна доставка від суми (для банера/SEO), 0 = вимкнено
  freeShippingFrom: Number(env('FREE_SHIPPING_FROM', '0')) || 0,
}

// Абсолютний URL від відносного шляху
export function absUrl(pathname = '/') {
  if (!pathname) return site.baseUrl
  if (/^https?:\/\//i.test(pathname)) return pathname
  return site.baseUrl + (pathname.startsWith('/') ? pathname : '/' + pathname)
}

// Посилання "перейти в бота": реальний бот або, як запасний варіант, Mini App
export function botLink() {
  if (site.telegramBot) return site.telegramBot
  return absUrl(site.miniAppPath)
}
