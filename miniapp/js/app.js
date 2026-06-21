import { TG } from './telegram.js'
import { API } from './api.js'
import { store, fmt } from './store.js'
import { searchSettlements } from './odesa.js'

const appEl = document.getElementById('app')
const tabbar = document.getElementById('tabbar')
const cartBadge = document.getElementById('cartBadge')

// ---------- утиліти ----------
const h = (html) => html
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]),
  )
}
function el(html) {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstElementChild
}
const PLACEHOLDER =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="%23241327"/><text x="50%" y="50%" font-size="64" text-anchor="middle" dy=".35em">🍬</text></svg>',
  )
const img = (src) => src || PLACEHOLDER

// ---------- роутер ----------
const routes = {}
function route(name, fn) {
  routes[name] = fn
}
function parseHash() {
  const raw = (location.hash || '#home').slice(1)
  const [name, ...rest] = raw.split('/')
  return { name: name || 'home', param: rest.join('/') }
}
async function render() {
  const { name, param } = parseHash()
  const fn = routes[name] || routes.home
  TG.hideMainButton()
  appEl.scrollTop = 0
  window.scrollTo(0, 0)
  try {
    await fn(param)
  } catch (e) {
    appEl.innerHTML = errorView(e)
  }
  syncTabs(name)
}
function go(hash) {
  location.hash = hash
}
window.addEventListener('hashchange', render)

function syncTabs(active) {
  tabbar.querySelectorAll('.tab').forEach((t) => {
    t.classList.toggle('active', t.dataset.route === active)
  })
}
tabbar.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    TG.haptic('light')
    go(t.dataset.route)
  })
})

function updateCartBadge() {
  const c = store.cart.count
  cartBadge.textContent = c
  cartBadge.classList.toggle('hidden', !c)
}
store.subscribe(updateCartBadge)

// ============ VIEWS ============

function errorView(e) {
  return `<div class="screen"><div class="empty"><div class="empty__ic">⚠️</div>
    <p>Не вдалося завантажити дані.</p>
    <p class="muted small">${esc(e.message)}</p>
    <button class="btn btn--primary" onclick="location.reload()">Оновити</button></div></div>`
}

// ---------- ГОЛОВНА ----------
let catsExpanded = false
const CATS_LIMIT = 8
route('home', async () => {
  const newest = [...store.products]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 6)
  const topOrdered = [...store.products]
    .filter((p) => p.orderCount > 0)
    .sort((a, b) => b.orderCount - a.orderCount)
    .slice(0, 6)
  const hits = topOrdered.length
    ? topOrdered
    : store.products.filter((p) => p.discount).slice(0, 6)
  appEl.innerHTML = `
    <header class="appbar">
      <div class="logo">Wow<span>Smak</span></div>
      <div class="appbar__actions">
        <button class="appbar__cart" data-go="support" title="Питання">💬</button>
        <button class="appbar__cart" data-go="cart">🛒</button>
      </div>
    </header>
    <div class="screen">
      <div class="hero">
        <div class="hero__txt">
          <h1>СМАКУЙ.<br/>ДИВУЙ, ДІЛИСЬ!</h1>
          <button class="btn btn--primary" data-go="catalog">До каталогу →</button>
        </div>
        <img class="hero__logo" src="img/logo.png" alt="WowSmak"/>
      </div>

      <div class="cats-grid">
        ${store.categories
          .map(
            (c, i) =>
              `<button class="cat-chip${c.image ? ' cat-chip--photo' : ''}${!catsExpanded && i >= CATS_LIMIT ? ' cat-chip--hidden' : ''}" data-cat="${c.id}">${c.image ? `<span class="cat-chip__img" style="background-image:url('${c.image}')"></span>` : `<span class="cat-chip__emoji">${c.emoji || '🍬'}</span>`}<span class="cat-chip__title">${esc(c.title)}</span></button>`,
          )
          .join('')}
      </div>
      ${store.categories.length > CATS_LIMIT ? `<button class="cats-toggle" data-cats-toggle>${catsExpanded ? '▲ Згорнути категорії' : `▾ Показати всі категорії (${store.categories.length})`}</button>` : ''}

      ${section('🔥 Хіти продажів', hits.length ? hits : newest)}
      ${section('✨ Новинки', newest)}
    </div>`
  const catsToggle = appEl.querySelector('[data-cats-toggle]')
  if (catsToggle)
    catsToggle.addEventListener('click', () => {
      catsExpanded = !catsExpanded
      TG.haptic('light')
      render()
    })
  bindCommon()
})

function section(title, products) {
  if (!products.length) return ''
  return `<section class="sect">
    <div class="sect__head"><h2>${title}</h2><button class="link" data-go="catalog">Всі</button></div>
    <div class="row-scroll">
      ${products.map((p) => cardSmall(p)).join('')}
    </div></section>`
}

function badgePurchased(p) {
  return store.hasPurchased(p.id) ? `<span class="badge badge--bought">✓ Брали</span>` : ''
}

function cardSmall(p) {
  return `<article class="pcard pcard--sm${outOfStock(p) ? ' pcard--out' : ''}" data-prod="${p.id}">
    <div class="pcard__media">
      <img src="${img(p.image)}" alt="" loading="lazy"/>
      ${p.discount ? `<span class="badge badge--sale">-${p.discount}%</span>` : ''}
      ${badgeStock(p)}
      ${badgePurchased(p)}
    </div>
    <div class="pcard__body">
      <div class="pcard__titleRow">
        <div class="pcard__title">${esc(p.title)}</div>
        <button class="fav-btn fav-btn--inline${store.isFav(p.id) ? ' on' : ''}" data-fav="${p.id}">${store.isFav(p.id) ? '❤️' : '🤍'}</button>
      </div>
      <div class="pcard__priceRow">
        ${priceHtml(p)}
        <button class="pcard__add pcard__add--mini" data-add="${p.id}" ${outOfStock(p) ? 'disabled' : ''}>+</button>
      </div>
    </div>
  </article>`
}

function badgeStock(p) {
  if (outOfStock(p)) return `<span class="badge badge--out">Немає в наявності</span>`
  if (lowStock(p)) return `<span class="badge badge--low">Закінчується</span>`
  return ''
}
function outOfStock(p) {
  return p.stock != null && p.stock <= 0
}
function lowStock(p) {
  return p.stock != null && p.stock > 0 && p.stock < 3
}
function starsHtml(rating, interactive = false) {
  return [1,2,3,4,5].map(i => {
    const cls = 'star' + (i <= Math.round(rating || 0) ? ' star--on' : '')
    return interactive
      ? `<span class="${cls}" data-star="${i}">&#9733;</span>`
      : `<span class="${cls}">&#9733;</span>`
  }).join('')
}
function parseCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).map(l => {
    const vals = l.split(',')
    return Object.fromEntries(headers.map((h,i) => [h.trim(), (vals[i]||'').trim()]))
  })
}
function priceHtml(p) {
  if (p.salePrice != null) {
    return `<span class="price price--sale">${fmt(p.salePrice)}</span><span class="price price--old">${fmt(p.price)}</span>`
  }
  return `<span class="price">${fmt(p.price)}</span>`
}

// Ціна з двома знаками (для ціни за штуку)
function fmt2(n) {
  return `${Number(n || 0).toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₴`
}

// Ціна за штуку = ціна упаковки ÷ кількість (якщо задано)
function perUnitHtml(p, unitPrice) {
  if (!p.unitsPerPack) return ''
  return `<div class="perunit">
    <span class="perunit__price" id="perUnitPrice">≈ ${fmt2(unitPrice / p.unitsPerPack)}/шт</span>
    <span class="perunit__hint">в упаковці ${p.unitsPerPack} шт</span>
  </div>`
}

// Смаки (вкуси) — просто інформація
function flavorsHtml(p) {
  if (!p.flavors || !p.flavors.length) return ''
  return `<div class="flavors">
    <div class="flavors__label">🍓 Смаки</div>
    <div class="chips">${p.flavors
      .map((f) => `<span class="chip chip--flavor">${esc(f)}</span>`)
      .join('')}</div>
  </div>`
}

// Фасовки — вибір (кожна зі своєю ціною)
function packsHtml(p) {
  if (!p.packs || !p.packs.length) return ''
  return `<div class="packs">
    <div class="packs__label">📦 Фасовка</div>
    <div class="seg">${p.packs
      .map(
        (pk, idx) =>
          `<button class="seg__btn ${idx === 0 ? 'seg--on' : ''}" data-pack="${idx}">${esc(pk.label)}</button>`,
      )
      .join('')}</div>
  </div>`
}

// ---------- КАТАЛОГ ----------
let activeCat = undefined // undefined = ще не обрано (відкриє першу категорію)
let catalogSearch = ''
let catalogSort = 'new'
route('catalog', async () => {
  // При першому відкритті — обираємо першу реальну категорію
  if (activeCat === undefined) {
    activeCat = store.categories.length ? store.categories[0].id : 'new'
  }

  // Псевдо-категорія «Новинки» + реальні категорії
  const cats = [{ id: 'new', title: 'Новинки', emoji: '✨', image: 'img/new.png' }, { id: 'all', title: 'Всі', emoji: '🍬', image: 'img/all.png' }, ...store.categories]

  const list = applyCatalogView(catalogBaseList())

  appEl.innerHTML = `
    <header class="appbar">
      <div class="appbar__title">Каталог</div>
      <button class="appbar__cart" data-go="cart">🛒</button>
    </header>
    <div class="cats-grid-catalog">
      ${cats
        .map(
          (c) =>
            `<button class="cat-chip${c.image ? ' cat-chip--photo' : ''}${activeCat === c.id ? ' cat-chip--on' : ''}" data-filter="${c.id}">${
              c.image
                ? `<span class="cat-chip__img" style="background-image:url('${c.image}')"></span>`
                : `<span class="cat-chip__emoji">${c.emoji || '🍬'}</span>`
            }<span class="cat-chip__title">${esc(c.title)}</span></button>`,
        )
        .join('')}
    </div>
    <div class="screen">
      <div class="toolbar">
        <input class="search" type="search" inputmode="search" placeholder="🔍 Пошук товарів…" value="${esc(catalogSearch)}"/>
        <select class="sort">
          <option value="new"${catalogSort === 'new' ? ' selected' : ''}>Новіші</option>
          <option value="price_asc"${catalogSort === 'price_asc' ? ' selected' : ''}>Дешевші</option>
          <option value="price_desc"${catalogSort === 'price_desc' ? ' selected' : ''}>Дорожчі</option>
          <option value="name"${catalogSort === 'name' ? ' selected' : ''}>За назвою</option>
        </select>
      </div>
      <div class="grid">
        ${list.length ? list.map((p) => cardGrid(p)).join('') : emptyHtml('Нічого не знайдено')}
      </div>
    </div>`

  appEl.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      const v = b.dataset.filter
      // 'new' — рядок, числові id — конвертуємо
      activeCat = v === '' ? null : isNaN(Number(v)) ? v : Number(v)
      TG.haptic('light')
      render()
    }),
  )
  const searchEl = appEl.querySelector('.search')
  if (searchEl)
    searchEl.addEventListener('input', (e) => {
      catalogSearch = e.target.value
      updateCatalogGrid()
    })
  const sortEl = appEl.querySelector('.sort')
  if (sortEl)
    sortEl.addEventListener('change', (e) => {
      catalogSort = e.target.value
      updateCatalogGrid()
    })
  bindCommon()
})

