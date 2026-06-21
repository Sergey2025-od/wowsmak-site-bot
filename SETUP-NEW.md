# WowSmak — развёртывание С НУЛЯ (новый бот + база + GitHub + Render)

Этот проект — **одно приложение**, в котором сразу всё: **Telegram-бот + Mini App + публичный сайт**.
Один репозиторий, один деплой на Render, одна база Supabase.

> ⚠ВАЖНО: делайте ВСЁ НОВОЕ — новый токен бота, новую Supabase, новый Render.
> Никогда не используйте токен рабочего бота — иначе сломается рабочий магазин.

---

## Шаг 1. Новый бот в BotFather
1. Откройте [@BotFather](https://t.me/BotFather) → `/newbot` → имя и username (напр. `WowSmakShopBot`).
2. Сохраните **BOT_TOKEN** (вида `123456:ABC...`).
3. Username бота (без @) понадобится как `BOT_USERNAME`.
4. Домен для Mini App и входа через Telegram настроим позже (Шаг 6), когда будет адрес Render.

## Шаг 2. Новая база Supabase
1. [supabase.com](https://supabase.com) → **New project** (запомните пароль БД).
2. **Project Settings → API**: скопируйте `Project URL` (→ `SUPABASE_URL`) и ключ `service_role` (→ `SUPABASE_SERVICE_KEY`).
   Ключ `service_role` — секретный, только для сервера.
3. **SQL Editor → New query** → вставьте весь файл **`supabase/full-setup.sql`** → **Run**.
   Это создаст все таблицы и стартовые категории.

## Шаг 3. Cloudinary (фото/видео товаров) — опционально, но рекомендуется
1. [cloudinary.com](https://cloudinary.com) → зарегистрируйтесь → Dashboard.
2. Скопируйте `Cloud name`, `API Key`, `API Secret` → в переменные `CLOUDINARY_*`.
   Без Cloudinary бот/сайт запустятся, но загрузка медиа товаров не будет работать.

## Шаг 4. Ваш Telegram ID (для админки)
Напишите [@userinfobot](https://t.me/userinfobot) → он пришлёт ваш `id` → это `ADMIN_CHAT_ID` (кому приходят заказы и доступ к /admin).

## Шаг 5. Новый GitHub-репозиторий
1. Создайте пустой репо (напр. `wowsmak-shop`).
2. Распакуйте этот архив и залейте ВСЕ файлы в репо (файл `.env` НЕ заливать — он в `.gitignore`).
   Через сайт GitHub: Add file → Upload files → перетащить содержимое папки `wowsmak-bot-main`.

## Шаг 6. Новый сервис на Render
1. [render.com](https://render.com) → **New → Web Service** → подключите ваш новый GitHub-репо.
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
   (Можно иначе: New → Blueprint — он подхватит `render.yaml`.)
2. **Environment → добавьте переменные** (см. таблицу ниже). Пока временно оставьте `PUBLIC_URL` пустым.
3. Дождитесь первого деплоя и скопируйте адрес сервиса, напр. `https://wowsmak-shop.onrender.com`.
4. Впишите этот адрес в `PUBLIC_URL` и `SITE_URL` → сохраните → Render передеплоит.
   На старте код сам установит вебхук и кнопку-меню Mini App.
5. **BotFather → /setdomain** → выберите бота → укажите ваш домен Render (`https://wowsmak-shop.onrender.com`).
   Это нужно для входа через Telegram на сайте и для Mini App.

## Шаг 7. Проверка
- `https://ваш-домен.onrender.com/healthz` → «Candy bot is running 🍬»
- `https://ваш-домен.onrender.com/` → главная сайта
- `https://ваш-домен.onrender.com/app/` → Mini App
- В боте: `/start` → кнопка «🍬 Магазин» открывает Mini App; заказ приходит вам в личку.

## Шаг 8. Товары и контент
- Добавляйте товары через **админку в боте** (вы — админ по `ADMIN_CHAT_ID`).
- Или быстро залейте примеры: локально `npm install` → `npm run seed` (с заполненным `.env`).
- Сайт и бот читают товары из **одной таблицы** — что добавили в боте, то появляется на сайте.

---

## Переменные окружения (Render → Environment)

| Переменная | Обяз. | Что это |
|---|---|---|
| `BOT_TOKEN` | ✅ | Токен НОВОГО бота от BotFather |
| `SUPABASE_URL` | ✅ | Project URL новой Supabase |
| `SUPABASE_SERVICE_KEY` | ✅ | Ключ `service_role` |
| `ADMIN_CHAT_ID` | ✅ | Ваш Telegram id (можно несколько через запятую) |
| `PUBLIC_URL` | ✅* | Адрес Render (заполнить после 1-го деплоя). Без него не работают вебхук и Mini App |
| `WEBHOOK_SECRET` | ✅ | Любая секретная строка |
| `SITE_URL` | ⭐ | Адрес сайта для SEO/sitemap (= `PUBLIC_URL`) |
| `BOT_USERNAME` | ⭐ | Username бота без @ (для входа через Telegram) |
| `TELEGRAM_BOT_URL` | ⭐ | `https://t.me/ВашБот` |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | ⭐ | Для фото/видео товаров |
| `SHOP_NAME`, `SHOP_PHONE`, `SHOP_EMAIL`, `SHOP_TAGLINE` | ⭐ | Бренд/контакты в шапке/футере |
| `GA_ID`, `META_PIXEL_ID`, `GOOGLE_SITE_VERIFICATION` | ⭐ | Аналитика и верификация для продвижения |
| `FREE_SHIPPING_FROM` | ⭐ | Бесплатная доставка от суммы (0 = выкл) |

*`PUBLIC_URL` становится обязательным после того, как узнаете адрес Render.

Полный список с комментариями — в файле `.env.example`.

---

## Локальный просмотр (безопасно)
- **Только дизайн сайта** (без БД и без Telegram): `node preview/preview-server.mjs` → http://localhost:8080
- **Полноценно с базой**: заполните `.env` (копия `.env.example`) → `npm install` → `npm start` → http://localhost:3000

> ⚠ Если запускаете бота локально — используйте ТОЛЬКО токен тестового бота.
> Запуск боевого токена локально удаляет вебхук и «уводит» бота с Render.
