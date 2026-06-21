// ============================================================
//  Каркас сторінки: <head>, шапка, підвал. SSR без залежностей.
// ============================================================
import { site, absUrl, botLink } from './site.js'
import { esc, categoryPath } from './util.js'
import { categoryIcon, icon } from './icons.js'
import { metaTags, analyticsHead, jsonLdOrganization, jsonLdWebsite, jsonLdLocalBusiness } from './seo.js'

export const NAV = [
  { href: '/', label: 'Головна' },
  { href: '/catalog', label: 'Каталог' },
  { href: '/blog', label: 'Блог' },
  { href: '/delivery', label: 'Доставка та оплата' },
  { href: '/about', label: 'Про нас' },
  { href: '/contacts', label: 'Контакти' },
]

function header(active, navCategories, activeCatId) {
  const links = NAV.map(
    (n) =>
      `<a class="nav__link${active === n.href ? ' is-active' : ''}" href="${n.href}">${esc(n.label)}</a>`,
  ).join('')
  const catbar =
    navCategories && navCategories.length
      ? `
  <div class="catbar"><div class="container catbar__row">
    <a class="catpill${!activeCatId ? ' is-active' : ''}" href="/catalog">${icon('candy')} Усі товари</a>
    ${navCategories
      .map(
        (c) =>
          `<a class="catpill${activeCatId === c.id ? ' is-active' : ''}" href="${categoryPath(c)}">${categoryIcon(c)} ${esc(c.title)}</a>`,
      )
      .join('')}
  </div></div>`
      : ''
  return `
<header class="site-header" id="top">
  <div class="container site-header__row">
    <a class="logo" href="/" aria-label="${esc(site.name)}">
      <img class="logo__img" src="/assets/img/logo-mark.png" alt="${esc(site.name)}" width="46" height="46" />
      <span class="logo__text">Wow<span class="logo__accent">Smak</span></span>
    </a>
    <form class="header-search" action="/catalog" method="get" role="search">
      <input type="search" name="q" placeholder="Пошук смаколиків…" aria-label="Пошук товарів" />
      <button type="submit" aria-label="Знайти">🔍</button>
    </form>
    <button class="burger" id="burger" aria-label="Меню" aria-expanded="false"><span></span><span></span><span></span></button>
    <nav class="nav" id="nav">${links}</nav>
    <div class="site-header__actions">
      <a class="icon-btn" href="/favorites" id="favLink" aria-label="Обране" title="Обране">
        ♡<span class="cart-badge" id="favBadge" hidden>0</span>
      </a>
      <a class="icon-btn account-link" href="/account" id="accountLink" aria-label="Кабінет" title="Кабінет / Вхід через Telegram">
        👤<span class="account-name" id="accountName" hidden></span>
      </a>
      <a class="icon-btn cart-link" href="/cart" aria-label="Кошик">
        🛒<span class="cart-badge" id="cartBadge" hidden>0</span>
      </a>
    </div>
  </div>
  ${catbar}
</header>`
}

function bottomNav(active) {
  const item = (href, ico, label) =>
    `<a href="${href}" class="${active === href ? 'is-active' : ''}">${ico}<span>${label}</span></a>`
  return `
<nav class="bottom-nav" aria-label="Нижнє меню">
  ${item('/', '🏠', 'Головна')}
  ${item('/catalog', '🧺', 'Каталог')}
  ${item('/cart', '🛒', 'Кошик')}
  ${item('/favorites', '♡', 'Обране')}
  ${item('/account', '👤', 'Профіль')}
</nav>`
}