function catalogBaseList() {
  return activeCat === 'new'
    ? [...store.products].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 30)
    : activeCat === 'all' || activeCat == null
      ? store.products
      : store.products.filter((p) => p.categoryId === activeCat)
}

function applyCatalogView(arr) {
  let r = arr
  const q = catalogSearch.trim().toLowerCase()
  if (q) r = r.filter((p) => (p.title || '').toLowerCase().includes(q))
  const pr = (p) => Number(p.effectivePrice ?? p.price ?? 0)
  if (catalogSort === 'price_asc') r = [...r].sort((a, b) => pr(a) - pr(b))
  else if (catalogSort === 'price_desc') r = [...r].sort((a, b) => pr(b) - pr(a))
  else if (catalogSort === 'name') r = [...r].sort((a, b) => (a.title || '').localeCompare(b.title || '', 'uk'))
  return r
}

function updateCatalogGrid() {
  const gridEl = appEl.querySelector('.grid')
  if (!gridEl) return
  const list = applyCatalogView(catalogBaseList())
  gridEl.innerHTML = list.length ? list.map((p) => cardGrid(p)).join('') : emptyHtml('Нічого не знайдено')
  bindGridCards(gridEl)
}

function bindGridCards(root) {
  root.querySelectorAll('[data-prod]').forEach((c) =>
    c.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]') || e.target.closest('[data-fav]')) return
      go('product/' + c.dataset.prod)
    }),
  )
  root.querySelectorAll('[data-add]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number(b.dataset.add)
      const prod = store.productById(id)
      if (prod && prod.packs && prod.packs.length) {
        TG.haptic('light')
        go('product/' + id)
        return
      }
      TG.haptic('light')
      await addToCart(id)
      b.classList.add('added')
      setTimeout(() => b.classList.remove('added'), 600)
    }),
  )
  bindFavBtns(root)
}

function bindFavBtns(root) {
  root.querySelectorAll('[data-fav]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number(b.dataset.fav)
      const on = store.toggleFav(id)
      b.classList.toggle('on', on)
      b.textContent = on ? '❤️' : '🤍'
      TG.haptic('light')
      const prod = store.productById(id)
      if (prod && outOfStock(prod)) {
        try {
          if (on) {
            await API.restockSubscribe(id)
            TG.showAlert(`🔔 Сповістимо вас, щойно «${prod.title}» знову з’явиться в наявності!`)
          } else {
            await API.restockUnsubscribe(id)
          }
        } catch {}
      }
    }),
  )
}

function cardGrid(p) {
  return `<article class="pcard${outOfStock(p) ? ' pcard--out' : ''}" data-prod="${p.id}">
    <div class="pcard__media">
      <img src="${img(p.image)}" alt="" loading="lazy"/>
      ${p.discount ? `<span class="badge badge--sale">-${p.discount}%</span>` : ''}
      ${badgeStock(p)}
      ${badgePurchased(p)}
    </div>
    <div class="pcard__body">
      <div class="pcard__titleRow">
        <div class="pcard__title">${esc(p.title)}</div>
        <div class="pcard__acts">
          <button class="fav-btn fav-btn--inline${store.isFav(p.id) ? ' on' : ''}" data-fav="${p.id}">${store.isFav(p.id) ? '❤️' : '🤍'}</button>
        </div>
      </div>
      <div class="pcard__priceRow">${priceHtml(p)}</div>
    </div>
    <button class="pcard__add" data-add="${p.id}" ${outOfStock(p) ? 'disabled' : ''}>Додати</button>
  </article>`
}

