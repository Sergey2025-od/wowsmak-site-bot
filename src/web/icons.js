// ============================================================
//  Іконки категорій (inline SVG, колір = currentColor).
//  Підбираються автоматично за назвою категорії.
// ============================================================

const S = (body) =>
  `<svg class="cat-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

const ICONS = {
  chocolate: S('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 9h16M4 14h16M9 4v16M14 4v16"/>'),
  lollipop: S('<circle cx="9" cy="9" r="6"/><path d="M9 5a4 4 0 0 1 4 4M13 13l6 6"/>'),
  gummy: S('<path d="M8 3a2 2 0 1 1 4 0M12 3a2 2 0 1 1 4 0"/><path d="M6 9a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a5 5 0 0 1-10 0"/><path d="M6 12a2 2 0 0 0 0 4"/><circle cx="10" cy="11" r=".6" fill="currentColor"/><circle cx="14" cy="11" r=".6" fill="currentColor"/>'),
  gift: S('<rect x="3" y="8" width="18" height="13" rx="1.5"/><path d="M3 12h18M12 8v13"/><path d="M12 8S9 8 8 6.5 9 4 10 4.5 12 8 12 8zM12 8s3 0 4-1.5S15 4 14 4.5 12 8 12 8z"/>'),
  cookie: S('<circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1" fill="currentColor"/><circle cx="14" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="14" r="1" fill="currentColor"/><circle cx="10" cy="15" r="1" fill="currentColor"/>'),
  drink: S('<path d="M6 4h12l-1.2 16.2a1 1 0 0 1-1 .8H8.2a1 1 0 0 1-1-.8z"/><path d="M6.5 9h11"/>'),
  nuts: S('<path d="M12 3c3 0 5 2 5 5 0 4-2 9-5 13C9 17 7 12 7 8c0-3 2-5 5-5z"/><path d="M9.5 9c1 1 4 1 5 0"/>'),
  snack: S('<path d="M7 3h10l-1 4v12a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V7z"/><path d="M7 7h10"/>'),
  candy: S('<circle cx="12" cy="12" r="5"/><path d="M7.5 9.5 3 7l1 4-1 4 4.5-2.5M16.5 9.5 21 7l-1 4 1 4-4.5-2.5"/>'),
}

const RULES = [
  [/шокол|chocol|шок/i, 'chocolate'],
  [/льодян|леден|карамел|lollip|caramel/i, 'lollipop'],
  [/мармел|желе|желей|жув|jelly|gummy|цукер/i, 'gummy'],
  [/подарун|набір|набор|gift|box|бокс/i, 'gift'],
  [/печив|печен|cookie|біск|вафл/i, 'cookie'],
  [/напо|напит|drink|сік|вод|лимонад/i, 'drink'],
  [/горіх|арах|орех|nut|кешью|мигд/i, 'nuts'],
  [/снек|снек|snack|чіпс|чипс|сухар|крекер/i, 'snack'],
]

export function categoryIconName(category) {
  const t = (category && (category.title || category.name)) || ''
  for (const [re, name] of RULES) if (re.test(t)) return name
  return 'candy'
}

// Повертає inline SVG для категорії.
export function categoryIcon(category) {
  return ICONS[categoryIconName(category)] || ICONS.candy
}

export function icon(name) {
  return ICONS[name] || ICONS.candy
}
