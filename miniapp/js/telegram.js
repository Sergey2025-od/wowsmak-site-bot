// Обгортка над Telegram WebApp SDK.
// Якщо відкрито поза Telegram (браузер) — працюємо в dev-режимі.
const tg = window.Telegram?.WebApp

export const TG = {
  raw: tg,
  available: Boolean(tg && tg.initData),
  initData: tg?.initData || '',

  init() {
    if (!tg) return
    tg.ready()
    tg.expand()
    try {
      tg.setHeaderColor('#0f0712')
      tg.setBackgroundColor('#0f0712')
    } catch {}
    // Застосовуємо кольори теми Telegram до CSS-змінних (опційно)
    document.documentElement.style.setProperty(
      '--tg-bottom',
      (tg.viewportStableHeight ? 0 : 0) + 'px',
    )
  },

  user() {
    return tg?.initDataUnsafe?.user || null
  },

  haptic(type = 'light') {
    try {
      tg?.HapticFeedback?.impactOccurred(type)
    } catch {}
  },

  notify(type = 'success') {
    try {
      tg?.HapticFeedback?.notificationOccurred(type)
    } catch {}
  },

  // Головна кнопка Telegram (внизу)
  mainButton(text, onClick) {
    if (!tg?.MainButton) return
    const mb = tg.MainButton
    mb.setText(text)
    try { mb.setParams({ color: '#ff2d8e', text_color: '#ffffff' }) } catch {}
    mb.offClick(mb.__cb)
    mb.__cb = onClick
    mb.onClick(onClick)
    mb.show()
    mb.enable()
  },

  hideMainButton() {
    try {
      tg?.MainButton?.hide()
    } catch {}
  },

  showAlert(msg) {
    if (tg?.showAlert) tg.showAlert(msg)
    else alert(msg)
  },

  // Підтвердження дії. cb(ok: boolean)
  confirm(msg, cb) {
    try {
      if (tg?.showConfirm) {
        tg.showConfirm(msg, (ok) => cb(Boolean(ok)))
        return
      }
    } catch {}
    cb(window.confirm(msg))
  },

  // Запит номера телефону користувача (Telegram ділиться контактом).
  // cb(shared: boolean, phone: string|null)
  requestContact(cb) {
    try {
      if (tg?.requestContact) {
        tg.requestContact((shared, res) => {
          const phone =
            res?.responseUnsafe?.contact?.phone_number ||
            res?.response?.contact?.phone_number ||
            res?.contact?.phone_number ||
            null
          cb(Boolean(shared), phone)
        })
        return true
      }
    } catch {}
    return false
  },

  // Геолокація користувача. cb(coords: {latitude, longitude}|null)
  getLocation(cb) {
    const lm = tg?.LocationManager
    if (lm?.getLocation) {
      try {
        const run = () => lm.getLocation((data) => cb(data && data.latitude != null ? data : null))
        if (lm.isInited) run()
        else lm.init(run)
        return true
      } catch {}
    }
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => cb({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => cb(null),
        { enableHighAccuracy: true, timeout: 10000 },
      )
      return true
    }
    return false
  },

  close() {
    tg?.close()
  },
}