// ---------- КАРТКА ТОВАРУ ----------
route('product', async (id) => {
  let p = store.productById(id)
  if (!p) {
    const r = await API.product(id)
    p = r.product
  }
  const gallery = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean)
  appEl.innerHTML = `
    <header class="appbar appbar--float">
      <button class="appbar__back" data-back>‹</button>
      <div class="appbar__actions">
        <button class="fav-btn fav-btn--lg${store.isFav(p.id) ? ' on' : ''}" data-fav="${p.id}">${store.isFav(p.id) ? '❤️' : '🤍'}</button>
        <button class="appbar__cart" data-go="cart">🛒</button>
      </div>
    </header>
    <div class="screen screen--product">
      <div class="product__media">
        <div class="pgallery" id="pgallery">
          ${gallery.map((g, i) => `<div class="pgallery__slide"><img src="${img(g)}" alt="" ${i === 0 ? '' : 'loading="lazy"'}/></div>`).join('')}
        </div>
        ${gallery.length > 1 ? `<div class="pgallery__dots" id="pdots">${gallery.map((_g, i) => `<span class="${i === 0 ? 'on' : ''}"></span>`).join('')}</div>` : ''}
        ${p.discount ? `<span class="badge badge--sale lg">-${p.discount}%</span>` : ''}
        ${p.video ? `<a class="product__video" href="${esc(p.video)}" target="_blank">▶ Відео</a>` : ''}
      </div>
      ${gallery.length > 1 ? `<div class="gallery">${gallery
        .map(
          (g, i) =>
            `<button class="gallery__thumb ${i === 0 ? 'on' : ''}" data-img="${esc(g)}" style="background-image:url('${img(g)}');background-size:contain;background-repeat:no-repeat;background-position:center"></button>`,
        )
        .join('')}</div>` : ''}
      <div class="product__info">
        <h1>${esc(p.title)}</h1>
        ${p.category ? `<div class="product__cat">${p.category.emoji || ''} ${esc(p.category.title)}</div>` : ''}
        <div class="product__rating" id="productRating"></div>
        ${store.hasPurchased(p.id) ? `<div class="chip chip--bought">✓ Ви вже замовляли</div>` : ''}
        <div class="product__price">${priceHtml(p)}</div>
        ${p.weightG ? `<div class="chip chip--ghost">⚖️ ${p.weightG} г</div>` : ''}
        ${packsHtml(p)}
        ${perUnitHtml(p, p.effectivePrice)}
        ${flavorsHtml(p)}
        <div class="product__stock-row">
          <div class="product__stock ${outOfStock(p) ? 'is-out' : ''}">${
          outOfStock(p) ? 'Немає в наявності' : 'В наявності'
        }</div>
          <button class="product__full-desc-btn" id="productFullDescBtn">📋 Повна інформація <span class="arrow">▸</span></button>
        </div>
        ${p.description ? `<div class="product__short-desc" id="productShortDesc"><p class="product__desc">${esc(p.description)}</p></div>` : ''}
        ${(p.fullDescription || p.proteins != null || p.fats != null || p.calories != null || p.weightG || p.countryOfOrigin || p.shelfLife || p.barcode || p.unitsPerPack) ? `
        <div class="product__full-desc" id="productFullDesc" style="display:none">
          ${(p.proteins != null || p.fats != null || p.carbs != null || p.calories != null) ? `
          <div class="product__nutrition-title">Поживна цінність на 100 г:</div>
          <div class="product__nutrition">
            ${p.calories != null ? `<div class="nutr"><div class="nutr__val">${p.calories}</div><div class="nutr__lbl">ккал</div></div>` : ''}
            ${p.proteins != null ? `<div class="nutr"><div class="nutr__val">${p.proteins}г</div><div class="nutr__lbl">Білки</div></div>` : ''}
            ${p.fats != null ? `<div class="nutr"><div class="nutr__val">${p.fats}г</div><div class="nutr__lbl">Жири</div></div>` : ''}
            ${p.carbs != null ? `<div class="nutr"><div class="nutr__val">${p.carbs}г</div><div class="nutr__lbl">Вуглеводи</div></div>` : ''}
          </div>` : ''}
          <table class="product__chars">
            ${p.weightG ? `<tr><td>Вага</td><td>${p.weightG} г</td></tr>` : ''}
            ${p.countryOfOrigin ? `<tr><td>Країна виробництва</td><td>${esc(p.countryOfOrigin)}</td></tr>` : ''}
            ${p.shelfLife ? `<tr><td>Термін зберігання</td><td>${esc(p.shelfLife)}</td></tr>` : ''}
            ${p.barcode ? `<tr><td>Штрихкод</td><td>${esc(String(p.barcode))}</td></tr>` : ''}
            ${p.unitsPerPack ? `<tr><td>Одиниць в пачці</td><td>${p.unitsPerPack}</td></tr>` : ''}
            ${p.category ? `<tr><td>Категорія</td><td>${esc(p.category.title)}</td></tr>` : ''}
          </table>
          ${p.fullDescription ? `<div class="product__full-desc-text"><p class="product__desc">${esc(p.fullDescription)}</p></div>` : ''}
        </div>` : ''}
      <div class="product__also-bought"></div>
      <div class="product__reviews"></div>
      </div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  ;(function(){
    const btn = appEl.querySelector('#productFullDescBtn')
    if (!btn) return
    btn.addEventListener('click', function() {
      const short = appEl.querySelector('#productShortDesc')
      const full  = appEl.querySelector('#productFullDesc')
      const arrow = btn.querySelector('.arrow')
      if (!full) return
      const isOpen = full.style.display !== 'none'
      if (isOpen) {
        full.style.display = 'none'
        if (short) short.style.display = ''
        if (arrow) arrow.textContent = '▸'
        btn.classList.remove('is-open')
      } else {
        if (short) short.style.display = 'none'
        full.style.display = ''
        if (arrow) arrow.textContent = '▾'
        btn.classList.add('is-open')
      }
    })
  })()
  bindCommon()
  // === Photo lightbox (pinch-zoom + double-tap) ===
  ;(function(){
    var gl = appEl.querySelector('#pgallery')
    if (!gl) return
    gl.addEventListener('click', function(e){
      var src = (e.target.closest('img') || {}).src
      if (!src) return
      var ov = document.createElement('div')
      ov.className = 'photo-overlay'
      var cls = document.createElement('div')
      cls.className = 'photo-overlay__close'
      cls.textContent = '×'
      var wrap = document.createElement('div')
      wrap.className = 'photo-overlay__wrap'
      var im = document.createElement('img')
      im.src = src
      im.className = 'photo-overlay__img'
      wrap.appendChild(im)
      ov.appendChild(cls)
      ov.appendChild(wrap)
      document.body.appendChild(ov)
      // pinch-to-zoom
      var scale = 1, startDist = 0, startScale = 1
      var tx = 0, ty = 0, pStart = { x: 0, y: 0 }
      var pinching = false, pinchEndTime = 0
      function applyT(){ im.style.transform = 'translate('+tx+'px,'+ty+'px) scale('+scale+')' }
      function dist2(a,b){ return Math.hypot(b.clientX-a.clientX, b.clientY-a.clientY) }
      wrap.addEventListener('touchstart', function(e){
        if (e.touches.length === 2){
          e.preventDefault()
          pinching = true
          startDist = dist2(e.touches[0], e.touches[1])
          startScale = scale
        } else if (e.touches.length === 1){
          pStart = { x: e.touches[0].clientX - tx, y: e.touches[0].clientY - ty }
        }
      }, { passive: false })
      wrap.addEventListener('touchmove', function(e){
        if (e.touches.length === 2){
          e.preventDefault()
          scale = Math.min(6, Math.max(1, startScale * dist2(e.touches[0], e.touches[1]) / startDist))
          applyT()
        } else if (e.touches.length === 1 && scale > 1){
          e.preventDefault()
          tx = e.touches[0].clientX - pStart.x
          ty = e.touches[0].clientY - pStart.y
          applyT()
        }
      }, { passive: false })
      wrap.addEventListener('touchend', function(e){
        if (e.touches.length === 0){
          if (scale < 1.05){ scale = 1; tx = 0; ty = 0; applyT() }
          if (pinching){ pinching = false; pinchEndTime = Date.now() }
        }
      })
      // double-tap zoom
      var lastTap = 0
      wrap.addEventListener('touchend', function(e){
        // ignore tap events that are part of a pinch gesture
        if (pinching) return
        if (Date.now() - pinchEndTime < 400) return
        var now = Date.now()
        if (now - lastTap < 280){
          scale = scale > 1 ? 1 : 2.5
          if (scale === 1){ tx = 0; ty = 0 }
          applyT()
          e.preventDefault()
        }
        lastTap = now
      })
      cls.addEventListener('click', function(e){ e.stopPropagation(); ov.remove() })
      ov.addEventListener('click', function(e){ if (e.target === ov && scale <= 1) ov.remove() })
    })
  })()

  // === also-bought (незалежний блок) ===
  ;(async () => {
    try {
      const also = await API.productAlsoBought(p.id)
      const alsoList = (also && also.products) || []
      if (alsoList.length) {
        const html = alsoList.map(x => `<div class="pcard pcard--mini" data-id="${x.id}"><img class="pcard__img" src="${x.image||''}" onerror="this.src=''"/><div class="pcard__name">${x.title}</div><div class="pcard__price">${fmt(x.effectivePrice ?? x.price)}</div></div>`).join('')
        const sec = appEl.querySelector('.product__also-bought')
        if (sec) { sec.innerHTML = `<h3>🛒 З цим часто беруть</h3><div class="also-list">${html}</div>`; sec.querySelectorAll('.pcard--mini').forEach(c => { c.style.cursor='pointer'; c.onclick = function(){ go('product/' + c.dataset.id); }; }) }
      }
    } catch(e){ console.warn('also-bought err:', e) }
  })()

  // === Відгуки (завжди показуємо форму, навіть якщо API помилило) ===
  ;(async () => {
    const revSec = appEl.querySelector('.product__reviews')
    if (!revSec) return
    // Завжди показуємо форму відразу
    const renderForm = (listHtml = '', avgHtml = '') => {
      revSec.innerHTML = `<h3>⭐ Відгуки</h3>${avgHtml}${listHtml}<div class="reviews__form"><div class="stars-picker">${starsHtml(0,true)}</div><textarea class="reviews__textarea" id="reviewText" placeholder="Ваш відгук..."></textarea><button class="btn btn--primary" id="reviewSubmit">Надіслати відгук</button></div>`
      let pickedStar = 0
      revSec.querySelectorAll('.star').forEach(el => el.addEventListener('click', () => {
        pickedStar = Number(el.dataset.star)
        revSec.querySelectorAll('.star').forEach((st, i) => st.classList.toggle('star--on', i < pickedStar))
      }))
      revSec.querySelector('#reviewSubmit')?.addEventListener('click', async () => {
        if (!pickedStar) { TG.showAlert('Оцініть товар!'); return }
        try {
          await API.addReview(p.id, pickedStar, revSec.querySelector('#reviewText').value)
          TG.notify('success')
          revSec.querySelector('.reviews__form').innerHTML = '<p class="reviews__thanks">Дякую за відгук! 😊</p>'
        } catch(e){
          TG.notify('error')
          if (e.code === 'not_purchased') TG.showAlert('Відгук можливий лише після покупки.')
          else TG.showAlert('Помилка: ' + e.message)
        }
      })
    }
    // Спочатку показуємо порожню форму
    renderForm()
    try {
      const revs = await API.productReviews(p.id)
      const revList = (revs && revs.reviews) || []
      const avg = (revs && revs.avg) || null
      const avgHtml = avg ? `<div class="reviews__avg">${starsHtml(avg)} <span>${Number(avg).toFixed(1)}</span> (${revList.length})</div>` : ''
      const listHtml = revList.map(r => `<div class="review"><div class="review__stars">${starsHtml(r.rating)}</div>${r.text ? `<p class="review__text">${r.text}</p>` : ''}</div>`).join('')
      renderForm(listHtml, avgHtml)
      // compact rating badge near title
      const ratingEl = appEl.querySelector('#productRating')
      if (ratingEl && avg) {
        const cnt = revList.length
        ratingEl.innerHTML = `<div class="product__rating-badge">${starsHtml(avg)} <span class="product__rating-score">${Number(avg).toFixed(1)}</span> <span class="product__rating-count muted small">(${cnt} відгуків)</span></div>`
      }
    } catch(e){ console.warn('reviews err:', e) }
  })()
  // Галерея: гортання фото свайпом + синхронізація з мініатюрами/крапками
  const pgallery = appEl.querySelector('#pgallery')
  const pdots = appEl.querySelectorAll('#pdots span')
  const pthumbs = appEl.querySelectorAll('.gallery__thumb')
  const setActiveSlide = (idx) => {
    pdots.forEach((d, i) => d.classList.toggle('on', i === idx))
    pthumbs.forEach((t, i) => t.classList.toggle('on', i === idx))
  }
  if (pgallery) {
    let lastIdx = 0
    pgallery.addEventListener(
      'scroll',
      () => {
        const idx = Math.round(pgallery.scrollLeft / pgallery.clientWidth)
        if (idx !== lastIdx) {
          lastIdx = idx
          setActiveSlide(idx)
          TG.haptic('light')
        }
      },
      { passive: true },
    )
  }
  pthumbs.forEach((b, i) =>
    b.addEventListener('click', () => {
      pgallery?.scrollTo({ left: i * pgallery.clientWidth, behavior: 'smooth' })
      setActiveSlide(i)
    }),
  )

  const hasPacks = p.packs && p.packs.length
  let selectedPack = hasPacks ? p.packs[0] : null
  const currentPrice = () => p.effectivePrice
  const addHandler = async () => {
    await addToCart(p.id, 1, selectedPack ? selectedPack.label : null)
    TG.notify('success')
    go('cart')
  }
  appEl.querySelectorAll('[data-pack]').forEach((b) =>
    b.addEventListener('click', () => {
      const idx = Number(b.dataset.pack)
      selectedPack = p.packs[idx]
      appEl.querySelectorAll('[data-pack]').forEach((x) =>
        x.classList.toggle('seg--on', Number(x.dataset.pack) === idx),
      )
      const puEl = appEl.querySelector('#perUnitPrice')
      if (puEl && p.unitsPerPack) puEl.textContent = `≈ ${fmt2(currentPrice() / p.unitsPerPack)}/шт`
      TG.haptic('light')
      if (!outOfStock(p)) TG.mainButton(`Додати в кошик · ${fmt(currentPrice())}`, addHandler)
    }),
  )
  if (!outOfStock(p)) {
    TG.mainButton(`Додати в кошик · ${fmt(currentPrice())}`, addHandler)
  }
})

// ---------- КОШИК ----------
route('cart', async () => {
  const cart = store.cart
  if (!cart.items.length) {
    appEl.innerHTML = `
      <header class="appbar"><div class="appbar__title">Кошик</div></header>
      <div class="screen">${emptyHtml('Кошик порожній', '🛒', 'Перейти в каталог', 'catalog')}</div>`
    bindCommon()
    return
  }
  appEl.innerHTML = `
    <header class="appbar">
      <div class="appbar__title">Кошик</div>
      <button class="appbar__icon" data-clear>🗑️</button>
    </header>
    <div class="screen">
      <div class="cart-list">
        ${cart.items.map((i) => cartRow(i)).join('')}
      </div>
      <div class="summary">
        <div class="summary__row"><span>Товари (${cart.count})</span><span>${fmt(cart.total)}</span></div>
        <div class="summary__row"><span>Доставка</span><span class="muted">розрахунок при оформленні</span></div>
        <div class="summary__total"><span>Разом</span><span>${fmt(cart.total)}</span></div>
      </div>
    </div>`
  appEl.querySelector('[data-clear]')?.addEventListener('click', async () => {
    await API.cartClear()
    store.setCart({ items: [], total: 0, count: 0 })
    render()
  })
  bindQty()
  bindCommon()
  TG.mainButton(`Оформити · ${fmt(cart.total)}`, () => go('checkout'))
})

function cartRow(i) {
  return `<div class="crow" data-row="${i.productId}">
    <img src="${img(i.image)}" alt=""/>
    <div class="crow__mid">
      <div class="crow__title">${esc(i.title)}</div>
      ${i.packLabel ? `<div class="crow__pack">📦 ${esc(i.packLabel)}</div>` : ''}
      <div class="crow__price">${
        i.packLabel
          ? `<span class="price">${fmt(i.unitPrice)}</span>`
          : i.salePrice != null
            ? `<span class="price price--sale">${fmt(i.salePrice)}</span> <span class="price price--old">${fmt(i.price)}</span>`
            : `<span class="price">${fmt(i.price)}</span>`
      }</div>
    </div>
    <div class="qty">
      <button data-dec="${i.productId}">−</button>
      <span>${i.qty}</span>
      <button data-inc="${i.productId}">+</button>
    </div>
  </div>`
}

function bindQty() {
  appEl.querySelectorAll('[data-inc]').forEach((b) =>
    b.addEventListener('click', async () => {
      TG.haptic('light')
      const id = Number(b.dataset.inc)
      const item = store.cart.items.find((x) => x.productId === id)
      const cart = await API.cartSet(id, (item?.qty || 0) + 1)
      store.setCart(cart)
      render()
    }),
  )
  appEl.querySelectorAll('[data-dec]').forEach((b) =>
    b.addEventListener('click', async () => {
      TG.haptic('light')
      const id = Number(b.dataset.dec)
      const item = store.cart.items.find((x) => x.productId === id)
      const cart = await API.cartSet(id, Math.max(0, (item?.qty || 1) - 1))
      store.setCart(cart)
      render()
    }),
  )
}

// ---------- ОФОРМЛЕННЯ ----------
route('checkout', async () => {
  const cart = store.cart
  if (!cart.items.length) return go('catalog')
  const u = store.user || {}
  const addr = u.address || {}
  appEl.innerHTML = `
    <header class="appbar">
      <button class="appbar__back" data-back>‹</button>
      <div class="appbar__title">Оформлення</div>
    </header>
    <div class="screen">
      <form id="checkoutForm" class="form">
        <label class="field"><span>Ім’я та прізвище</span>
          <input name="fullName" required value="${esc(u.name || '')}" placeholder="Напр. Софія Коваленко"/></label>
        <label class="field"><span>ФОП / ЧП (необов’язково)</span>
          <input name="fop" value="${esc(u.fop || '')}" placeholder="Напр. ФОП Коваленко С. І."/></label>
        <label class="field"><span>Телефон</span>
          <div class="field__row">
            <input id="phoneInput" name="phone" required type="tel" inputmode="tel" value="${esc(u.phone || '+38')}" placeholder="+380 __ ___ __ __"/>
            <button type="button" class="btn btn--mini" id="useMyPhone">📱 Мій номер</button>
          </div></label>
        <label class="field"><span>Населений пункт</span>
          <div class="ac">
            <input id="cityInput" name="city" required autocomplete="off" value="${esc(addr.city||'')}" placeholder="Почніть вводити, напр. Одеса"/>
            <div class="ac__list hidden" id="cityList"></div>
          </div></label>
        <label class="field"><span>Вулиця</span>
          <div class="ac">
            <input id="streetInput" name="street" required autocomplete="off" value="${esc(addr.street||'')}" placeholder="Почніть вводити назву вулиці"/>
            <div class="ac__list hidden" id="streetList"></div>
          </div></label>
        <div class="field__grid">
          <label class="field"><span>Будинок</span>
            <input id="houseInput" name="house" required value="${esc(addr.house||'')}" placeholder="12А"/></label>
          <label class="field"><span>Квартира</span>
            <input id="flatInput" name="flat" value="${esc(addr.flat||'')}" placeholder="необов’язково"/></label>
        </div>
        <button type="button" class="btn btn--ghost btn--loc" id="useGeo">📍 Визначити за геолокацією</button>
        <label class="field"><span>Коментар (необов’язково)</span>
          <textarea name="comment" rows="2" placeholder="Побажання до замовлення"></textarea></label>
      </form>
      <div class="summary">
        <div class="summary__total"><span>До сплати</span><span>${fmt(cart.total)}</span></div>
        <p class="muted small">Оплата при отриманні. Менеджер зв’яжеться для підтвердження.</p>
      </div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  const form = appEl.querySelector('#checkoutForm')

  // “Мій номер” — підтягує номер з Telegram
  const phoneInput = appEl.querySelector('#phoneInput')
  appEl.querySelector('#useMyPhone')?.addEventListener('click', () => {
    const ok = TG.requestContact((shared, phone) => {
      if (shared && phone) {
        phoneInput.value = phone.startsWith('+') ? phone : '+' + phone
        TG.haptic('light')
      } else if (shared) {
        TG.showAlert('Номер надіслано боту. Якщо він не вставився автоматично — введіть його вручну.')
      }
    })
    if (!ok) TG.showAlert('Поділитися номером можна лише у застосунку Telegram.')
  })

  // ---- Адреса: населений пункт (офлайн-список) + вулиця (OpenStreetMap) ----
  const cityInput = appEl.querySelector('#cityInput')
  const streetInput = appEl.querySelector('#streetInput')
  const houseInput = appEl.querySelector('#houseInput')
  let selectedCity = (u.address && u.address.city) ? { name: u.address.city } : null

  // Населені пункти — з офлайн-довідника Одеської області (працює завжди)
  async function fetchCities(q) {
    return searchSettlements(q, 8)
  }

  // Вулиці — онлайн через Nominatim (OpenStreetMap), привʼязано до обраного міста
  async function fetchStreets(q) {
    const city = (selectedCity?.name || cityInput.value || '').trim()
    const params = new URLSearchParams({
      format: 'jsonv2', countrycodes: 'ua', 'accept-language': 'uk',
      addressdetails: '1', limit: '8', street: q,
    })
    if (city) params.set('city', city)
    const res = await fetch('https://nominatim.openstreetmap.org/search?' + params.toString())
    if (!res.ok) throw new Error('geo')
    const rows = await res.json()
    const seen = new Set()
    const out = []
    for (const r of rows) {
      const a = r.address || {}
      const name = a.road || String(r.display_name || '').split(',')[0]
      if (!name || seen.has(name)) continue
      seen.add(name)
      out.push({ label: name, sub: a.city || a.town || a.village || a.hamlet || '', data: { name } })
    }
    return out
  }

  function attachAutocomplete(input, listEl, fetchFn, opts = {}) {
    const minChars = opts.minChars || 2
    const onPick = opts.onPick
    let t = null
    let seq = 0
    const close = () => { listEl.classList.add('hidden'); listEl.innerHTML = '' }
    const showInfo = (txt) => { listEl.innerHTML = '<div class="ac__info">' + esc(txt) + '</div>'; listEl.classList.remove('hidden') }
    input.addEventListener('input', () => {
      const q = input.value.trim()
      clearTimeout(t)
      if (q.length < minChars) return close()
      showInfo('Пошук…')
      t = setTimeout(async () => {
        const my = ++seq
        let items = []
        let failed = false
        try { items = await fetchFn(q) } catch { failed = true }
        if (my !== seq) return
        const seen = new Set()
        items = (items || []).filter((it) => { const k = it.label + '|' + (it.sub || ''); if (seen.has(k)) return false; seen.add(k); return true }).slice(0, 8)
        if (!items.length) return showInfo(failed ? 'Мережа недоступна — впишіть вручну' : 'Нічого не знайдено — впишіть вручну')
        listEl.innerHTML = items
          .map((it, i) => '<button type="button" class="ac__item" data-i="' + i + '"><span class="ac__name">' + esc(it.label) + '</span>' + (it.sub ? '<span class="ac__sub">' + esc(it.sub) + '</span>' : '') + '</button>')
          .join('')
        listEl.classList.remove('hidden')
        listEl.querySelectorAll('.ac__item').forEach((btn) => {
          btn.addEventListener('mousedown', (e) => e.preventDefault())
          btn.addEventListener('click', () => { const it = items[Number(btn.dataset.i)]; input.value = it.label; close(); if (onPick) onPick(it.data) })
        })
      }, 260)
    })
    input.addEventListener('blur', () => setTimeout(close, 200))
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') close() })
  }

  attachAutocomplete(cityInput, appEl.querySelector('#cityList'), fetchCities, {
    minChars: 1,
    onPick: (d) => { selectedCity = d; streetInput.value = '' },
  })
  attachAutocomplete(streetInput, appEl.querySelector('#streetList'), fetchStreets, { minChars: 3 })

  // Геолокація → адреса (Nominatim reverse)
  appEl.querySelector('#useGeo')?.addEventListener('click', () => {
    const ok = TG.getLocation(async (coords) => {
      if (!coords) return TG.showAlert('Не вдалося визначити місцезнаходження.')
      try {
        const params = new URLSearchParams({
          format: 'jsonv2', 'accept-language': 'uk', addressdetails: '1',
          lat: String(coords.latitude), lon: String(coords.longitude),
        })
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?' + params.toString())
        const a = (await res.json())?.address || {}
        const city = a.city || a.town || a.village || a.hamlet
        if (city) { cityInput.value = city; selectedCity = { name: city } }
        if (a.road) streetInput.value = a.road
        if (a.house_number) houseInput.value = a.house_number
        TG.haptic('light')
        if (!city && !a.road) TG.showAlert('Адресу не знайдено, заповніть вручну.')
      } catch { TG.showAlert('Не вдалося отримати адресу.') }
    })
    if (!ok) TG.showAlert('Геолокація недоступна на цьому пристрої.')
  })

  TG.mainButton(`Підтвердити · ${fmt(cart.total)}`, async () => {
    if (!form.reportValidity()) return
    const data = Object.fromEntries(new FormData(form).entries())
    // Якщо назва вулиці вже містить тип (вул./пров./просп. тощо) — не додаємо «вул.» ще раз.
    const STREET_TYPE_RE = /^(вул(иця)?|ул(иця|ица)?|пров(улок)?|просп(ект)?|бул(ьвар)?|пл(оща)?|пер(еулок)?|шосе|узвіз|проїзд|туп(ик)?|наб(ережна)?)\.?\s+/i
    const streetLine = (v) => {
      const t = String(v || '').trim()
      if (!t) return ''
      return STREET_TYPE_RE.test(t) ? t : 'вул. ' + t
    }
    const address = [
      (data.city || '').trim(),
      streetLine(data.street),
      data.house ? 'буд. ' + data.house.trim() : '',
      data.flat ? 'кв. ' + data.flat.trim() : '',
    ].filter(Boolean).join(', ')
    try {
      TG.raw?.MainButton?.showProgress?.()
      const r = await API.order({ fullName: data.fullName, phone: data.phone, address, comment: data.comment, fop: data.fop, addressParts: { city: (data.city||'').trim(), street: (data.street||'').trim(), house: (data.house||'').trim(), flat: (data.flat||'').trim() } })
      store.setCart({ items: [], total: 0, count: 0 })
      TG.notify('success')
      go(`success/${r.orderId}`)
    } catch (e) {
      TG.showAlert('Не вдалося оформити: ' + e.message)
    } finally {
      TG.raw?.MainButton?.hideProgress?.()
    }
  })
  bindCommon()
})

