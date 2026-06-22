// ============================================================
//  Перевикористовувані UI-компоненти (картка товару, хлібні крихти...)
// ============================================================
import { esc, price, priceNumber } from './util.js'
import { categoryPath } from './util.js'
import { categoryIcon } from './icons.js'

export function priceBlock(p) {
  if (p.salePrice != null) {
    return `<span class="price"><span class="price__old">${price(p.price)}</span> <span class="price__now is-sale">${price(p.salePrice)}</span></span>`
  }
  return `<span class="price"><span class="price__now">${price(p.price)}</span></span>`
}

export function productCard(p) {
  const badges = []
  if (p.discount) badges.push(`<span class="badge badge--sale">-${p.discount}%</span>`)
  if (p.hit) badges.push(`<span class="badge badge--hit">🔥 Хіт</span>`)
  const img = p.image
    ? `<img class="pcard__img" src="${esc(p.image)}" alt="${esc(p.title)}" loading="lazy" width="400" height="400" />`
    : `<div class="pcard__img pcard__img--ph">🍬</div>`
  const cartIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>`
  const addBtn = p.available
    ? `<button class="pcard__add" data-add="${p.id}" type="button" aria-label="Додати в кошик">${cartIcon}</button>`
    : `<button class="pcard__add pcard__add--off" disabled aria-label="Немає в наявності">${cartIcon}</button>`
  const rating =
    p.rating != null
      ? `<div class="pcard__rating"><span class="pcard__star">★</span><span class="muted small">${Number(p.rating).toFixed(1)}${p.ratingCount ? ` (${p.ratingCount})` : ''}</span></div>`
      : ''
  const priceVal = priceNumber(p.salePrice != null ? p.salePrice : p.price)
  const weight = p.weightG
    ? p.weightG >= 1000
      ? `${String(p.weightG / 1000).replace(/\.0$/, '')} кг`
      : `${p.weightG} г`
    : ''
  return `
<article class="pcard${p.available ? '' : ' is-out'}" data-price="${priceVal}" data-sold="${p.soldToday || 0}" data-rating="${p.rating || 0}" data-country="${esc(p.countryOfOrigin || '')}">
  <a class="pcard__media" href="${esc(p.path)}">
    ${badges.length ? `<div class="pcard__badges">${badges.join('')}</div>` : ''}
    <button class="pcard__fav" type="button" data-fav="${p.id}" aria-label="Додати в обране">♡</button>
    ${img}
    ${p.available ? '' : '<div class="pcard__out">Немає в наявності</div>'}
  </a>
  <div class="pcard__body">
    <h3 class="pcard__title"><a href="${esc(p.path)}">${esc(p.title)}</a></h3>
    ${weight ? `<div class="pcard__meta muted">${esc(weight)}</div>` : ''}
    ${rating}
    <div class="pcard__foot">
      ${priceBlock(p)}
      ${addBtn}
    </div>
  </div>
</article>`
}

export function productGrid(products, emptyText = 'Товарів поки немає.', opts = {}) {
  if (!products.length) return `<p class="empty">${esc(emptyText)}</p>`
  return `<div class="grid grid--products"${opts.id ? ` id="${esc(opts.id)}"` : ''}>${products.map(productCard).join('')}</div>`
}

export function section(title, body, opts = {}) {
  const { id = '', link } = opts
  const head = `<div class="section__head"><h2 class="section__title">${esc(title)}</h2>${
    link ? `<a class="section__more" href="${esc(link.href)}">${esc(link.label)} →</a>` : ''
  }</div>`
  return `<section class="section"${id ? ` id="${esc(id)}"` : ''}><div class="container">${head}${body}</div></section>`
}

export function breadcrumbs(items) {
  const li = items
    .map((it, i) => {
      const last = i === items.length - 1
      return last
        ? `<li aria-current="page">${esc(it.name)}</li>`
        : `<li><a href="${esc(it.url)}">${esc(it.name)}</a></li>`
    })
    .join('<li class="sep">/</li>')
  return `<nav class="breadcrumbs" aria-label="Хлібні крихти"><div class="container"><ul>${li}</ul></div></nav>`
}

export function categoryChips(categories, activeId) {
  const all = `<a class="chip${!activeId ? ' is-active' : ''}" href="/catalog">Усі</a>`
  const items = categories
    .map(
      (c) =>
        `<a class="chip${activeId === c.id ? ' is-active' : ''}" href="${categoryPath(c)}">${categoryIcon(c)} ${esc(c.title)}</a>`,
    )
    .join('')
  return `<div class="chips">${all}${items}</div>`
}

export function stars(avg) {
  const full = Math.round(avg || 0)
  let s = ''
  for (let i = 1; i <= 5; i++) s += i <= full ? '★' : '☆'
  return `<span class="stars" aria-label="Оцінка ${(avg || 0).toFixed(1)} з 5">${s}</span>`
}
