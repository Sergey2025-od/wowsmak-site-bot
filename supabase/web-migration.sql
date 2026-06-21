-- =====================================================================
--  Міграція для публічного сайту (замовлення гостей без Telegram)
--  Виконайте один раз у Supabase SQL Editor.
--  Безпечна для повторного запуску (IF EXISTS / IF NOT EXISTS).
-- =====================================================================

-- 1. Дозволяємо замовлення без tg_id (гость із сайту)
ALTER TABLE orders ALTER COLUMN tg_id DROP NOT NULL;

-- 2. Джерело замовлення: 'bot' (за замовчуванням) або 'web'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS source text DEFAULT 'bot';

-- 3. Email покупця з сайту (опціонально)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS email text;

-- 4. (Опціонально) індекс для звітів по джерелу
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders (source);