// ---------- УСПІХ ----------
route('success', async (orderId) => {
  TG.hideMainButton()
  appEl.innerHTML = `
    <div class="screen screen--center">
      <div class="success">
        <div class="success__check">✓</div>
        <h1>Дякуємо за замовлення!</h1>
        <p class="muted">№${esc(orderId)}</p>
        <p>Ми зв’яжемося з вами для підтвердження 💛</p>
        <button class="btn btn--primary" data-go="orders">Мої замовлення</button>
        <button class="btn btn--ghost" data-go="catalog">До каталогу</button>
      </div>
    </div>`
  bindCommon()
})

// ---------- ЗАМОВЛЕННЯ ----------
const STATUS = {
  new: { t: 'Новий', c: 'st-new' },
  confirmed: { t: 'Підтверджено', c: 'st-ok' },
  shipped: { t: 'Відправлено', c: 'st-ship' },
  done: { t: 'Виконано', c: 'st-ok' },
  cancelled: { t: 'Скасовано', c: 'st-cancel' },
}
route('orders', async () => {
  const { orders } = await API.orders()
  appEl.innerHTML = `
    <header class="appbar"><div class="appbar__title">Мої замовлення</div></header>
    <div class="screen">
      ${
        orders.length
          ? `<div class="orders">${orders.map((o) => orderRow(o)).join('')}</div>
             <button class="btn-clear" data-clear-orders>🗑 Очистити історію</button>`
          : emptyHtml('Ще немає замовлень', '📦', 'До каталогу', 'catalog')
      }
    </div>`
  bindCommon()
  appEl.querySelectorAll('[data-order]').forEach((el) =>
    el.addEventListener('click', () => go('order/' + el.dataset.order)),
  )
  const clearBtn = appEl.querySelector('[data-clear-orders]')
  if (clearBtn)
    clearBtn.addEventListener('click', () => {
      TG.confirm('Очистити історію замовлень? Накладні більше не будуть відображатися у вашому кабінеті.', async (ok) => {
        if (!ok) return
        try {
          await API.clearOrders()
          store.set({ purchasedIds: [] })
          TG.notify('success')
          go('profile')
        } catch (e) {
          TG.notify('error')
          TG.showAlert('Не вдалося очистити: ' + e.message)
        }
      })
    })
})

