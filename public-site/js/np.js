// Автопідказка адрес Нової Пошти для оформлення замовлення.
// Ходить на серверні проксі /np/cities та /np/warehouses (ключ API — лише на сервері).
(function () {
  var cityInput = document.getElementById('npCity')
  if (!cityInput) return
  var whInput = document.getElementById('npWarehouse')
  var addrHidden = document.getElementById('npAddress')
  var cityList = document.getElementById('npCityList')
  var whList = document.getElementById('npWhList')
  var cityRef = ''

  function compose() {
    var c = (cityInput.value || '').trim()
    var w = (whInput.value || '').trim()
    if (addrHidden) addrHidden.value = w ? c + ', ' + w : c
  }
  function hide(el) { el.innerHTML = ''; el.style.display = 'none' }
  function show(el) { el.style.display = 'block' }
  function debounce(fn, ms) {
    var t
    return function () {
      var a = arguments, c = this
      clearTimeout(t)
      t = setTimeout(function () { fn.apply(c, a) }, ms)
    }
  }
  function renderList(listEl, items, onPick) {
    listEl.innerHTML = ''
    if (!items.length) { hide(listEl); return }
    items.forEach(function (it) {
      var div = document.createElement('div')
      div.className = 'np-item'
      div.textContent = it.label
      div.addEventListener('mousedown', function (e) {
        e.preventDefault()
        onPick(it)
        hide(listEl)
      })
      listEl.appendChild(div)
    })
    show(listEl)
  }

  var searchCities = debounce(function () {
    compose()
    var q = cityInput.value.trim()
    if (q.length < 2) { hide(cityList); return }
    fetch('/np/cities?q=' + encodeURIComponent(q))
      .then(function (r) { return r.json() })
      .then(function (d) {
        var items = (d.items || []).map(function (a) {
          return { label: a.present, ref: a.ref, name: a.present }
        })
        renderList(cityList, items, function (it) {
          cityInput.value = it.name
          cityRef = it.ref
          whInput.value = ''
          compose()
          whInput.focus()
          loadWarehouses('')
        })
      })
      .catch(function () { hide(cityList) })
  }, 250)

  function loadWarehouses(q) {
    if (!cityRef) { hide(whList); return }
    fetch('/np/warehouses?ref=' + encodeURIComponent(cityRef) + '&q=' + encodeURIComponent(q || ''))
      .then(function (r) { return r.json() })
      .then(function (d) {
        var items = (d.items || []).map(function (w) {
          return { label: w.name, name: w.name }
        })
        renderList(whList, items, function (it) {
          whInput.value = it.name
          compose()
        })
      })
      .catch(function () { hide(whList) })
  }

  var searchWh = debounce(function () {
    compose()
    loadWarehouses(whInput.value.trim())
  }, 250)

  cityInput.addEventListener('input', searchCities)
  whInput.addEventListener('input', searchWh)
  whInput.addEventListener('focus', function () { if (cityRef) loadWarehouses(whInput.value.trim()) })
  cityInput.addEventListener('blur', function () { setTimeout(function () { hide(cityList) }, 160) })
  whInput.addEventListener('blur', function () { setTimeout(function () { hide(whList) }, 160) })
  compose()
})();
