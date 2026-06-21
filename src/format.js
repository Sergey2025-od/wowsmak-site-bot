// Ціна з урахуванням акції
export function effectivePrice(p) {
  return p.sale_price != null ? Number(p.sale_price) : Number(p.price)
}

// Форматування ціни
export function price(value) {
  return `${Number(value).toLocaleString('uk-UA')} ₴`
}

// Ціна із округленням до копійок (для ціни за штуку)
function money2(value) {
  return price(Math.round(Number(value) * 100) / 100)
}

// Кроки калькулятора націнки
const MARKUP_STEPS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

// Рядок ціни: зі знижкою або без
export function priceLine(p) {
  if (p.sale_price != null) {
    return `<s>${price(p.price)}</s> → <b>${price(p.sale_price)}</b> 🔥`
  }
  return `<b>${price(p.price)}</b>`
}

// Позначка наявності
export function stockLabel(p) {
  if (p.stock == null) return ''
  if (p.stock <= 0) return '❌ Немає в наявності'
  if (p.stock <= 5) return `⚠️ Залишилось ${p.stock} шт.`
  return '✅ В наявності'
}

// Фасовки товару: [{ label, price }] (кожна зі своєю ціною)
export function parsePacks(p) {
  let raw = p && p.packs
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && x.label != null && String(x.label).trim() !== '')
    .map((x) => ({
      label: String(x.label).trim(),
      price: x.price != null && Number.isFinite(Number(x.price)) ? Number(x.price) : null,
    }))
}

