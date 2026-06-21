-- Міграція: адмін-можливості (залишки, акції, відео, зв’язок з клієнтом)
-- Запустіть у Supabase → SQL Editor один раз.

alter table products add column if not exists stock int;                -- залишок; null = не враховується
alter table products add column if not exists sale_price numeric(10,2); -- акційна ціна; null = немає акції
alter table products add column if not exists video_url text;           -- Cloudinary public_id відео
alter table products add column if not exists cost_price numeric(10,2); -- ціна закупівлі (видна лише адмінам)
alter table products add column if not exists barcode text;             -- штрих-код товару
alter table products add column if not exists units_per_pack int;        -- кількість штук в упаковці
alter table products add column if not exists rec_markup numeric(10,2);  -- рекомендована націнка, %

-- Лог листування з клієнтами
create table if not exists messages (
  id bigint generated always as identity primary key,
  tg_id bigint not null,
  direction text not null check (direction in ('in', 'out')),
  text text,
  admin_id bigint,
  created_at timestamptz default now()
);
create index if not exists idx_messages_tg on messages (tg_id);