function orderRow(o) {
  const s = STATUS[o.status] || { t: o.status, c: 'st-new' }
  const date = new Date(o.created_at).toLocaleDateString('uk-UA')
  return `<div class="order" data-order="${o.id}">
    <div class="order__top">
      <span class="order__id">#${o.id}</span>
      <span class="order__date">${date}</span>
      <span class="status ${s.c}">${s.t}</span>
    </div>
    <div class="order__bottom">
      <span class="muted small">${esc(o.address || '')}</span>
      <span class="order__total">${fmt(o.total)}</span>
    </div>
  </div>`
}

// ---------- ДЕТАЛІ ЗАМОВЛЕННЯ ----------
route('order', async (id) => {
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">Замовлення #${id}</div></header>
    <div class="screen"><p class="muted small">Завантаження…</p></div>`
  let order
  try {
    const r = await API.orderById(id)
    order = r.order
  } catch (e) {
    appEl.innerHTML = `
      <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">Замовлення</div></header>
      <div class="screen">${emptyHtml('Замовлення не знайдено', '📦')}</div>`
    appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
    return
  }
  const s = STATUS[order.status] || { t: order.status, c: 'st-new' }
  const date = new Date(order.created_at).toLocaleString('uk-UA')
  const items = (order.items || []).map((it) => `
    <div class="oitem">
      <span class="oitem__title">${esc(it.title)}</span>
      <span class="oitem__qty">×${it.qty}</span>
      <span class="oitem__sum">${fmt(it.price * it.qty)}</span>
    </div>`).join('')
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">Замовлення #${order.id}</div></header>
    <div class="screen">
      <div class="order-detail">
        <div class="order__top"><span class="order__date">${date}</span><span class="status ${s.c}">${s.t}</span></div>
        ${order.address ? `<p class="muted small">📍 ${esc(order.address)}</p>` : ''}
        ${order.comment ? `<p class="muted small">💬 ${esc(order.comment)}</p>` : ''}
        <div class="oitems">${items || '<p class="muted small">Немає позицій</p>'}</div>
        <div class="order-detail__total"><span>Разом</span><span>${fmt(order.total)}</span></div>
      </div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
})

// ---------- ПРОФІЛЬ ----------
route('favorites', async () => {
  const favs = store.favProducts()
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">❤️ Обране</div></header>
    <div class="screen">
      ${favs.length ? `<div class="grid">${favs.map((p) => cardGrid(p)).join('')}</div>` : emptyHtml('Список обраного порожній', '🤍', 'До каталогу', 'catalog')}
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  bindCommon()
})

route('profile', async () => {
  const { profile } = await API.profile()
  const initials = (profile.name || '?').slice(0, 1).toUpperCase()
  appEl.innerHTML = `
    <header class="appbar"><div class="appbar__title">Профіль</div></header>
    <div class="screen">
      <div class="profile-card">
        <div class="avatar">${
          profile.photoUrl ? `<img src="${esc(profile.photoUrl)}"/>` : initials
        }</div>
        <div class="profile-card__info">
          <div class="profile-card__name">${esc(profile.name)}</div>
          ${profile.username ? `<div class="muted">@${esc(profile.username)}</div>` : ''}
        </div>
      </div>
      <div class="stats">
        <div class="stat"><div class="stat__num">${profile.ordersCount}</div><div class="stat__lbl">Замовлень</div></div>
        <div class="stat"><div class="stat__num">${fmt(profile.totalSpent)}</div><div class="stat__lbl">Витрачено</div></div>
      </div>
      <div class="menu-list">
        <button class="menu-item" data-go="orders"><span>📦 Мої замовлення</span><span>›</span></button>
        <button class="menu-item" data-go="favorites"><span>❤️ Обране</span><span>›</span></button>
        <button class="menu-item" data-go="cart"><span>🛒 Кошик</span><span>›</span></button>
        <button class="menu-item" data-go="support"><span>💬 Підтримка / питання</span><span>›</span></button>
        ${profile.isAdmin ? `<button class="menu-item menu-item--admin" data-go="admin"><span>🔧 Адмін-панель</span><span>›</span></button>` : ''}
      </div>
      <p class="muted small center">WowSmak · Mini App</p>
    </div>`
  bindCommon()
})

// ========== ADMIN HUB ==========
route('admin', async () => {
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">🔧 Адмін-панель</div></header>
    <div class="screen">
      <div class="menu-list">
        <button class="menu-item menu-item--admin" data-go="admin-orders"><span>📋 Замовлення</span><span>›</span></button>
        <button class="menu-item menu-item--admin" data-go="admin-products"><span>📦 Товари</span><span>›</span></button>
        <button class="menu-item menu-item--admin" data-go="admin-categories"><span>🗂 Категорії</span><span>›</span></button>
        <button class="menu-item menu-item--admin" data-go="stock"><span>📦 Залишки</span><span>›</span></button>
        <button class="menu-item menu-item--admin" data-go="analytics"><span>📊 Аналітика</span><span>›</span></button>
      </div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  bindCommon()
})

// ========== ADMIN ORDERS ==========
const ORDER_STATUS_LABELS = {
  new: '🔵 Нове', confirmed: '🟡 Підтверджено',
  shipped: '🚚 Відправлено', done: '✅ Виконано',
  cancelled: '❌ Скасовано',
}
const ORDER_STATUS_NEXT = {
  new: ['confirmed', 'cancelled'],
  confirmed: ['shipped', 'cancelled'],
  shipped: ['done', 'cancelled'],
  done: [], cancelled: [],
}
route('admin-orders', async () => {
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">📋 Замовлення</div></header>
    <div class="screen"><p class="muted small center">Завантаження...</p></div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  let orders
  try { ({ orders } = await API.adminOrdersList()) } catch (e) {
    appEl.querySelector('.screen').innerHTML = `<p class="muted small center">Помилка: ${esc(e.message)}</p>`
    return
  }
  if (!orders.length) {
    appEl.querySelector('.screen').innerHTML = `<p class="muted small center">Замовлень немає.</p>`
    return
  }
  const fmt2 = (iso) => new Date(iso).toLocaleString('uk-UA', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
  appEl.querySelector('.screen').innerHTML = orders.map(o => `
    <div class="adm-order" data-id="${o.id}">
      <div class="adm-order__head">
        <span class="adm-order__id">#${o.id}</span>
        <span class="adm-order__status" data-status="${o.status}">${ORDER_STATUS_LABELS[o.status] || o.status}</span>
        <span class="adm-order__date">${fmt2(o.created_at)}</span>
      </div>
      <div class="adm-order__info">${esc(o.full_name || '')} • ${esc(o.phone || '')} • <b>${fmt(Number(o.total))}</b></div>
      ${o.address ? `<div class="adm-order__addr muted small">${esc(o.address)}</div>` : ''}
      <div class="adm-order__actions">${(ORDER_STATUS_NEXT[o.status] || []).map(s =>
        `<button class="btn btn--sm btn--outline adm-status-btn" data-id="${o.id}" data-status="${s}">${ORDER_STATUS_LABELS[s]}</button>`
      ).join('')}</div>
    </div>`).join('')
  appEl.querySelector('.screen').addEventListener('click', async (e) => {
    const btn = e.target.closest('.adm-status-btn')
    if (!btn) return
    const { id, status } = btn.dataset
    btn.disabled = true
    try {
      await API.adminSetOrderStatus(Number(id), status)
      TG.notify('success')
      render()
    } catch (err) { TG.notify('error'); TG.showAlert('Помилка: ' + err.message); btn.disabled = false }
  })
})

// ========== ADMIN PRODUCTS LIST ==========
route('admin-products', async () => {
  appEl.innerHTML = `
    <header class="appbar">
      <button class="appbar__back" data-back>‹</button>
      <div class="appbar__title">📦 Товари</div>
      <button class="appbar__action" id="addProduct">+ Додати</button>
    </header>
    <div class="screen">
      <input class="adm-search" type="search" placeholder="🔍 Пошук..."/>
      <div id="prodList"><p class="muted small center">Завантаження...</p></div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  appEl.querySelector('#addProduct').addEventListener('click', () => go('admin-product/new'))
  let products
  try { ({ products } = await API.adminProducts()) } catch (e) {
    appEl.querySelector('#prodList').innerHTML = `<p class="muted small center">Помилка: ${esc(e.message)}</p>`
    return
  }
  const renderList = (list) => {
    appEl.querySelector('#prodList').innerHTML = list.length
      ? list.map(p => `
        <div class="adm-prod" data-id="${p.id}">
          <img class="adm-prod__img" src="${img(p.image)}" alt="" loading="lazy"/>
          <div class="adm-prod__info">
            <div class="adm-prod__name">${esc(p.title)}</div>
            <div class="adm-prod__meta muted small">${p.category || 'Без кат.'} • ${p.inStock ? '✅ в наявн.' : '❌ немає'}</div>
          </div>
          <div class="adm-prod__actions">
            <button class="btn btn--sm btn--outline" data-edit="${p.id}">✏️</button>
          </div>
        </div>`).join('')
      : '<p class="muted small center">Немає товарів.</p>'
  }
  renderList(products)
  appEl.querySelector('.adm-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase()
    renderList(q ? products.filter(p => p.title.toLowerCase().includes(q)) : products)
  })
  appEl.querySelector('#prodList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-edit]')
    if (btn) go('admin-product/' + btn.dataset.edit)
  })
})

