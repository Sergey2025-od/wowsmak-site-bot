// ============================================================
//  Рендеринг сторінок сайту (SSR)
// ============================================================
import { site, absUrl, botLink } from './site.js'
import { esc, price, priceNumber, clamp, categoryPath, productPath } from './util.js'
import { layout } from './layout.js'
import {
  productGrid,
  productCard,
  section,
  breadcrumbs,
  categoryChips,
  priceBlock,
  stars,
} from './components.js'
import { categoryIcon, icon } from './icons.js'
import {
  jsonLdProduct,
  jsonLdBreadcrumb,
  jsonLdItemList,
  jsonLdArticle,
  jsonLdFaq,
} from './seo.js'
import { ARTICLES } from './content.js'

const weightLabel = (p) =>
  !p.weightG ? '' : p.weightG >= 1000 ? `${String(p.weightG / 1000).replace(/\.0$/, '')} кг` : `${p.weightG} г`

// ---------- Головна ----------
export function homePage({ categories, hits, novelties, sales }) {
  const catCards = categories
    .map(
      (c) => `
    <a class="cat-card" href="${categoryPath(c)}">
      <span class="cat-card__ico">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy" width="64" height="64" />` : categoryIcon(c)}</span>
      <span class="cat-card__title">${esc(c.title)}</span>
    </a>`,
    )
    .join('')

  const promo = `
  <section class="promo-wrap"><div class="container">
    <div class="promo">
      <div class="promo__content">
        <span class="promo__eyebrow">✨ ${esc(site.name)}</span>
        <h2 class="promo__title">${esc(site.tagline)}</h2>
        <p class="promo__sub">${esc(site.description)}</p>
        <a class="btn btn--light btn--lg" href="/catalog">Перейти до каталогу →</a>
      </div>
      <div class="promo__show promo__show--logo"><img class="promo__logo" src="/assets/img/logo.png" alt="${esc(site.name)}" loading="lazy" width="200" height="200" /></div>
    </div>
  </div></section>`

  const features = `
  <section class="features-wrap"><div class="container features">
    <div class="feature"><span class="feature__ico">🚚</span><div><strong>Швидка доставка</strong><span class="muted small">Новою Поштою по Україні</span></div></div>
    <div class="feature"><span class="feature__ico">🍫</span><div><strong>Широкий асортимент</strong><span class="muted small">Сотні смаколиків</span></div></div>
    <div class="feature"><span class="feature__ico">✅</span><div><strong>Якість</strong><span class="muted small">Свіжі товари</span></div></div>
    <div class="feature"><span class="feature__ico">💳</span><div><strong>Зручна оплата</strong><span class="muted small">Карткою або при отриманні</span></div></div>
  </div></section>`

  const body = `
  ${promo}
  ${section('Категорії', `<div class="cat-grid">${catCards}</div>`)}
  ${features}
  ${hits.length ? section('⭐ Хіти продажів', productGrid(hits), { link: { href: '/catalog', label: 'Усі товари' } }) : ''}
  ${sales.length ? section('🔥 Акції', productGrid(sales), { link: { href: '/catalog', label: 'Усі товари' } }) : ''}
  ${novelties.length ? section('✨ Новинки', productGrid(novelties), { link: { href: '/catalog', label: 'Усі товари' } }) : ''}
  ${seoTextBlock()}`

  return layout(body, {
    active: '/',
    navCategories: categories,
    activeCatId: null,
    meta: { title: '', description: site.description, canonical: '/' },
    jsonLd: [jsonLdItemList([...hits, ...novelties].slice(0, 10))],
  })
}

function seoTextBlock() {
  return `
  <section class="section seo-text">
    <div class="container">
      <h2>${esc(site.name)} — купити солодощі онлайн в Україні</h2>
      <p>${esc(site.name)} — це зручний інтернет-магазин солодощів із доставкою. У нас ви знайдете шоколад, льодяники, мармелад, жувальні цукерки та подарункові набори на будь-який смак та бюджет.</p>
      <p>Замовляйте прямо на сайті або через <a href="${esc(botLink())}" rel="nofollow">Telegram</a> — ми швидко підтвердимо замовлення та відправимо його Новою Поштою.</p>
    </div>
  </section>`
}

// ---------- Каталог ----------
export function catalogPage({ categories, products, activeCategory, query }) {
  const crumbs = [
    { name: 'Головна', url: '/' },
    { name: 'Каталог', url: '/catalog' },
  ]
  if (activeCategory) crumbs.push({ name: activeCategory.title, url: categoryPath(activeCategory) })
  const title = activeCategory ? activeCategory.title : query ? `Пошук: ${query}` : 'Каталог солодощів'
  const canonical = activeCategory ? categoryPath(activeCategory) : '/catalog'
  const activeId = activeCategory ? activeCategory.id : null

  const prices = products.map((p) => priceNumber(p.salePrice != null ? p.salePrice : p.price)).filter((n) => n > 0)
  const maxP = prices.length ? Math.ceil(Math.max(...prices)) : 1000
  const minP = prices.length ? Math.floor(Math.min(...prices)) : 0

  const catList = `
    <a class="cat-list__item${!activeId ? ' is-active' : ''}" href="/catalog">${icon('grid')}<span>Усі товари</span></a>
    ${categories
      .map(
        (c) =>
          `<a class="cat-list__item${activeId === c.id ? ' is-active' : ''}" href="${categoryPath(c)}">${categoryIcon(c)}<span>${esc(c.title)}</span></a>`,
      )
      .join('')}`

  const aside = `
  <aside class="catalog__side">
    <div class="filter-card">
      <h3 class="filter-card__title">Категорії</h3>
      <nav class="cat-list">${catList}</nav>
    </div>
    <div class="filter-card">
      <h3 class="filter-card__title">Ціна, ₴</h3>
      <div class="price-filter">
        <div class="price-filter__row">
          <input type="number" id="priceMin" value="${minP}" min="${minP}" max="${maxP}" aria-label="Мін. ціна" />
          <span class="muted">—</span>
          <input type="number" id="priceMax" value="${maxP}" min="${minP}" max="${maxP}" aria-label="Макс. ціна" />
        </div>
        <input type="range" id="priceRange" min="${minP}" max="${maxP}" value="${maxP}" />
        <button class="btn btn--ghost btn--block" id="priceApply" type="button">Застосувати</button>
      </div>
    </div>
    <div class="filter-card">
      <h3 class="filter-card__title">Сортування</h3>
      <select id="sortSelect" class="select">
        <option value="pop">Спочатку популярні</option>
        <option value="price-asc">Спочатку дешевші</option>
        <option value="price-desc">Спочатку дорожчі</option>
        <option value="rating">За рейтингом</option>
      </select>
    </div>
  </aside>`

  const body = `
  ${breadcrumbs(crumbs)}
  <section class="section">
    <div class="container">
      <h1 class="page-title">${esc(title)}</h1>
      <div class="catalog">
        ${aside}
        <div class="catalog__main">
          <div class="toolbar">
            <span class="result-count">Знайдено: <span id="resultCount">${products.length}</span></span>
          </div>
          ${productGrid(products, 'Нічого не знайдено. Спробуйте інший запит або категорію.', { id: 'productGrid' })}
        </div>
      </div>
    </div>
  </section>`
  return layout(body, {
    active: '/catalog',
    navCategories: categories,
    activeCatId: activeId,
    meta: {
      title,
      description: activeCategory
        ? `${activeCategory.title} — купити в ${site.name}. Доставка по Україні.`
        : `Каталог солодощів ${site.name}: шоколад, льодяники, мармелад, подарункові набори.`,
      canonical,
    },
    jsonLd: [jsonLdBreadcrumb(crumbs), jsonLdItemList(products.slice(0, 20))],
  })
}

// ---------- Картка товару ----------
export function productPage({ product, related, reviews, categories = [], user = null, views = null, keywords = null }) {
  const p = product
  const crumbs = [
    { name: 'Головна', url: '/' },
    { name: 'Каталог', url: '/catalog' },
  ]
  if (p.category) crumbs.push({ name: p.category.title, url: categoryPath({ id: p.categoryId, title: p.category.title }) })
  crumbs.push({ name: p.title, url: p.path })

  const gallery = p.images && p.images.length ? p.images : p.image ? [p.image] : []
  const thumbs =
    gallery.length > 1
      ? `<div class="gallery__thumbs">${gallery
          .map((src, i) => `<button class="gallery__thumb${i === 0 ? ' is-active' : ''}" data-src="${esc(src)}" type="button"><img src="${esc(src)}" alt="${esc(p.title)} — фото ${i + 1}" loading="lazy" /></button>`)
          .join('')}</div>`
      : ''
  const mainMedia = gallery.length
    ? `<img id="galleryMain" class="gallery__main" src="${esc(gallery[0])}" alt="${esc(p.title)}" width="600" height="600" />`
    : `<div class="gallery__main gallery__main--ph">🍬</div>`
  const video = p.video
    ? `<video class="gallery__video" src="${esc(p.video)}" controls preload="none" playsinline></video>`
    : ''

  const n = Math.abs(Number(p.id) || 1)
  const hasReviews = !!(reviews && reviews.count)
  const rating = hasReviews ? reviews.avg : null
  const ratingCount = hasReviews ? reviews.count : 0
  const stats = []
  if (views != null && views > 0) stats.push(`<span class="stat">👁 Переглядів: <strong>${views}</strong></span>`)
  if (p.orderCount > 0) stats.push(`<span class="stat">🛒 Куплено разів: <strong>${p.orderCount}</strong></span>`)
  const statsHtml = stats.length ? `<div class="product__stats">${stats.join('')}</div>` : ''
  const weight = weightLabel(p)
  const hit = (p.orderCount || 0) >= 30

  const badges = []
  if (p.discount) badges.push(`<span class="badge badge--sale">-${p.discount}%</span>`)
  if (hit) badges.push(`<span class="badge badge--hit">🔥 Хіт продажів</span>`)
  const badgesHtml = badges.length ? `<div class="product__badges">${badges.join('')}</div>` : ''

  const specs = []
  if (p.weightG) specs.push(['Вага', weight])
  if (p.unitsPerPack) specs.push(['Шт. в упако����і', `${p.unitsPerPack}`])
  if (p.flavors && p.flavors.length) specs.push(['Смаки', p.flavors.join(', ')])
  if (p.countryOfOrigin) specs.push(['Країна', p.countryOfOrigin])
  if (p.shelfLife) specs.push(['Термін придатності', p.shelfLife])
  const specsTable = specs.length
    ? `<table class="specs">${specs.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`
    : '<p class="muted">Характеристики уточнюються.</p>'

  const compose = []
  if (p.calories) compose.push(['Калорійність', `${p.calories} ккал / 100г`])
  if (p.proteins != null) compose.push(['Білки', `${p.proteins} г`])
  if (p.fats != null) compose.push(['Жири', `${p.fats} г`])
  if (p.carbs != null) compose.push(['Вуглеводи', `${p.carbs} г`])
  if (p.flavors && p.flavors.length) compose.push(['Смаки', p.flavors.join(', ')])
  const composeTable = compose.length
    ? `<table class="specs">${compose.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</table>`
    : '<p class="muted">Склад та поживність уточнюються.</p>'

  const reviewsItems =
    reviews && reviews.count
      ? `<div class="reviews">${reviews.reviews
          .map(
            (r) =>
              `<div class="review"><div class="review__head">${stars(r.rating)} <strong>${esc(r.name)}</strong></div>${r.text ? `<p>${esc(r.text)}</p>` : ''}</div>`,
          )
          .join('')}</div>`
      : '<p class="muted">Відгуків поки немає. Будьте першим!</p>'
  const reviewForm = user
    ? `<form class="review-form" method="post" action="/product/${p.id}/review" style="margin-top:16px;padding-top:16px;border-top:1px solid #8884">
        <h4 style="margin:0 0 10px">Залишити відгук</h4>
        <label style="display:block;margin-bottom:8px">Оцінка:
          <select name="rating" style="padding:7px 10px;border-radius:9px;border:1px solid #8888;background:transparent;color:inherit;font:inherit">
            <option value="5">★★★★★ (5)</option>
            <option value="4">★★★★ (4)</option>
            <option value="3">★★★ (3)</option>
            <option value="2">★★ (2)</option>
            <option value="1">★ (1)</option>
          </select>
        </label>
        <textarea name="text" rows="3" maxlength="1000" placeholder="Ваші враження про товар…" style="width:100%;padding:10px;border-radius:10px;border:1px solid #8888;background:transparent;color:inherit;font:inherit"></textarea>
        <button class="btn btn--primary" type="submit" style="margin-top:10px">Надіслати відгук</button>
      </form>`
    : `<p class="muted" style="margin-top:16px;padding-top:16px;border-top:1px solid #8884">Щоб залишити відгук, <a href="/account">увійдіть через Telegram</a>.</p>`
  const reviewsList = reviewsItems + reviewForm

  const descHtml = p.fullDescription || p.description
    ? `<p>${esc(p.fullDescription || p.description)}</p>`
    : '<p class="muted">Опис уточнюється.</p>'

  const tabs = [
    { id: 'desc', label: 'Опис', html: descHtml },
    { id: 'compose', label: 'Склад', html: composeTable },
    { id: 'specs', label: 'Характеристики', html: specsTable },
    { id: 'reviews', label: ratingCount ? `Відгуки (${ratingCount})` : 'Відгуки', html: reviewsList },
  ]
  const tabsHtml = `
  <div class="tabs" id="productTabs">
    <div class="tabs__head" role="tablist">
      ${tabs.map((t, i) => `<button class="tab${i === 0 ? ' is-active' : ''}" data-tab="${t.id}" type="button" role="tab">${esc(t.label)}</button>`).join('')}
    </div>
    ${tabs.map((t, i) => `<div class="tabpanel${i === 0 ? ' is-active' : ''}" data-panel="${t.id}">${t.html}</div>`).join('')}
  </div>`

  const packsHtml =
    p.packs && p.packs.length
      ? `<div class="packs" id="packs">${p.packs
          .map(
            (pk, i) =>
              `<button type="button" class="pack${i === 0 ? ' is-active' : ''}" data-pack="${esc(pk.label)}" data-price="${pk.price != null ? priceNumber(pk.price) : ''}">${esc(pk.label)}${pk.price != null ? ` · ${price(pk.price)}` : ''}</button>`,
          )
          .join('')}</div>`
      : ''

  const priceVal = priceNumber(p.salePrice != null ? p.salePrice : p.price)
  const favBtn = `<button class="product__fav" type="button" data-fav="${p.id}" data-fav-title="${esc(p.title)}" data-fav-image="${esc(p.image || '')}" data-fav-price="${priceVal}" data-fav-path="${esc(p.path)}" aria-label="В обране">♡</button>`

  const body = `
  ${breadcrumbs(crumbs)}
  <section class="section product">
    <div class="container product__grid">
      <div class="gallery">
        ${badgesHtml}
        ${mainMedia}
        ${thumbs}
        ${video}
      </div>
      <div class="product__info">
        ${p.category ? `<a class="product__cat" href="${categoryPath({ id: p.categoryId, title: p.category.title })}">${categoryIcon(p.category)} ${esc(p.category.title)}</a>` : ''}
        <h1 class="product__title">${esc(p.title)}</h1>
        ${hasReviews ? `<div class="product__rating">${stars(rating)} <span class="muted">${Number(rating).toFixed(1)} (${ratingCount} відгуків)</span></div>` : '<div class="product__rating"><span class="muted">Ще немає відгуків</span></div>'}
        ${statsHtml}
        <div class="product__price" id="productPrice" data-unit-price="${priceVal}">${priceBlock(p)}${weight ? `<span class="price__unit">/ ${esc(weight)}</span>` : ''}</div>
        ${packsHtml}
        <div class="product__actions">
          <div class="qty" data-qty>
            <button type="button" class="qty__btn" data-qty-dec aria-label="Менше">−</button>
            <input class="qty__input" id="qtyInput" type="number" value="1" min="1" max="99" inputmode="numeric" />
            <button type="button" class="qty__btn" data-qty-inc aria-label="Більше">+</button>
          </div>
          ${p.available ? `<button class="btn btn--primary btn--lg" id="addToCart" data-add="${p.id}" type="button">Додати в кошик</button>` : `<button class="btn btn--ghost btn--lg" disabled>Немає �� наявності</button>`}
          ${favBtn}
        </div>
        <a class="product__tg" href="${esc(botLink())}" rel="nofollow">✈️ Купити через Telegram</a>
        ${tabsHtml}
      </div>
    </div>
  </section>
  ${related && related.length ? section('Рекомендуємо також', productGrid(related)) : ''}`

  const metaDesc = clamp(p.description || p.fullDescription || `${p.title} — купити в ${site.name}. Ціна ${price(p.effectivePrice)}. Доставка по Україні.`, 290)
  return layout(body, {
    active: '/catalog',
    navCategories: categories,
    activeCatId: p.categoryId,
    meta: {
      title: p.title,
      description: metaDesc,
      canonical: p.path,
      image: p.imageLarge || p.image,
      type: 'product',
      keywords: keywords || undefined,
    },
    jsonLd: [jsonLdBreadcrumb(crumbs), jsonLdProduct(p, { reviews })],
  })
}

// ---------- Обране ----------
export function favoritesPage() {
  const body = `
  ${breadcrumbs([{ name: 'Головна', url: '/' }, { name: 'Обране', url: '/favorites' }])}
  <section class="section"><div class="container">
    <h1 class="page-title">Обране</h1>
    <div class="grid grid--products" id="favList"></div>
    <div class="empty-state" id="favEmpty" hidden>
      <div class="empty-state__emoji">♡</div>
      <h2>У обраному поки порожньо</h2>
      <p class="muted">Натисніть ♡ на будь-якому товарі, щоб зберегти його тут.</p>
      <a class="btn btn--primary btn--lg" href="/catalog">До каталогу</a>
    </div>
  </div></section>`
  return layout(body, {
    active: '/favorites',
    meta: { title: 'Обране', canonical: '/favorites', noindex: true },
  })
}

// ---------- Кошик ----------
export function cartPage({ cart }) {
  const rows = cart.items
    .map(
      (i) => `
    <tr class="cart-row" data-id="${i.id}"${i.packLabel ? ` data-pack="${esc(i.packLabel)}"` : ''}>
      <td class="cart-row__product">
        <a href="${esc(i.path)}">${i.image ? `<img src="${esc(i.image)}" alt="${esc(i.title)}" width="64" height="64" loading="lazy" />` : ''}<span>${esc(i.title)}${i.packLabel ? ` <small>(${esc(i.packLabel)})</small>` : ''}</span></a>
      </td>
      <td class="cart-row__price">${price(i.unitPrice)}</td>
      <td class="cart-row__qty">
        <div class="qty" data-qty>
          <button type="button" class="qty__btn" data-cart-dec aria-label="Менше">−</button>
          <input class="qty__input" type="number" value="${i.qty}" min="1" max="99" data-cart-qty />
          <button type="button" class="qty__btn" data-cart-inc aria-label="Більше">+</button>
        </div>
      </td>
      <td class="cart-row__total" data-line-total>${price(i.lineTotal)}</td>
      <td class="cart-row__remove"><button class="link-del" data-cart-remove type="button" aria-label="Видалити">✕</button></td>
    </tr>`,
    )
    .join('')

  const body = cart.items.length
    ? `
  <section class="section">
    <div class="container">
      <h1 class="page-title">Кошик</h1>
      <div class="cart">
        <table class="cart-table">
          <thead><tr><th>Товар</th><th>Ціна</th><th>К-ть</th><th>Сума</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="cart-summary">
          <div class="cart-summary__row"><span>Разом:</span><strong id="cartTotal">${price(cart.total)}</strong></div>
          <a class="btn btn--primary btn--lg btn--block" href="/checkout">Оформити замовлення</a>
          <a class="btn btn--ghost btn--block" href="/catalog">Продовжити покупки</a>
        </div>
      </div>
    </div>
  </section>`
    : `
  <section class="section">
    <div class="container empty-state">
      <div class="empty-state__emoji">🛒</div>
      <h1>Кошик порожній</h1>
      <p class="muted">Додайте смаколики з каталогу.</p>
      <a class="btn btn--primary btn--lg" href="/catalog">До каталогу</a>
    </div>
  </section>`

  return layout(body, {
    active: '/cart',
    meta: { title: 'Кошик', canonical: '/cart', noindex: true },
  })
}

// ---------- Оформлення ----------
export function checkoutPage({ cart, values = {}, error = null, user = null }) {
  if (!cart.items.length) {
    return layout(
      `<section class="section"><div class="container empty-state"><div class="empty-state__emoji">🛒</div><h1>Кошик порожній</h1><a class="btn btn--primary btn--lg" href="/catalog">До каталогу</a></div></section>`,
      { active: '/checkout', meta: { title: 'Оформлення', canonical: '/checkout', noindex: true } },
    )
  }
  const summary = cart.items
    .map(
      (i) =>
        `<li><span>${esc(i.title)}${i.packLabel ? ` (${esc(i.packLabel)})` : ''} × ${i.qty}</span><span>${price(i.lineTotal)}</span></li>`,
    )
    .join('')
  const widgetName = site.botUsername
  let authBlock = ''
  if (user) {
    const uname = user.first_name || user.username || 'Telegram'
    authBlock = `
      <div class="tg-auth tg-auth--in">
        <span class="tg-auth__badge">✅ Ви увійшли як <strong>${esc(uname)}</strong>${user.username ? ` (@${esc(user.username)})` : ''}</span>
        <a class="tg-auth__logout" href="/auth/logout?next=/checkout">Вийти</a>
        <p class="muted small">Менеджер напише вам у Telegram щодо цього замовлення.</p>
      </div>`
  } else if (widgetName) {
    authBlock = `
      <div class="tg-auth">
        <h2 class="tg-auth__title">Увійдіть через Telegram</h2>
        <p class="muted small">Щоб ми могли підтвердити замо��лення та спілкуватися з вами у боті.</p>
        <script async src="https://telegram.org/js/telegram-widget.js?22"
          data-telegram-login="${esc(widgetName)}"
          data-size="large"
          data-radius="12"
          data-request-access="write"
          data-auth-url="/auth/telegram/callback?next=/checkout"></script>
        <p class="muted small">Або оформіть як гість — заповніть форму нижче.</p>
      </div>`
  }
  const body = `
  <section class="section">
    <div class="container">
      <h1 class="page-title">Оформлення замовлення</h1>
      ${error ? `<div class="alert alert--error">${esc(error)}</div>` : ''}
      <div class="checkout">
        <form class="checkout__form" method="post" action="/checkout" id="checkoutForm">
          ${authBlock}
          <label>Ім'я та прізвище *<input name="fullName" required value="${esc(values.fullName || user?.first_name || '')}" autocomplete="name" /></label>
          <label>Телефон *<input name="phone" required type="tel" value="${esc(values.phone || '')}" placeholder="+380..." autocomplete="tel" /></label>
          <label>Email<input name="email" type="email" value="${esc(values.email || '')}" autocomplete="email" /></label>
          <label>Адреса доставки (місто, відділення НП) *<input name="address" required value="${esc(values.address || '')}" autocomplete="street-address" /></label>
          <label>Коментар до замовлення<textarea name="comment" rows="3">${esc(values.comment || '')}</textarea></label>
          <button class="btn btn--primary btn--lg btn--block" type="submit">Підтвердити замовлення</button>
          <p class="muted small">Натискаючи кнопку, ви погоджуєтесь, що менеджер зв'яжеться з вами для підтвердження.</p>
        </form>
        <aside class="checkout__summary">
          <h2>Ваше замовлення</h2>
          <ul class="order-list">${summary}</ul>
          <div class="cart-summary__row total"><span>Разом:</span><strong>${price(cart.total)}</strong></div>
        </aside>
      </div>
    </div>
  </section>`
  return layout(body, {
    active: '/checkout',
    meta: { title: 'Оформлення замовлення', canonical: '/checkout', noindex: true },
  })
}

// ---------- Кабінет / Профіль ----------
export function accountPage({ user = null, isAdmin = false }) {
  const widgetName = site.botUsername
  let body
  if (user) {
    const uname = user.first_name || user.username || 'Telegram'
    body = `
  <section class="section">
    <div class="container account">
      <h1 class="page-title">Мій кабінет</h1>
      <div class="tg-auth tg-auth--in">
        <span class="tg-auth__badge">✅ Ви увійшли як <strong>${esc(uname)}</strong>${user.username ? ` (@${esc(user.username)})` : ''}</span>
      </div>
      ${isAdmin ? `<div class="account__links" style="margin-bottom:10px"><a class="btn btn--primary" href="/admin">🛠 Адмін-панель</a></div>` : ''}
      <div class="account__links">
        <a class="btn btn--primary" href="/catalog">До каталогу</a>
        <a class="btn btn--ghost" href="/favorites">Обране</a>
        <a class="btn btn--ghost" href="/cart">Кошик</a>
        <a class="btn btn--ghost" href="/auth/logout?next=/account">Вийти</a>
      </div>
      <p class="muted small">Менеджер пише вам у Telegram щодо ваших замовлень.</p>
    </div>
  </section>`
  } else if (widgetName) {
    body = `
  <section class="section">
    <div class="container account">
      <h1 class="page-title">Вхід до кабінету</h1>
      <div class="tg-auth">
        <h2 class="tg-auth__title">Увійдіть через Telegram</h2>
        <p class="muted small">Щоб зберігати контакти та швидше оформлювати замовлення.</p>
        <script async src="https://telegram.org/js/telegram-widget.js?22"
          data-telegram-login="${esc(widgetName)}"
          data-size="large"
          data-radius="12"
          data-request-access="write"
          data-auth-url="/auth/telegram/callback?next=/account"></script>
      </div>
      <p class="muted small">Не обов'язково — кошик і обране працюють без входу.</p>
    </div>
  </section>`
  } else {
    body = `
  <section class="section">
    <div class="container account empty-state">
      <div class="empty-state__emoji">👤</div>
      <h1>Кабінет</h1>
      <p class="muted">Вхід через Telegram тимчасово недоступний.</p>
      <a class="btn btn--primary" href="/catalog">До каталогу</a>
    </div>
  </section>`
  }
  return layout(body, {
    active: '/account',
    meta: { title: 'Мій кабінет', canonical: '/account', noindex: true },
  })
}

// ---------- Успіх ----------
export function successPage({ orderId }) {
  const body = `
  <section class="section">
    <div class="container empty-state">
      <div class="empty-state__emoji">✅</div>
      <h1>Дякуємо за замовлення!</h1>
      <p class="muted">Замовлення № ${esc(orderId)} прийнято. Менеджер зв'яжеться з вами найближчим часом для підтвердження.</p>
      <a class="btn btn--primary btn--lg" href="/catalog">Продовжити покупки</a>
    </div>
  </section>`
  return layout(body, { active: '', meta: { title: 'Замовлення прийнято', canonical: '/order/success', noindex: true } })
}

// ---------- Блог ----------
export function blogPage() {
  const cards = ARTICLES.map(
    (a) => `
    <article class="post-card">
      <a href="/blog/${esc(a.slug)}">
        ${a.cover ? `<img src="${esc(a.cover)}" alt="${esc(a.title)}" loading="lazy" width="400" height="220" />` : ''}
        <h2>${esc(a.title)}</h2>
      </a>
      <p class="muted">${esc(a.excerpt)}</p>
      <a class="section__more" href="/blog/${esc(a.slug)}">Читати →</a>
    </article>`,
  ).join('')
  const body = `
  ${breadcrumbs([{ name: 'Головна', url: '/' }, { name: 'Блог', url: '/blog' }])}
  <section class="section"><div class="container">
    <h1 class="page-title">Блог про солодощі</h1>
    <div class="grid grid--posts">${cards}</div>
  </div></section>`
  return layout(body, {
    active: '/blog',
    meta: { title: 'Блог', description: `Корисні статті про солодощі, подарунки та смаколики від ${site.name}.`, canonical: '/blog' },
    jsonLd: [jsonLdBreadcrumb([{ name: 'Головна', url: '/' }, { name: 'Блог', url: '/blog' }])],
  })
}

export function articlePage(a) {
  const crumbs = [
    { name: 'Головна', url: '/' },
    { name: 'Блог', url: '/blog' },
    { name: a.title, url: `/blog/${a.slug}` },
  ]
  const body = `
  ${breadcrumbs(crumbs)}
  <article class="section article"><div class="container article__inner">
    <h1 class="article__title">${esc(a.title)}</h1>
    <p class="article__meta muted">${esc(new Date(a.date).toLocaleDateString('uk-UA'))}</p>
    ${a.cover ? `<img class="article__cover" src="${esc(a.cover)}" alt="${esc(a.title)}" width="800" height="400" />` : ''}
    <div class="article__body">${a.body}</div>
    <a class="btn btn--ghost" href="/blog">← Усі статті</a>
  </div></article>`
  return layout(body, {
    active: '/blog',
    meta: { title: a.title, description: a.excerpt, canonical: `/blog/${a.slug}`, image: a.cover, type: 'article' },
    jsonLd: [jsonLdBreadcrumb(crumbs), jsonLdArticle(a)],
  })
}

// ---------- Інфо-сторінка ----------
export function infoPage(pageData, activeHref = '') {
  const crumbs = [
    { name: 'Головна', url: '/' },
    { name: pageData.title, url: `/${pageData.slug}` },
  ]
  const faqHtml =
    pageData.faq && pageData.faq.length
      ? `<div class="faq"><h2>Часті запитання</h2>${pageData.faq
          .map((f) => `<details class="faq__item"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
          .join('')}</div>`
      : ''
  const body = `
  ${breadcrumbs(crumbs)}
  <section class="section"><div class="container prose">
    <h1 class="page-title">${esc(pageData.title)}</h1>
    ${pageData.body}
    ${faqHtml}
  </div></section>`
  const jsonLd = [jsonLdBreadcrumb(crumbs)]
  if (pageData.faq && pageData.faq.length) jsonLd.push(jsonLdFaq(pageData.faq))
  return layout(body, {
    active: activeHref,
    meta: { title: pageData.title, description: pageData.description, canonical: `/${pageData.slug}` },
    jsonLd,
  })
}

// ---------- 404 ----------
export function notFoundPage() {
  const body = `
  <section class="section"><div class="container empty-state">
    <div class="empty-state__emoji">🍬</div>
    <h1>Сторінку не знайдено</h1>
    <p class="muted">Можливо, вона була переміщена або видалена.</p>
    <a class="btn btn--primary btn--lg" href="/">На головну</a>
  </div></section>`
  return layout(body, { active: '', meta: { title: '404', canonical: '/404', noindex: true } })
}
