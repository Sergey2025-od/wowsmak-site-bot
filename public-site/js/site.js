// ============================================================
//  Клієнтський JS сайту: кошик, меню, галерея, обране, таби, фільтри, теми
// ============================================================
(function () {
  'use strict'

  var toastEl = document.getElementById('toast')
  var toastTimer
  function toast(msg) {
    if (!toastEl) return
    toastEl.textContent = msg
    toastEl.classList.add('is-visible')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-visible') }, 2200)
  }

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
    }).then(function (r) { return r.json() })
  }

  function formatPrice(v) {
    var n = Number(v)
    if (!isFinite(n)) return v
    return new Intl.NumberFormat('uk-UA').format(n) + ' \u20b4'
  }

  function setBadgeEl(id, count) {
    var b = document.getElementById(id)
    if (!b) return
    if (count > 0) { b.textContent = count; b.hidden = false } else { b.hidden = true }
  }
  function setCartBadge(count) { setBadgeEl('cartBadge', count); setBadgeEl('cartBadgeM', count) }

  fetch('/cart/state').then(function (r) { return r.json() }).then(function (d) {
    setCartBadge(d.count || 0)
  }).catch(function () {})

  // ---------- Мобільне меню ----------
  var burger = document.getElementById('burger')
  var nav = document.getElementById('nav')
  if (burger && nav) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open')
      burger.setAttribute('aria-expanded', open ? 'true' : 'false')
    })
  }

  // ---------- Кількість ----------
  document.querySelectorAll('[data-qty]').forEach(function (wrap) {
    var input = wrap.querySelector('.qty__input')
    if (!input) return
    var dec = wrap.querySelector('[data-qty-dec]')
    var inc = wrap.querySelector('[data-qty-inc]')
    if (dec) dec.addEventListener('click', function () { input.value = Math.max(1, (parseInt(input.value, 10) || 1) - 1) })
    if (inc) inc.addEventListener('click', function () { input.value = Math.min(99, (parseInt(input.value, 10) || 1) + 1) })
  })

  // ---------- Ціна = ціна × кількість (з урахуванням фасовки) ----------
  var priceWrap = document.getElementById('productPrice')
  var qtyInputEl = document.getElementById('qtyInput')
  var baseUnitPrice = priceWrap ? Number(priceWrap.getAttribute('data-unit-price')) : NaN
  var unitPrice = baseUnitPrice
  function curQty() { return qtyInputEl ? Math.max(1, parseInt(qtyInputEl.value, 10) || 1) : 1 }
  function renderProductPrice() {
    if (!priceWrap || !isFinite(unitPrice)) return
    var now = priceWrap.querySelector('.price__now')
    if (now) now.textContent = formatPrice(unitPrice * curQty())
  }

  // ---------- Варіанти (packs) ----------
  var activePack = null
  var packsWrap = document.getElementById('packs')
  if (packsWrap) {
    packsWrap.querySelectorAll('.pack').forEach(function (btn, i) {
      if (i === 0) {
        activePack = btn.getAttribute('data-pack')
        var p0 = btn.getAttribute('data-price')
        if (p0) unitPrice = Number(p0)
      }
      btn.addEventListener('click', function () {
        packsWrap.querySelectorAll('.pack').forEach(function (b) { b.classList.remove('is-active') })
        btn.classList.add('is-active')
        activePack = btn.getAttribute('data-pack')
        var price = btn.getAttribute('data-price')
        unitPrice = price ? Number(price) : baseUnitPrice
        renderProductPrice()
      })
    })
  }

  // Перерахунок суми при зміні кількості на сторінці товару
  if (qtyInputEl) {
    var qtyWrap = qtyInputEl.closest('[data-qty]')
    if (qtyWrap) {
      qtyWrap.addEventListener('click', function (e) {
        if (e.target.closest('[data-qty-inc],[data-qty-dec]')) setTimeout(renderProductPrice, 0)
      })
    }
    qtyInputEl.addEventListener('change', renderProductPrice)
    qtyInputEl.addEventListener('input', renderProductPrice)
    renderProductPrice()
  }

  // ---------- Додавання в кошик ----------
  document.querySelectorAll('[data-add]').forEach(function (btn) {
    if (btn.disabled) return
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-add')
      var qtyInput = document.getElementById('qtyInput')
      var qty = btn.id === 'addToCart' && qtyInput ? parseInt(qtyInput.value, 10) || 1 : 1
      var pack = btn.id === 'addToCart' ? activePack : null
      btn.disabled = true
      post('/cart/add', { id: id, qty: qty, pack: pack }).then(function (d) {
        setCartBadge(d.count || 0)
        toast('\u0414\u043e\u0434\u0430\u043d\u043e \u0432 \u043a\u043e\u0448\u0438\u043a \ud83d\uded2')
      }).catch(function () { toast('\u041f\u043e\u043c\u0438\u043b\u043a\u0430') }).finally(function () { btn.disabled = false })
    })
  })

  // ---------- Операції в кошику ----------
  document.querySelectorAll('.cart-row').forEach(function (row) {
    var id = row.getAttribute('data-id')
    var pack = row.getAttribute('data-pack') || null
    var input = row.querySelector('[data-cart-qty]')
    var dec = row.querySelector('[data-cart-dec]')
    var inc = row.querySelector('[data-cart-inc]')
    var rem = row.querySelector('[data-cart-remove]')
    function update(qty) {
      post('/cart/update', { id: id, qty: qty, pack: pack }).then(function (d) {
        setCartBadge(d.count || 0); location.reload()
      })
    }
    if (dec) dec.addEventListener('click', function () { update(Math.max(0, (parseInt(input.value, 10) || 1) - 1)) })
    if (inc) inc.addEventListener('click', function () { update((parseInt(input.value, 10) || 1) + 1) })
    if (input) input.addEventListener('change', function () { update(parseInt(input.value, 10) || 0) })
    if (rem) rem.addEventListener('click', function () {
      post('/cart/remove', { id: id, pack: pack }).then(function (d) { setCartBadge(d.count || 0); location.reload() })
    })
  })

  // ---------- Галерея ----------
  var galMain = document.getElementById('galleryMain')
  if (galMain) {
    document.querySelectorAll('.gallery__thumb').forEach(function (t) {
      t.addEventListener('click', function () {
        document.querySelectorAll('.gallery__thumb').forEach(function (x) { x.classList.remove('is-active') })
        t.classList.add('is-active')
        galMain.src = t.getAttribute('data-src')
      })
    })
    galMain.style.cursor = 'zoom-in'
    galMain.addEventListener('click', function () {
      var ov = document.createElement('div')
      ov.className = 'lightbox'
      var big = document.createElement('img')
      big.className = 'lightbox__img'
      big.src = galMain.src
      ov.appendChild(big)
      ov.addEventListener('click', function () { ov.remove() })
      document.body.appendChild(ov)
    })
  }

  // ---------- Зірковий рейтинг (форма відгуку) ----------
  document.querySelectorAll('[data-star-rate]').forEach(function (wrap) {
    var input = wrap.querySelector('input[name="rating"]')
    var starsEls = wrap.querySelectorAll('.star-rate__star')
    function paint(val) {
      starsEls.forEach(function (s) { s.classList.toggle('is-on', Number(s.getAttribute('data-val')) <= val) })
    }
    starsEls.forEach(function (s) {
      var val = Number(s.getAttribute('data-val'))
      s.addEventListener('click', function () { if (input) input.value = String(val); paint(val) })
      s.addEventListener('mouseenter', function () { paint(val) })
    })
    wrap.addEventListener('mouseleave', function () { paint(input ? Number(input.value) || 0 : 0) })
    paint(input ? Number(input.value) || 0 : 0)
  })

  // ---------- ОБРАНЕ (localStorage) ----------
  var FAV_KEY = 'wow_fav'
  function favRead() {
    try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]') } catch (e) { return [] }
  }
  function favWrite(list) {
    try { localStorage.setItem(FAV_KEY, JSON.stringify(list)) } catch (e) {}
  }
  function favHas(id) { return favRead().some(function (x) { return String(x.id) === String(id) }) }
  function favBadges() {
    var n = favRead().length
    setBadgeEl('favBadge', n); setBadgeEl('favBadgeM', n)
  }
  function favFromBtn(btn) {
    return {
      id: btn.getAttribute('data-fav'),
      title: btn.getAttribute('data-fav-title') || '',
      image: btn.getAttribute('data-fav-image') || '',
      price: btn.getAttribute('data-fav-price') || '',
      path: btn.getAttribute('data-fav-path') || '#',
    }
  }
  function favToggle(btn) {
    var id = btn.getAttribute('data-fav')
    var list = favRead()
    var idx = list.findIndex(function (x) { return String(x.id) === String(id) })
    if (idx >= 0) { list.splice(idx, 1); toast('\u0412\u0438\u0434\u0430\u043b\u0435\u043d\u043e \u0437 \u043e\u0431\u0440\u0430\u043d\u043e\u0433\u043e') }
    else { list.push(favFromBtn(btn)); toast('\u0414\u043e\u0434\u0430\u043d\u043e \u0432 \u043e\u0431\u0440\u0430\u043d\u0435 \u2665') }
    favWrite(list)
    favBadges(); favMarkAll()
    if (document.getElementById('favList')) favRender()
  }
  function favMarkAll() {
    document.querySelectorAll('[data-fav]').forEach(function (b) {
      var on = favHas(b.getAttribute('data-fav'))
      b.classList.toggle('is-on', on)
      b.textContent = on ? '\u2665' : '\u2661'
    })
  }
  function favRender() {
    var grid = document.getElementById('favList')
    var empty = document.getElementById('favEmpty')
    if (!grid) return
    var list = favRead()
    if (!list.length) {
      grid.innerHTML = ''
      if (empty) empty.hidden = false
      return
    }
    if (empty) empty.hidden = true
    grid.innerHTML = list.map(function (it) {
      return '<article class="pcard" data-price="' + it.price + '">' +
        '<div class="pcard__media">' +
        '<button class="pcard__fav is-on" data-fav="' + it.id + '" data-fav-title="' + esc(it.title) + '" data-fav-image="' + esc(it.image) + '" data-fav-price="' + it.price + '" data-fav-path="' + esc(it.path) + '" aria-label="\u041e\u0431\u0440\u0430\u043d\u0435">\u2665</button>' +
        '<a class="pcard__media-link" href="' + esc(it.path) + '">' + (it.image ? '<img class="pcard__img" src="' + esc(it.image) + '" alt="' + esc(it.title) + '" loading="lazy" />' : '<div class="pcard__img pcard__img--ph">\ud83c\udf6c</div>') + '</a>' +
        '</div>' +
        '<div class="pcard__body">' +
        '<h3 class="pcard__title"><a href="' + esc(it.path) + '">' + esc(it.title) + '</a></h3>' +
        '<div class="pcard__foot"><span class="price"><span class="price__now">' + formatPrice(it.price) + '</span></span>' +
        '<a class="pcard__add" href="' + esc(it.path) + '" style="text-decoration:none">\u2192</a></div>' +
        '</div></article>'
    }).join('')
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
    })
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-fav]')
    if (!btn) return
    e.preventDefault()
    favToggle(btn)
  })
  favBadges(); favMarkAll()
  if (document.getElementById('favList')) favRender()

  // ---------- Таби на сторінці товару ----------
  var tabsWrap = document.getElementById('productTabs')
  if (tabsWrap) {
    tabsWrap.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var id = tab.getAttribute('data-tab')
        tabsWrap.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('is-active', t === tab) })
        tabsWrap.querySelectorAll('.tabpanel').forEach(function (pnl) {
          pnl.classList.toggle('is-active', pnl.getAttribute('data-panel') === id)
        })
      })
    })
  }

  // ---------- Каталог: сортування ----------
  var pgrid = document.getElementById('productGrid')
  var sortSel = document.getElementById('sortSelect')
  if (sortSel && pgrid) {
    sortSel.addEventListener('change', function () {
      var cards = [].slice.call(pgrid.children)
      var v = sortSel.value
      cards.sort(function (a, b) {
        var pa = +a.getAttribute('data-price') || 0, pb = +b.getAttribute('data-price') || 0
        var sa = +a.getAttribute('data-sold') || 0, sb = +b.getAttribute('data-sold') || 0
        var ra = +a.getAttribute('data-rating') || 0, rb = +b.getAttribute('data-rating') || 0
        if (v === 'price-asc') return pa - pb
        if (v === 'price-desc') return pb - pa
        if (v === 'rating') return rb - ra
        return sb - sa
      })
      cards.forEach(function (c) { pgrid.appendChild(c) })
    })
  }

  // ---------- Каталог: фільтр ціни ----------
  var pApply = document.getElementById('priceApply')
  var pMin = document.getElementById('priceMin')
  var pMax = document.getElementById('priceMax')
  var pRange = document.getElementById('priceRange')
  var rCount = document.getElementById('resultCount')
  if (pRange && pMax) {
    pRange.addEventListener('input', function () { pMax.value = pRange.value })
    pMax.addEventListener('input', function () { pRange.value = pMax.value })
  }
  function applyPrice() {
    if (!pgrid) return
    var lo = parseFloat(pMin && pMin.value) || 0
    var hi = parseFloat(pMax && pMax.value) || Infinity
    var shown = 0
    pgrid.querySelectorAll('.pcard').forEach(function (card) {
      var pr = +card.getAttribute('data-price') || 0
      var ok = pr >= lo && pr <= hi
      card.style.display = ok ? '' : 'none'
      if (ok) shown++
    })
    if (rCount) rCount.textContent = shown
  }
  if (pApply) pApply.addEventListener('click', applyPrice)

  // ---------- Перемикач тем ----------
  var tsw = document.getElementById('themeSwitch')
  var ttoggle = document.getElementById('themeToggle')
  if (tsw && ttoggle) {
    var curTheme = function () { return document.documentElement.getAttribute('data-theme') || '1' }
    var markTheme = function () {
      tsw.querySelectorAll('[data-theme-set]').forEach(function (b) {
        b.classList.toggle('is-active', b.getAttribute('data-theme-set') === curTheme())
      })
    }
    ttoggle.addEventListener('click', function () { tsw.classList.toggle('is-open'); markTheme() })
    tsw.querySelectorAll('[data-theme-set]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.getAttribute('data-theme-set')
        document.documentElement.setAttribute('data-theme', t)
        document.cookie = 'wow_theme=' + t + ';path=/;max-age=31536000;samesite=lax'
        markTheme()
      })
    })
    document.addEventListener('click', function (e) {
      if (tsw.classList.contains('is-open') && !tsw.contains(e.target)) tsw.classList.remove('is-open')
    })
    markTheme()
  }

  // ---------- Аналітика ----------
  var checkoutForm = document.getElementById('checkoutForm')
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', function () {
      try {
        if (window.gtag) window.gtag('event', 'begin_checkout')
        if (window.fbq) window.fbq('track', 'InitiateCheckout')
      } catch (e) {}
    })
  }
})()

// ---------- Індикатор входу через Telegram ----------
(function () {
  var nameEl = document.getElementById('accountName')
  var link = document.getElementById('accountLink')
  if (!nameEl || !link) return
  fetch('/auth/state').then(function (r) { return r.json() }).then(function (d) {
    if (d && d.user && d.user.name) {
      nameEl.textContent = d.user.name
      nameEl.hidden = false
      link.title = '\u0412\u0438: ' + d.user.name
    }
  }).catch(function () {})
})()