// Смаки (вкуси) товару: масив рядків
export function flavorList(p) {
  if (!p || !p.flavors) return []
  return String(p.flavors)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// Текст картки товару (для покупця)
export function productCaption(p) {
  let text = `<b>${p.title}</b>\n`
  if (p.description) text += `${p.description}\n`
  if (p.weight_g) text += `⚖️ Вага: ${p.weight_g} г\n`
  const flavors = flavorList(p)
  if (flavors.length) text += `🍓 Смаки: ${flavors.join(', ')}\n`
  const s = stockLabel(p)
  if (s) text += `${s}\n`
  text += `\nЦіна: ${priceLine(p)}`
  const pu = perUnit(p)
  if (pu) text += `\n≈ ${money2(pu.sellPerUnit)} / шт. (в упаковці ${pu.units} шт.)`
  const packs = parsePacks(p)
  if (packs.length) text += `\n📦 Фасовка: ${packs.map((x) => x.label).join(', ')}`
  return text
}

// Прибуток і націнка (тільки для адміна)
export function profitInfo(p) {
  if (p.cost_price == null) return null
  const cost = Number(p.cost_price)
  const sell = effectivePrice(p)
  const profit = sell - cost
  const markup = cost > 0 ? (profit / cost) * 100 : null  // націнка від закупівлі
  const margin = sell > 0 ? (profit / sell) * 100 : null  // маржа від продажу
  return { cost, sell, profit, markup, margin }
}

// Ціна за штуку (якщо задано кількість штук в упаковці)
export function perUnit(p) {
  const units = p.units_per_pack
  if (!units || units <= 0) return null
  const sellPerUnit = effectivePrice(p) / units
  const costPerUnit = p.cost_price != null ? Number(p.cost_price) / units : null
  return { units, sellPerUnit, costPerUnit }
}

// Текст калькулятора націнки (для адміна)
export function markupCalc(p) {
  if (p.cost_price == null) {
    return '🧮 <b>Калькулятор націнки</b>\n\nСпочатку вкажіть ціну закупівлі товару, щоб розрахувати націнку.'
  }
  const cost = Number(p.cost_price)
  const units = p.units_per_pack && p.units_per_pack > 0 ? p.units_per_pack : null
  let text = `🧮 <b>Калькулятор націнки — #${p.id} ${p.title}</b>\n\n`
  text += `Закупівля: ${price(cost)}${units ? ' (за упаковку)' : ''}\n`
  if (units) {
    text += `В упаковці: ${units} шт. → закупівля за шт.: ${money2(cost / units)}\n`
  }
  text += `\nНацінка → ціна продажу${units ? ' (упаковка | шт.)' : ''}:\n`
  for (const m of MARKUP_STEPS) {
    const sell = cost * (1 + m / 100)
    text += units ? `+${m}% → ${money2(sell)} | ${money2(sell / units)}\n` : `+${m}% → ${money2(sell)}\n`
  }
  if (p.rec_markup != null) {
    const rm = Number(p.rec_markup)
    const sell = cost * (1 + rm / 100)
    text += `\n⭐ Рекомендована націнка: ${rm}% → ${money2(sell)}`
    if (units) text += ` (${money2(sell / units)}/шт.)`
  } else {
    text += `\n⭐ Рекомендовану націнку можна задати кнопкою «⭐ Реком.%».`
  }
  return text
}

// Картка товару для адміна (з id і службовими даними)
export function adminProductCaption(p) {
  let text = `<b>#${p.id} — ${p.title}</b>\n`
  if (p.category) text += `Категорія: ${p.category.title}\n`
  if (p.barcode) text += `Штрих-код: <code>${p.barcode}</code>\n`
  if (p.description) text += `${p.description}\n`
  text += `Ціна продажу: ${priceLine(p)}\n`
  const pi = profitInfo(p)
  if (pi) {
    const markupStr = pi.markup == null ? '—' : `${pi.markup.toFixed(0)}%`
    const marginStr = pi.margin == null ? '—' : `${pi.margin.toFixed(0)}%`
    const sign = pi.profit >= 0 ? '🟢' : '🔴'
    text += `Закупівля: ${price(pi.cost)}\n`
    text += `${sign} Прибуток: ${price(pi.profit)}  ·  Націнка: ${markupStr}  ·  Маржа: ${marginStr}\n`
  } else {
    text += `Закупівля: — (не задана)\n`
  }
  const pu = perUnit(p)
  if (pu) {
    text += `В упаковці: ${pu.units} шт.\n`
    let perLine = `Ціна за шт.: продаж ${money2(pu.sellPerUnit)}`
    if (pu.costPerUnit != null) perLine += ` · закупівля ${money2(pu.costPerUnit)}`
    text += `${perLine}\n`
  }
  if (p.rec_markup != null) text += `Реком. націнка: ${Number(p.rec_markup)}%\n`
  if (p.weight_g) text += `Вага: ${p.weight_g} г\n`
  const aFlavors = flavorList(p)
  if (aFlavors.length) text += `Смаки: ${aFlavors.join(', ')}\n`
  const aPacks = parsePacks(p)
  if (aPacks.length) text += `Фасовка: ${aPacks.map((x) => x.label).join(' · ')}\n`
  text += `Залишок: ${p.stock == null ? '∞ (не враховується)' : p.stock + ' шт.'}\n`
  text += `Фото: ${p.image_url ? '✅' : '—'}  ·  Відео: ${p.video_url ? '✅' : '—'}`
  return text
}

// Звіт по заробітку (для адміна)
export function earningsReport(data) {
  const labels = { day: 'сьогодні', week: 'за тиждень', month: 'за місяць' }
  let text = `💰 <b>Заробіток — ${labels[data.period] || ''}</b>\n`
  text += `🧾 Замовлень: ${data.ordersCount}\n`
  text += `💵 Виручка: ${price(data.revenue)}\n`
  const sign = data.profit >= 0 ? '🟢' : '🔴'
  text += `${sign} Чистий прибуток: <b>${price(data.profit)}</b>\n`
  if (!data.items.length) {
    text += `\nЗа цей період продажів немає.`
    return text
  }
  text += `\n🛒 <b>Продані товари:</b>\n`
  for (const it of data.items) {
    text += `\n• <b>${it.title}</b> × ${it.qty}\n`
    if (it.hasCost) {
      const s = it.profit >= 0 ? '🟢' : '🔴'
      text += `  закуп. ${price(it.cost)} / прод. ${price(it.sell)} → ${s} ${price(it.profit)}\n`
    } else {
      text += `  закуп. — / прод. ${price(it.sell)} → —\n`
    }
  }
  return text
}

// Підсумок кошика
export function cartSummary(cart) {
  if (!cart.length) return '🛒 Ваш кошик порожній.\n\nВідкрийте 🍬 Каталог, щоб обрати смаколики.'
  let total = 0
  let text = '🛒 <b>Ваш кошик:</b>\n\n'
  for (const i of cart) {
    const unit = i.pack_price != null ? Number(i.pack_price) : effectivePrice(i.product)
    const sum = unit * i.qty
    total += sum
    const name = i.pack_label ? `${i.product.title} (${i.pack_label})` : i.product.title
    text += `• ${name} × ${i.qty} = ${price(sum)}\n`
  }
  text += `\n<b>Разом: ${price(total)}</b>`
  return text
}
