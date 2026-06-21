# WowSmak — публічний сайт магазину

Сайт вбудований у **той самий додаток**, що і бот та Mini App. Один репозиторій, один деплой на Render,
**одна база даних Supabase** та **ті самі медіа Cloudinary**. Ніякої дублюючої бази.

## Що додано

```
src/web/            — весь код сайту (SSR на чистому JS, без нових залежностей)
  site.js           — налаштування (бренд, контакти, аналітика, SEO)
  data.js           — читання товарів/категорій та створення замовлень із тієї ж Supabase
  auth.js           — вхід через Telegram Login Widget + підписана cookie-сесія
  seo.js            — meta, Open Graph, JSON-LD, sitemap.xml, robots.txt
  layout.js         — каркас (шапка/футер/head)
  components.js     — картки товарів, сітка, хлібні крихти тощо
  content.js        — статті блогу, FAQ, інфо-сторінки
  cart.js           — кошик на cookie
  pages.js          — рендер усіх сторінок
  router.js         — маршрути сайту
  util.js           — допоміжні функції
public-site/        — статика (раздається з /assets)
  css/site.css      — світла кондитерська тема
  js/site.js        — кошик, меню, галерея, події аналітики
  img/              — сюди додайте logo.png, favicon.svg, og-default.jpg
supabase/web-migration.sql  — міграція БД (виконати один раз)
```

Змінені файли бота: `src/server.js` (монтує сайт), `src/notify.js` (сповіщення про замовлення з сайту).

## Крок 1. Міграція БД (обов'язково)

У Supabase → SQL Editor виконайте вміст `supabase/web-migration.sql`. Він:
- робить `orders.tg_id` необов'язковим (для гостьових замовлень);
- додає `orders.source` ('bot' / 'web') та `orders.email`;
- додає індекс по `source`.

## Крок 2. Змінні оточення (Render → Environment)

Див. `.env.example`. Мінімум для старту:

| Змінна | Призначення |
|--------|------------|
| `SITE_URL` | Публічна адреса сайту, напр. `https://wowsmak.onrender.com` (для canonical, sitemap, OG) |
| `TELEGRAM_BOT_URL` | Посилання на бота, напр. `https://t.me/WowSmakBot` |
| `BOT_USERNAME` | Username бота без @ (для входу через Telegram). Якщо порожньо — береться з `TELEGRAM_BOT_URL` |
| `SHOP_PHONE`, `SHOP_EMAIL` | Контакти для шапки/футера та мікророзмітки |
| `GA_ID` | Google Analytics 4 (`G-XXXXXXX`) |
| `META_PIXEL_ID` | Meta (Facebook) Pixel ID |
| `GOOGLE_SITE_VERIFICATION` | Код підтвердження Google Search Console |

Додатково (необов'язково): `SHOP_NAME`, `SHOP_TAGLINE`, `SHOP_DESCRIPTION`, `SHOP_KEYWORDS`,
`SHOP_INSTAGRAM`, `SHOP_FACEBOOK`, `FREE_SHIPPING_FROM`, `SHOP_AREA_SERVED` (за замовчуванням «Україна»).

> Сайт працює **на всю Україну** — місто не вказується. Якщо колись захочете локальне SEO по місту
> — задайте `SHOP_CITY` (і за бажанням `SHOP_REGION`), тоді місто з'явиться у футері та розмітці.

## Крок 3. Вхід через Telegram (важливо)

Щоб клієнти могли входити через Telegram (і ви могли писати їм у боті):

1. У [@BotFather](https://t.me/BotFather) → `/setdomain` → оберіть вашого бота → вкажіть домен сайту
   (напр. `wowsmak.onrender.com`, без `https://`). Без цього кнопка «Увійти» не працюватиме.
2. Переконайтеся, що `BOT_USERNAME` (або `TELEGRAM_BOT_URL`) вказує саме на цього бота.
3. На сторінці оформлення з'явиться офіційна кнопка «Log in with Telegram».

Як це працює:
- Підпис від Telegram перевіряється на сервері (HMAC-SHA256 з `BOT_TOKEN`).
- Після входу встановлюється підписана cookie-сесія (HttpOnly, 30 днів).
- Замовлення такого клієнта зберігається з його `tg_id`, а клієнт додається в `customers`.
  Тому з адмін-панелі бота ви можете писати йому прямо в Telegram, як і звичайному покупцеві.
- Якщо клієнт не хоче входити — можна оформити як гість (без `tg_id`), тоді зв'язок — за телефоном.

## Крок 4. Медіа бренду

Додайте файли у `public-site/img/`: `logo.png` (для JSON-LD/OG), `favicon.svg`, `og-default.jpg` (1200×630).
Товарні фото/відео нічого не вимагають — вони беруться з того ж Cloudinary, що й у боті.

## Крок 5. Деплой

Окремих дій не потрібно — сайт запускається разом із ботом (`npm start`). Після push у GitHub Render
зробить авто-деплой. Маршрути:
- `/` — сайт; `/healthz` — healthcheck; `/webhook/...` — бот; `/api` — Mini App API; `/app` — Mini App; `/assets` — статика сайту.

## Крок 6. SEO після запуску

- `sitemap.xml` та `robots.txt` генеруються автоматично (`/sitemap.xml`, `/robots.txt`).
- Додайте сайт у **Google Search Console** і надішліть sitemap.
- JSON-LD вже вбудовано: Organization, WebSite, Store, Product, BreadcrumbList, ItemList, Article, FAQ.
- Події аналітики (додавання в кошик, початок оформлення) відправляються у GA4/Pixel автоматично.

## Як редагувати блог/інфо-сторінки

Статті та тексти сторінок «Про нас / Доставка / Контакти» живуть у `src/web/content.js`.
Додайте новий об'єкт у масив `ARTICLES` — стаття автоматично потрапить у блог, sitemap та розмітку Article.

## Локальний запуск

```bash
npm install
cp .env.example .env   # заповніть змінні
npm start              # сайт на http://localhost:3000
```
