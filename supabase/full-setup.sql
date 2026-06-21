-- ============================================================
--  WowSmak — ПОЛНАЯ НАСТРОЙКА НОВОЙ БАЗЫ (Supabase / PostgreSQL)
--  Выполните ЭТОТ файл ОДИН РАЗ в Supabase → SQL Editor (New query → вставить → Run).
--  Создаёт все таблицы для бота + Mini App + сайта. Безопасен для повторного запуска.
-- ============================================================

-- 1) Категорії товарів
create table if not exists categories (
  id          bigint generated always as identity primary key,
  title       text not null,
  emoji       text default '🍬',
  sort_order  int  default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- 2) Товари (з усіма полями: залишки, акції, відео, упаковки тощо)
create table if not exists products (
  id           bigint generated always as identity primary key,
  category_id  bigint references categories(id) on delete set null,
  title        text not null,
  description  text,
  cost_price   numeric(10,2),
  price        numeric(10,2) not null check (price >= 0),
  sale_price   numeric(10,2),
  stock        int,
  barcode      text,
  units_per_pack int,
  rec_markup   numeric(10,2),
  image_url    text,
  video_url    text,
  in_stock     boolean default true,
  weight_g     int,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- 3) Покупці (за Telegram id)
create table if not exists customers (
  id           bigint generated always as identity primary key,
  tg_id        bigint unique not null,
  username     text,
  full_name    text,
  phone        text,
  created_at   timestamptz default now()
);

-- 4) Кошик (Telegram-позиції)
create table if not exists cart_items (
  id           bigint generated always as identity primary key,
  tg_id        bigint not null,
  product_id   bigint references products(id) on delete cascade,
  qty          int not null default 1 check (qty > 0),
  created_at   timestamptz default now(),
  unique (tg_id, product_id)
);

-- 5) Замовлення (підтримує і бота, і гостьові замовлення з сайту)
create table if not exists orders (
  id           bigint generated always as identity primary key,
  tg_id        bigint,                         -- nullable: гостьові замовлення з сайту
  status       text not null default 'new',     -- new | confirmed | shipped | done | cancelled
  total        numeric(10,2) not null default 0,
  full_name    text,
  phone        text,
  address      text,
  comment      text,
  source       text default 'bot',              -- 'bot' або 'web'
  email        text,
  created_at   timestamptz default now()
);
-- Підстраховка, якщо orders уже існувала зі старою схемою:
alter table orders alter column tg_id drop not null;
alter table orders add column if not exists source text default 'bot';
alter table orders add column if not exists email text;

-- 6) Позиції замовлення (фіксуємо ціну на момент покупки)
create table if not exists order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint references orders(id) on delete cascade,
  product_id   bigint references products(id) on delete set null,
  title        text not null,
  price        numeric(10,2) not null,
  qty          int not null
);

-- 7) Лог листування з клієнтами (адмін)
create table if not exists messages (
  id bigint generated always as identity primary key,
  tg_id bigint not null,
  direction text not null check (direction in ('in', 'out')),
  text text,
  admin_id bigint,
  created_at timestamptz default now()
);

-- Індекси
create index if not exists idx_products_category on products(category_id);
create index if not exists idx_cart_tg on cart_items(tg_id);
create index if not exists idx_orders_tg on orders(tg_id);
create index if not exists idx_orders_source on orders(source);
create index if not exists idx_messages_tg on messages(tg_id);

-- Початкові категорії (можна потім змінити в адмінці бота)
insert into categories (title, emoji, sort_order) values
  ('Шоколад', '🍫', 1),
  ('Льодяники та карамель', '🍭', 2),
  ('Мармелад та желейки', '🧄', 3),
  ('Подарункові набори', '🎁', 4)
on conflict do nothing;

-- Готово ✅  (далі — додайте товари через адмінку бота або `npm run seed`)