function footer() {
  const social = []
  if (site.instagram) social.push(`<a href="${esc(site.instagram)}" rel="nofollow noopener" target="_blank">Instagram</a>`)
  if (site.facebook) social.push(`<a href="${esc(site.facebook)}" rel="nofollow noopener" target="_blank">Facebook</a>`)
  social.push(`<a href="${esc(botLink())}" rel="nofollow noopener" target="_blank">Telegram</a>`)
  const navLinks = NAV.map((n) => `<a href="${n.href}">${esc(n.label)}</a>`).join('')
  return `
<footer class="site-footer">
  <div class="container site-footer__grid">
    <div class="site-footer__col">
      <div class="logo logo--footer"><img class="logo__img" src="/assets/img/logo-mark.png" alt="${esc(site.name)}" width="40" height="40" /><span class="logo__text">Wow<span class="logo__accent">Smak</span></span></div>
      <p class="muted">${esc(site.tagline)}</p>
      <p class="muted">🚚 Доставка по всій ${esc(site.areaServed || 'Україні')}</p>${site.city ? `
      <p class="muted">📍 ${esc(site.city)}${site.region ? ', ' + esc(site.region) : ''}</p>` : ''}
    </div>
    <div class="site-footer__col">
      <h4>Магазин</h4>
      <nav class="footer-nav">${navLinks}</nav>
    </div>
    <div class="site-footer__col">
      <h4>Контакти</h4>
      <p><a href="tel:${esc(site.phone.replace(/[^+\d]/g, ''))}">${esc(site.phone)}</a></p>
      <p><a href="mailto:${esc(site.email)}">${esc(site.email)}</a></p>
      <div class="social">${social.join('')}</div>
    </div>
  </div>
  <div class="site-footer__bottom">
    <div class="container">© ${new Date().getFullYear()} ${esc(site.name)}. Усі права захищені.</div>
  </div>
</footer>`
}

// Основна функція обгортки сторінки.
// opts: { meta, jsonLd: [], active, bodyClass, navCategories, activeCatId }
export function layout(content, opts = {}) {
  const { meta = {}, jsonLd = [], active = '', bodyClass = '', navCategories = null, activeCatId = null } = opts
  const baseJsonLd = [jsonLdOrganization(), jsonLdWebsite(), jsonLdLocalBusiness()]
  const allJsonLd = [...baseJsonLd, ...jsonLd].filter(Boolean).join('\n  ')
  return `<!DOCTYPE html>
<html lang="${site.lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script>(function(){try{var m=document.cookie.match(/(?:^|; )wow_theme=([^;]+)/);document.documentElement.setAttribute('data-theme',m?decodeURIComponent(m[1]):'1');}catch(e){document.documentElement.setAttribute('data-theme','1');}})();</script>
  <meta name="theme-color" content="#0e1016" />
  ${metaTags({ ...meta })}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Comfortaa:wght@600;700&display=swap" rel="stylesheet" />
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml" />
  <link rel="alternate icon" href="/assets/img/favicon-32.png" sizes="32x32" type="image/png" />
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png" />
  <link rel="stylesheet" href="/assets/css/site.css?v=3" />${analyticsHead()}
  ${allJsonLd}
</head>
<body class="${esc(bodyClass)}">
  ${header(active, navCategories, activeCatId)}
  <main id="main">${content}</main>
  ${footer()}
  ${bottomNav(active)}
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
  <div class="theme-switch" id="themeSwitch">
    <div class="theme-switch__panel">
      <h4>Оберіть дизайн</h4>
      <p>Три варіанти — обери, що подобається</p>
      <button class="theme-opt" data-theme-set="1" type="button"><span class="theme-opt__sw theme-opt__sw--1"></span><span>Помаранчева<small>Темна (як референс)</small></span></button>
      <button class="theme-opt" data-theme-set="2" type="button"><span class="theme-opt__sw theme-opt__sw--2"></span><span>Неон<small>Темна рожева</small></span></button>
      <button class="theme-opt" data-theme-set="3" type="button"><span class="theme-opt__sw theme-opt__sw--3"></span><span>Цукеркова<small>Світла</small></span></button>
    </div>
    <button class="theme-switch__toggle" id="themeToggle" type="button" aria-label="Змінити дизайн">🎨</button>
  </div>
  <script src="/assets/js/site.js?v=3" defer></script>
</body>
</html>`
}
