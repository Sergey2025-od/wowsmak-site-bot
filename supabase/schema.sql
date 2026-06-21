-- ============================================================
--  Telegram-магазин цукерок — схема БД для Supabase (PostgreSQL)
--  Виконай цей SQL у Supabase → SQL Editor
-- ============================================================

-- Категорії товарів (шоколад, льодяники, мармелад, набори...)
create table if not exists categories (
  id          bigint generated always as identity primary key,
  title       text not null,
  emoji       text default '🍬',
  sort_order  int  default 0,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- Товари
create table if not exists products (
  id           bigint generated always as identity primary key,
  category_id  bigint references categories(id) on delete set null,
  title        text not null,
  description  text,
  cost_price   numeric(10,2),                 -- ціна закупівлі (видна лише адмінам)
  price        numeric(10,2) not null check (price >= 0),
  sale_price   numeric(10,2),                 -- акційна ціна (null = немає акції)
  stock        int,                           -- залишок (null = не враховується)
  barcode      text,                          -- штрих-код товару
  units_per_pack int,                         -- кількість штук в упаковці (null = продається як одиниця)
  rec_markup   numeric(10,2),                 -- рекомендована націнка, % (для калькулятора)
  -- Cloudinary: зберігаємо public_id або готовий secure_url
  image_url    text,
  video_url    text,                          -- Cloudinary public_id відео
  in_stock     boolean default true,
  weight_g     int,
  sort_order   int default 0,
  created_at   timestamptz default now()
);

-- Покупці (за Telegram id)
create table if not exists customers (
  id           bigint generated always as identity primary key,
  tg_id        bigint unique not null,
  username     text,
  full_name    text,
  phone        text,
  created_at   timestamptz default now()
);

-- Кошик (позиції, які клієнт ще не оформив)
create table if not exists cart_items (
  id           bigint generated always as identity primary key,
  tg_id        bigint not null,
  product_id   bigint references products(id) on delete cascade,
  qty          int not null default 1 check (qty > 0),
  created_at   timestamptz default now(),
  unique (tg_id, product_id)
);

-- Замовлення
create table if not exists orders (
  id           bigint generated always as identity primary key,
  tg_id        bigint not null,
  status       text not null default 'new',  -- new | confirmed | shipped | done | cancelled
  total        numeric(10,2) not null default 0,
  full_name    text,
  phone        text,
  address      text,
  comment      text,
  created_at   timestamptz default now()
);

-- Позиції замовлення (фіксуємо ціну на момент покупки)
create table if not exists order_items (
  id           bigint generated always as identity primary key,
  order_id     bigint references orders(id) on delete cascade,
  product_id   bigint references products(id) on delete set null,
  title        text not null,
  price        numeric(10,2) not null,
  qty          int not null
);

create index if not exists idx_products_category on products(category_id);
create index if not exists idx_cart_tg on cart_items(tg_id);
create index if not exists idx_orders_tg on orders(tg_id);

-- Приклад даних для старту
insert into categories (title, emoji, sort_order) values
  ('Шоколад', '🍫', 1),
  ('Льодяники', '🍭', 2),
  ('Мармелад', '🧄', 3),
  ('Подарункові набори', '🎁', 4)
on conflict do nothing;