// ========== ADMIN PRODUCT EDIT / CREATE ==========
route('admin-product', async (param) => {
  const isNew = param === 'new'
  appEl.innerHTML = `
    <header class="appbar">
      <button class="appbar__back" data-back>‹</button>
      <div class="appbar__title">${isNew ? '➕ Новий товар' : '✏️ Редагування'}</div>
      ${isNew ? `<p class="muted small">💡 Фото / відео можна додати після збереження</p>` : ''}
      ${!isNew ? `<button class="appbar__action appbar__action--danger" id="delProduct">🗑</button>` : ''}
    </header>
    <div class="screen"><p class="muted small center">Завантаження...</p></div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  let product = {}, categories = []
  try {
    if (isNew) {
      const r = await API.adminCategoriesList()
      categories = r.categories || []
    } else {
      const r = await API.adminGetProduct(Number(param))
      product = r.product; categories = r.categories || []
      // parse JSON fields that may come as strings from DB
      const parseJ = (v, fb) => { if (Array.isArray(v)) return v; try { const p2 = JSON.parse(v); return Array.isArray(p2) ? p2 : fb } catch { return fb } }
      product.flavors = parseJ(product.flavors, [])
      product.packs   = parseJ(product.packs,   [])
    }
  } catch (e) {
    appEl.querySelector('.screen').innerHTML = `<p class="muted small center">Помилка: ${esc(e.message)}</p>`
    return
  }
  const catOptions = `<option value="">— Без категорії —</option>` +
    categories.map(c => `<option value="${c.id}" ${product.category_id == c.id ? 'selected' : ''}>${c.emoji || ''} ${esc(c.title)}</option>`).join('')
  appEl.querySelector('.screen').innerHTML = `
    <form class="adm-form" id="prodForm">
      <label>Назва *
        <input name="title" class="adm-input" required value="${esc(product.title || '')}" placeholder="Назва товару"/>
      </label>
      <div class="adm-row">
        <label>Ціна продажу *
          <input name="price" class="adm-input" type="number" min="0" step="0.01" required value="${product.price ?? ''}" placeholder="0.00"/>
        </label>
        <label>Акційна ціна
          <input name="sale_price" class="adm-input" type="number" min="0" step="0.01" value="${product.sale_price ?? ''}" placeholder="не встановлено"/>
        </label>
      </div>
      <div class="adm-row">
        <label>Собівартість
          <input name="cost_price" class="adm-input" type="number" min="0" step="0.01" value="${product.cost_price ?? ''}" placeholder="необов'язко"/>
        </label>
        <label>Залишок
          <input name="stock" class="adm-input" type="number" min="0" step="1" value="${product.stock ?? ''}" placeholder="∅ = безлім"/>
        </label>
      </div>
      <label>Категорія
        <select name="category_id" class="adm-input">${catOptions}</select>
      </label>
      <label>Опис
        <textarea name="description" class="adm-input adm-textarea" rows="3" placeholder="Опис товару...">${esc(product.description || '')}</textarea>
      </label>
      <label>Повний опис (в спойлері)
        <textarea name="full_description" class="adm-input adm-textarea" rows="5" placeholder="Склад, рецептура, про товар...">${esc(product.full_description || '')}</textarea>
      </label>
      <div class="adm-section-title">🥦 Поживна цінність (на 100 г)</div>
      <div class="adm-row">
        <label>Ккал<input name="calories" class="adm-input" type="number" min="0" step="0.1" value="${product.calories ?? ''}" placeholder="-"/></label>
        <label>Білки (г)<input name="proteins" class="adm-input" type="number" min="0" step="0.1" value="${product.proteins ?? ''}" placeholder="-"/></label>
      </div>
      <div class="adm-row">
        <label>Жири (г)<input name="fats" class="adm-input" type="number" min="0" step="0.1" value="${product.fats ?? ''}" placeholder="-"/></label>
        <label>Вуглеводи (г)<input name="carbs" class="adm-input" type="number" min="0" step="0.1" value="${product.carbs ?? ''}" placeholder="-"/></label>
      </div>
      <div class="adm-row">
        <label>Країна<input name="country_of_origin" class="adm-input" value="${esc(product.country_of_origin || '')}" placeholder="Країна"/></label>
        <label>Термін зберігання<input name="shelf_life" class="adm-input" value="${esc(product.shelf_life || '')}" placeholder="12 міс."/></label>
      </div>
      <div class="adm-section-title">📦 Характеристики товару</div>
      <div class="adm-row">
        <label>Вага (г)<input name="weight_g" class="adm-input" type="number" min="0" step="1" value="${product.weight_g ?? ''}" placeholder="-"/></label>
        <label>Штрихкод<input name="barcode" class="adm-input" value="${esc(String(product.barcode || ''))}" placeholder="-"/></label>
      </div>
      <div class="adm-row">
        <label>Кількість в упаковці<input name="units_per_pack" class="adm-input" type="number" min="0" step="1" value="${product.units_per_pack ?? ''}" placeholder="-"/></label>
        <label>Рекомендована наценка (%)<input name="rec_markup" class="adm-input" type="number" min="0" step="1" value="${product.rec_markup ?? ''}" placeholder="-"/></label>
      </div>
      <div class="adm-section-title">🍓 Смаки</div>
      <div class="adm-tags" id="admFlavors">${(product.flavors||[]).map(f=>`<span class="adm-tag">${esc(f)}<button type="button" class="adm-tag__del">×</button></span>`).join('')}</div>
      <div class="adm-row adm-row--add">
        <input id="flavorInput" class="adm-input" placeholder="Новий смак (напр. Полуниця)..."/>
        <button type="button" class="btn btn--outline btn--sm" id="addFlavorBtn">+ Додати</button>
      </div>
      <div class="adm-section-title">📦 Фасовки</div>
      <div id="admPacks">${(product.packs||[]).map(pk=>`<div class="adm-pack-row"><input class="adm-input adm-pack__label" data-pack-label value="${esc(pk.label)}" placeholder="Назва (100г)"/><input class="adm-input adm-pack__price" type="number" min="0" step="0.01" data-pack-price value="${pk.price??''}" placeholder="Ціна"/><button type="button" class="btn btn--outline btn--sm btn--danger adm-pack__del">×</button></div>`).join('')}</div>
      <button type="button" class="btn btn--outline btn--sm" id="addPackBtn" style="margin-bottom:12px">+ Додати фасовку</button>
      <label class="adm-toggle">
        <input type="checkbox" name="in_stock" ${product.in_stock !== false ? 'checked' : ''}/>
        Товар в наявності
      </label>
      ${!isNew ? `
      <div class="adm-media">
        <div class="adm-media__label">🖼️ Фото
          <span class="muted small">(головне + додаткові)</span>
        </div>
        <div class="adm-media__images" id="mediaImages">
          ${product.image_url ? `<img class="adm-media__thumb" src="${img(product.image_url)}" alt=""/>` : '<span class="muted small">Немає фото</span>'}
        </div>
        <div class="adm-media__btns">
          <label class="btn btn--outline btn--sm adm-upload-btn">
            + Головне фото
            <input type="file" accept="image/*" id="uploadMain" style="display:none"/>
          </label>
          <label class="btn btn--outline btn--sm adm-upload-btn">
            + Додаткове фото
            <input type="file" accept="image/*" id="uploadExtra" style="display:none"/>
          </label>
          <label class="btn btn--outline btn--sm adm-upload-btn">
            + Відео
            <input type="file" accept="video/*" id="uploadVideo" style="display:none"/>
          </label>
          <button type="button" class="btn btn--outline btn--sm btn--danger" id="clearMedia">🗑 Скинути все</button>
        </div>
        <div id="uploadProgress" class="muted small"></div>
      </div>` : ''}
            <button class="btn btn--primary adm-save" type="submit">${isNew ? 'Створити товар' : 'Зберегти зміни'}</button>
    </form>`
  const form = appEl.querySelector('#prodForm')
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fd = new FormData(form)
    const body = {
      title: fd.get('title').trim(),
      price: fd.get('price'),
      sale_price: fd.get('sale_price') || null,
      cost_price: fd.get('cost_price') || null,
      stock: fd.get('stock') || null,
      category_id: fd.get('category_id') || null,
      description: (fd.get('description') || '').trim() || null,
        full_description: (fd.get('full_description') || '').trim() || null,
        proteins: fd.get('proteins') || null,
        fats: fd.get('fats') || null,
        carbs: fd.get('carbs') || null,
        calories: fd.get('calories') || null,
        country_of_origin: (fd.get('country_of_origin') || '').trim() || null,
        shelf_life: (fd.get('shelf_life') || '').trim() || null,
        weight_g: fd.get('weight_g') || null,
        barcode: (fd.get('barcode') || '').trim() || null,
        units_per_pack: fd.get('units_per_pack') || null,
        rec_markup: fd.get('rec_markup') || null,
        flavors: (() => { const fl = [...form.querySelectorAll('#admFlavors .adm-tag')].map(el => el.childNodes[0].textContent.trim()).filter(Boolean); return fl.length ? fl : null })(),
        packs: (() => { const rows = [...form.querySelectorAll('#admPacks .adm-pack-row')]; const pks = rows.map(r => ({ label: r.querySelector('[data-pack-label]').value.trim(), price: Number(r.querySelector('[data-pack-price]').value) || 0 })).filter(pk => pk.label); return pks.length ? pks : null })(),
      in_stock: fd.get('in_stock') === 'on',
    }
    const saveBtn = form.querySelector('.adm-save')
    saveBtn.disabled = true; saveBtn.textContent = 'Зберігаємо...'
    try {
      if (isNew) {
        await API.adminCreateProduct(body)
        TG.notify('success')
        history.back()
      } else {
        await API.adminUpdateProduct(Number(param), body)
        TG.notify('success')
        history.back()
      }
    } catch (err) {
      TG.notify('error'); TG.showAlert('Помилка: ' + err.message)
      saveBtn.disabled = false; saveBtn.textContent = 'Зберегти зміни'
    }
  })
  // Flavors dynamic UI
  ;(function(){
    const container = appEl.querySelector('#admFlavors')
    const input = appEl.querySelector('#flavorInput')
    const addBtn = appEl.querySelector('#addFlavorBtn')
    if (!container || !addBtn) return
    function addFlavor(val) {
      val = val.trim()
      if (!val) return
      const tag = document.createElement('span')
      tag.className = 'adm-tag'
      tag.appendChild(document.createTextNode(val))
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'adm-tag__del'
      del.textContent = '×'
      del.addEventListener('click', () => tag.remove())
      tag.appendChild(del)
      container.appendChild(tag)
      if (input) input.value = ''
    }
    addBtn.addEventListener('click', () => addFlavor(input ? input.value : ''))
    if (input) input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFlavor(input.value) } })
    container.addEventListener('click', e => { if (e.target.classList.contains('adm-tag__del')) e.target.closest('.adm-tag').remove() })
  })()
  // Packs dynamic UI
  ;(function(){
    const container = appEl.querySelector('#admPacks')
    const addBtn = appEl.querySelector('#addPackBtn')
    if (!container || !addBtn) return
    function addPackRow(label, price) {
      const row = document.createElement('div')
      row.className = 'adm-pack-row'
      const lbl = document.createElement('input')
      lbl.className = 'adm-input adm-pack__label'
      lbl.setAttribute('data-pack-label', '')
      lbl.placeholder = 'Назва (100г)'
      lbl.value = label || ''
      const pr = document.createElement('input')
      pr.className = 'adm-input adm-pack__price'
      pr.type = 'number'
      pr.min = '0'
      pr.step = '0.01'
      pr.setAttribute('data-pack-price', '')
      pr.placeholder = 'Ціна'
      pr.value = price != null ? price : ''
      const del = document.createElement('button')
      del.type = 'button'
      del.className = 'btn btn--outline btn--sm btn--danger adm-pack__del'
      del.textContent = '×'
      del.addEventListener('click', () => row.remove())
      row.appendChild(lbl); row.appendChild(pr); row.appendChild(del)
      container.appendChild(row)
    }
    addBtn.addEventListener('click', () => addPackRow('', ''))
    container.addEventListener('click', e => { if (e.target.classList.contains('adm-pack__del')) e.target.closest('.adm-pack-row').remove() })
  })()
  // Upload handlers
  if (!isNew) {
    const progress = appEl.querySelector('#uploadProgress')
    const doUpload = async (file, isMain) => {
      progress.textContent = 'Завантаження...';
      try {
        await API.adminUploadImage(Number(param), file, isMain ? 1 : 0)
        TG.notify('success')
        progress.textContent = 'Фото збережено! Перезавантажте сторінку для оновлення.';
      } catch(e) { TG.notify('error'); progress.textContent = 'Помилка: ' + e.message }
    }
    appEl.querySelector('#uploadMain')?.addEventListener('change', e => { if (e.target.files[0]) doUpload(e.target.files[0], true) })
    appEl.querySelector('#uploadExtra')?.addEventListener('change', e => { if (e.target.files[0]) doUpload(e.target.files[0], false) })
    appEl.querySelector('#uploadVideo')?.addEventListener('change', async e => {
      const file = e.target.files[0]; if (!file) return
      progress.textContent = 'Завантаження відео...'
      try {
        await API.adminUploadVideo(Number(param), file)
        TG.notify('success'); progress.textContent = 'Відео збережено!'
      } catch(e) { TG.notify('error'); progress.textContent = 'Помилка: ' + e.message }
    })
    appEl.querySelector('#clearMedia')?.addEventListener('click', () => {
      TG.confirm('Скинути усі фото і відео?', async ok => {
        if (!ok) return
        try { await API.adminClearMedia(Number(param)); TG.notify('success'); progress.textContent = 'Медіа видалено.' } catch(e) { TG.notify('error') }
      })
    })
  }
  if (!isNew) {
    appEl.querySelector('#delProduct')?.addEventListener('click', () => {
      TG.confirm('Видалити товар назавжди?', async (ok) => {
        if (!ok) return
        try {
          await API.adminDeleteProduct(Number(param))
          TG.notify('success')
          history.go(-2)
        } catch (err) { TG.notify('error'); TG.showAlert(err.message) }
      })
    })
  }
})

// ========== ADMIN CATEGORIES ==========
route('admin-categories', async () => {
  const reload = async () => {
    appEl.querySelector('#catList').innerHTML = '<p class="muted small center">Завантаження...</p>'
    let cats
    try { ({ categories: cats } = await API.adminCategoriesList()) } catch (e) {
      appEl.querySelector('#catList').innerHTML = `<p class="muted small center">Помилка: ${esc(e.message)}</p>`
      return
    }
    appEl.querySelector('#catList').innerHTML = cats.length
      ? cats.map(c => `
          <div class="adm-cat" data-id="${c.id}">
            <span>${c.emoji || '\ud83c\udf6c'} ${esc(c.title)}</span>
            <button class="btn btn--sm btn--outline btn--danger" data-del-cat="${c.id}">🗑</button>
          </div>`).join('')
      : '<p class="muted small center">Немає категорій.</p>'
    appEl.querySelector('#catList').addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-del-cat]')
      if (!btn) return
      TG.confirm('Видалити категорію? Товари залишаться.', async (ok) => {
        if (!ok) return
        try { await API.adminDeleteCategory(Number(btn.dataset.delCat)); TG.notify('success'); reload() }
        catch (err) { TG.notify('error'); TG.showAlert(err.message) }
      })
    })
  }
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">🗂 Категорії</div></header>
    <div class="screen">
      <div class="adm-add-cat">
        <input class="adm-input" id="catEmoji" placeholder="🍬" maxlength="4" style="width:56px"/>
        <input class="adm-input" id="catTitle" placeholder="Назва категорії" style="flex:1"/>
        <button class="btn btn--primary" id="addCatBtn">+ Додати</button>
      </div>
      <div id="catList"></div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  appEl.querySelector('#addCatBtn').addEventListener('click', async () => {
    const title = appEl.querySelector('#catTitle').value.trim()
    const emoji = appEl.querySelector('#catEmoji').value.trim() || '\ud83c\udf6c'
    if (!title) return TG.showAlert('Введіть назву')
    try {
      await API.adminCreateCategory({ title, emoji })
      TG.notify('success')
      appEl.querySelector('#catTitle').value = ''
      appEl.querySelector('#catEmoji').value = ''
      reload()
    } catch (err) { TG.notify('error'); TG.showAlert(err.message) }
  })
  reload()
})

// ---------- АДМІН: ШВИДКІ ЗАЛИШКИ ----------
function stockStateClass(stock) {
  if (stock == null) return ''
  if (stock <= 0) return 'is-out'
  if (stock < 3) return 'is-low'
  return ''
}
function stockRow(p) {
  return `<div class="strow ${stockStateClass(p.stock)}" data-id="${p.id}">
    <div class="strow__info">
      <img class="strow__img" src="${img(p.image)}" alt="" loading="lazy"/>
      <div class="strow__title">${esc(p.title)}</div>
    </div>
    <div class="strow__edit">
      <input class="strow__input" type="number" min="0" inputmode="numeric" value="${p.stock == null ? '' : p.stock}" placeholder="∞"/>
      <button class="strow__save" type="button" aria-label="Зберегти">✓</button>
    </div>
  </div>`
}
route('stock', async () => {
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">📦 Залишки</div></header>
    <div class="screen"><p class="muted small">Завантаження…</p></div>`
  let data
  try {
    data = await API.adminProducts()
  } catch (e) {
    appEl.innerHTML = `
      <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">📦 Залишки</div></header>
      <div class="screen"><div class="empty"><div class="empty__ic">🔒</div><p>${e.status === 403 ? 'Доступ лише для адміна.' : 'Не вдалося завантажити.'}</p></div></div>`
    appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
    return
  }
  const rows = data.products.map((p) => stockRow(p)).join('')
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">📦 Залишки</div></header>
    <div class="screen">
      <p class="muted small">Введіть кількість і натисніть ✓. Порожнє поле або «−» — не враховувати (∞).</p>
      <div class="csv-actions">
        <a class="btn btn--outline" id="csvExport">📥 Експорт CSV</a>
        <label class="btn btn--outline">📤 Імпорт CSV<input type="file" id="csvImport" accept=".csv" style="display:none"></label>
      </div>
      <div class="stock-table">${rows || '<p class="muted small">Немає товарів.</p>'}</div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  appEl.querySelectorAll('.strow').forEach((row) => {
    const id = Number(row.dataset.id)
    const input = row.querySelector('.strow__input')
    const save = row.querySelector('.strow__save')
    const doSave = async () => {
      save.disabled = true
      try {
        const raw = (input.value || '').trim()
        const stock = raw === '' || raw === '-' ? null : raw
        const r = await API.adminSetStock(id, stock)
        input.value = r.stock == null ? '' : r.stock
        row.className = `strow ${stockStateClass(r.stock)} saved`
        setTimeout(() => row.classList.remove('saved'), 900)
        TG.notify('success')
      } catch (e) {
        TG.notify('error')
        TG.showAlert('Не вдалося зберегти: ' + e.message)
      } finally {
        save.disabled = false
      }
    }
    save.addEventListener('click', doSave)
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); doSave() } })
  })
})

// ---------- АНАЛІТИКА ----------
route('analytics', async () => {
  appEl.innerHTML = `
    <header class="appbar"><button class="appbar__back" data-back>‹</button><div class="appbar__title">📊 Аналітика</div></header>
    <div class="screen"><p class="muted small center">Завантаження...</p></div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  let data
  try { data = await API.adminAnalytics() } catch (e) {
    appEl.querySelector('.screen').innerHTML = `<p class="muted small center">Помилка: ${e.message}</p>`
    return
  }
  const kpiBlock = (val, label) => `<div class="kpi"><div class="kpi__val">${val}</div><div class="kpi__lbl">${label}</div></div>`
  const os = data.orderStats || {}
  const topHtml = (data.topProducts || []).map((pr, i) =>
    `<div class="top-item"><span class="top-item__rank">${i + 1}</span><span class="top-item__name">${pr.title}</span><span class="top-item__cnt">${pr.orders} зам</span></div>`
  ).join('')
  appEl.querySelector('.screen').innerHTML = `
    <div class="kpi-row">
      ${kpiBlock(os.total || 0, 'Всього')}
      ${kpiBlock(os.new || 0, 'Нових')}
      ${kpiBlock(os.confirmed || 0, 'Підтверджено')}
      ${kpiBlock(os.delivered || 0, 'Доставлено')}
    </div>
    <h3>🏆 Топ товарів</h3>
    <div class="top-list">${topHtml || '<p class="muted small">Немає даних.</p>'}</div>
    <div class="analytics-actions">
      <button class="btn btn--outline" id="analyticsRefresh">🔄 Оновити</button>
      <button class="btn btn--outline btn--danger" id="analyticsReset">🧹 Скинути лічильники</button>
    </div>`
  appEl.querySelector('#analyticsRefresh')?.addEventListener('click', () => render())
  appEl.querySelector('#analyticsReset')?.addEventListener('click', () => {
    TG.confirm('Скинути лічильники? Виконані замовлення зникнуть зі статистики.', async (ok) => {
      if (!ok) return
      try {
        await API.adminResetAnalytics()
        TG.notify('success')
        render()
      } catch (e) { TG.notify('error'); TG.showAlert('Помилка: ' + e.message) }
    })
  })
})

document.addEventListener('click', async (e) => {
  if (e.target.closest('#csvExport')) {
    try {
      const url = '/api/admin/export-csv?tgInitData=' + encodeURIComponent(TG.initData)
      const r = await fetch(url)
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || `HTTP ${r.status}`)
      }
      const blob = await r.blob()
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(blob),
        download: 'products.csv',
      })
      document.body.appendChild(a)
      a.click()
      setTimeout(() => { URL.revokeObjectURL(a.href); document.body.removeChild(a) }, 1000)
    } catch (err) { TG.showAlert('Помилка експорту: ' + err.message) }
  }
})
document.addEventListener('change', async (e) => {
  if (e.target.id === 'csvImport') {
    const file = e.target.files[0]
    if (!file) return
    const form = new FormData()
    form.append('file', file)
    try {
      const r = await fetch(API.base + '/admin/import-csv', { method: 'POST', headers: { 'x-tg-init-data': TG.initData }, body: form })
      const d = await r.json()
      TG.notify('success')
      TG.showAlert(`Імпорт: ${d.imported} записів`)
    } catch (e) { TG.notify('error'); TG.showAlert('Помилка імпорту: ' + e.message) }
  }
})

// ---------- ПІДТРИМКА / ПИТАННЯ ----------
route('support', async () => {
  appEl.innerHTML = `
    <header class="appbar">
      <button class="appbar__back" data-back>‹</button>
      <div class="appbar__title">Підтримка</div>
    </header>
    <div class="screen">
      <div class="support">
        <div class="support__hint">💬 Напишіть нам запитання — менеджер відповість вам у чаті бота.</div>
        <form id="supportForm" class="form">
          <label class="field"><span>Ваше запитання</span>
            <textarea name="text" rows="5" required maxlength="2000" placeholder="Напишіть повідомлення…"></textarea></label>
        </form>
      </div>
    </div>`
  appEl.querySelector('[data-back]')?.addEventListener('click', () => history.back())
  bindCommon()
  const form = appEl.querySelector('#supportForm')
  TG.mainButton('Надіслати', async () => {
    if (!form.reportValidity()) return
    const text = String(new FormData(form).get('text') || '').trim()
    if (!text) return
    try {
      TG.raw?.MainButton?.showProgress?.()
      await API.support(text)
      TG.notify('success')
      appEl.querySelector('.support').innerHTML = `<div class="empty"><div class="empty__ic">✅</div><p>Дякуємо! Ми відповімо вам у чаті бота найближчим часом.</p><button class="btn btn--primary" data-go="home">На головну</button></div>`
      bindCommon()
      TG.hideMainButton()
    } catch (e) {
      TG.showAlert('Не вдалося надіслати: ' + e.message)
    } finally {
      TG.raw?.MainButton?.hideProgress?.()
    }
  })
})

// ---------- helpers ----------
function emptyHtml(text, ic = '🍬', btn, btnRoute) {
  return `<div class="empty"><div class="empty__ic">${ic}</div><p>${text}</p>${
    btn ? `<button class="btn btn--primary" data-go="${btnRoute}">${btn}</button>` : ''
  }</div>`
}

async function addToCart(id, qty = 1, packLabel = null) {
  try {
    const cart = await API.cartAdd(id, qty, packLabel)
    store.setCart(cart)
  } catch (e) {
    if (e.code === 'out_of_stock') TG.showAlert('Товар закінчився')
    else TG.showAlert('Помилка: ' + e.message)
  }
}

function bindCommon() {
  appEl.querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.go)),
  )
  appEl.querySelectorAll('[data-prod]').forEach((c) =>
    c.addEventListener('click', (e) => {
      if (e.target.closest('[data-add]')) return
      go('product/' + c.dataset.prod)
    }),
  )
  appEl.querySelectorAll('[data-add]').forEach((b) =>
    b.addEventListener('click', async (e) => {
      e.stopPropagation()
      const id = Number(b.dataset.add)
      const prod = store.productById(id)
      // Якщо є фасовки — відкриваємо картку, щоб обрати
      if (prod && prod.packs && prod.packs.length) {
        TG.haptic('light')
        go('product/' + id)
        return
      }
      TG.haptic('light')
      await addToCart(id)
      b.classList.add('added')
      setTimeout(() => b.classList.remove('added'), 600)
    }),
  )
  appEl.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      activeCat = Number(b.dataset.cat)
      go('catalog')
    }),
  )
  bindFavBtns(appEl)
}

// ============ BOOT ============
async function boot() {
  TG.init()
  try {
    const data = await API.bootstrap()
    store.set({
      user: data.user,
      shopName: data.shopName,
      categories: data.categories || [],
      products: data.products || [],
      purchasedIds: data.purchasedIds || [],
    })
    store.setCart(data.cart ? buildCartFromBootstrap(data.cart) : { items: [], total: 0, count: 0 })
    tabbar.classList.remove('hidden')
    if (!location.hash) location.hash = '#home'
    render()
  } catch (e) {
    appEl.innerHTML = errorView(e)
  }
}

// bootstrap.cart вже в клієнтському форматі (масив) — рахуємо підсумки
function buildCartFromBootstrap(items) {
  const total = items.reduce((s, i) => s + (i.lineTotal || i.unitPrice * i.qty), 0)
  const count = items.reduce((s, i) => s + i.qty, 0)
  return { items, total, count }
}

boot()
