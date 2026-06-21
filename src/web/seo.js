// ============================================================
//  SEO: <head> мета-теги, Open Graph, Twitter, JSON-LD,
//  аналітика (GA4 / Meta Pixel), sitemap.xml, robots.txt
// ============================================================
import { site, absUrl } from './site.js'
import { esc, jsonLdSafe, priceNumber, clamp } from './util.js'

// ---------- <head> мета-теги ----------
export function metaTags({
  title,
  description,
  canonical = '/',
  image,
  type = 'website',
  noindex = false,
  keywords,
} = {}) {
  const fullTitle = title ? `${title} — ${site.name}` : `${site.name} — ${site.tagline}`
  const desc = clamp(description || site.description, 300)
  const url = absUrl(canonical)
  const ogImage = image ? absUrl(image) : absUrl('/assets/img/og-default.jpg')
  const parts = []
  parts.push(`<title>${esc(fullTitle)}</title>`)
  parts.push(`<meta name="description" content="${esc(desc)}" />`)
  if (keywords || site.keywords) parts.push(`<meta name="keywords" content="${esc(keywords || site.keywords)}" />`)
  parts.push(`<link rel="canonical" href="${esc(url)}" />`)
  if (noindex) parts.push(`<meta name="robots" content="noindex, follow" />`)
  else parts.push(`<meta name="robots" content="index, follow, max-image-preview:large" />`)
  if (site.googleSiteVerification)
    parts.push(`<meta name="google-site-verification" content="${esc(site.googleSiteVerification)}" />`)
  // Open Graph
  parts.push(`<meta property="og:type" content="${esc(type)}" />`)
  parts.push(`<meta property="og:site_name" content="${esc(site.name)}" />`)
  parts.push(`<meta property="og:title" content="${esc(fullTitle)}" />`)
  parts.push(`<meta property="og:description" content="${esc(desc)}" />`)
  parts.push(`<meta property="og:url" content="${esc(url)}" />`)
  parts.push(`<meta property="og:image" content="${esc(ogImage)}" />`)
  parts.push(`<meta property="og:locale" content="${esc(site.locale)}" />`)
  // Twitter
  parts.push(`<meta name="twitter:card" content="summary_large_image" />`)
  parts.push(`<meta name="twitter:title" content="${esc(fullTitle)}" />`)
  parts.push(`<meta name="twitter:description" content="${esc(desc)}" />`)
  parts.push(`<meta name="twitter:image" content="${esc(ogImage)}" />`)
  return parts.join('\n  ')
}

// ---------- JSON-LD ----------
function script(obj) {
  return `<script type="application/ld+json">${jsonLdSafe(obj)}</script>`
}

export function jsonLdOrganization() {
  const org = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    legalName: site.legalName,
    url: site.baseUrl,
    logo: absUrl('/assets/img/logo.png'),
    description: site.description,
  }
  const sameAs = [site.instagram, site.facebook, site.telegramBot].filter(Boolean)
  if (sameAs.length) org.sameAs = sameAs
  if (site.phone) {
    org.contactPoint = [
      {
        '@type': 'ContactPoint',
        telephone: site.phone,
        contactType: 'customer service',
        areaServed: site.country,
        availableLanguage: ['Ukrainian', 'Russian'],
      },
    ]
  }
  return script(org)
}

export function jsonLdWebsite() {
  return script({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: site.baseUrl,
    inLanguage: site.lang,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${site.baseUrl}/catalog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  })
}

// LocalBusiness — для локального SEO (місто/доставка)
export function jsonLdLocalBusiness() {
  const biz = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: site.name,
    image: absUrl('/assets/img/logo.png'),
    url: site.baseUrl,
    telephone: site.phone,
    email: site.email,
    priceRange: '₴₴',
    address: {
      '@type': 'PostalAddress',
      addressCountry: site.country,
    },
    areaServed: { '@type': 'Country', name: site.areaServed || 'Україна' },
    openingHours: site.openingHours,
  }
  if (site.city) biz.address.addressLocality = site.city
  if (site.region) biz.address.addressRegion = site.region
  if (site.streetAddress) biz.address.streetAddress = site.streetAddress
  if (site.postalCode) biz.address.postalCode = site.postalCode
  if (site.geoLat && site.geoLng) {
    biz.geo = { '@type': 'GeoCoordinates', latitude: site.geoLat, longitude: site.geoLng }
  }
  return script(biz)
}

export function jsonLdBreadcrumb(items) {
  return script({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absUrl(it.url),
    })),
  })
}

export function jsonLdProduct(p, { reviews } = {}) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    description: clamp(p.fullDescription || p.description || `${p.title} — ${site.name}`, 500),
    sku: String(p.id),
    brand: { '@type': 'Brand', name: site.name },
    offers: {
      '@type': 'Offer',
      url: absUrl(p.path),
      priceCurrency: site.currency,
      price: priceNumber(p.effectivePrice),
      availability: p.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: site.name },
    },
  }
  if (p.images && p.images.length) obj.image = p.images
  else if (p.image) obj.image = [p.image]
  if (p.category) obj.category = p.category.title
  if (reviews && reviews.count > 0 && reviews.avg != null) {
    obj.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: reviews.avg.toFixed(1),
      reviewCount: reviews.count,
    }
  }
  return script(obj)
}

export function jsonLdItemList(products) {
  return script({
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: products.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absUrl(p.path),
      name: p.title,
    })),
  })
}

export function jsonLdArticle(article) {
  return script({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    image: article.cover ? absUrl(article.cover) : absUrl('/assets/img/og-default.jpg'),
    datePublished: article.date,
    dateModified: article.updated || article.date,
    author: { '@type': 'Organization', name: site.name },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: { '@type': 'ImageObject', url: absUrl('/assets/img/logo.png') },
    },
    mainEntityOfPage: absUrl(`/blog/${article.slug}`),
    inLanguage: site.lang,
  })
}

export function jsonLdFaq(faqItems) {
  if (!faqItems || !faqItems.length) return ''
  return script({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  })
}

// ---------- Аналітика (вставляється у <head>) ----------
export function analyticsHead() {
  let out = ''
  if (site.gaId) {
    const gaSrc = 'https://www.googletagmanager.com/gtag/js?id=' + esc(site.gaId)
    out += `\n  <script async src="${gaSrc}"></script>\n  <script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${esc(site.gaId)}');</script>`
  }
  if (site.metaPixelId) {
    const pxImg = 'https://www.facebook.com/tr?id=' + esc(site.metaPixelId) + '&ev=PageView&noscript=1'
    out += `\n  <script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${esc(site.metaPixelId)}');fbq('track','PageView');</script>\n  <noscript><img height="1" width="1" style="display:none" src="${pxImg}"/></noscript>`
  }
  return out
}

// ---------- robots.txt ----------
export function robotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /cart',
    'Disallow: /checkout',
    'Disallow: /api/',
    'Disallow: /app/',
    '',
    `Sitemap: ${site.baseUrl}/sitemap.xml`,
    '',
  ].join('\n')
}

// ---------- sitemap.xml ----------
export function sitemapXml({ products = [], categories = [], articles = [], staticPaths = [] }) {
  const today = new Date().toISOString().slice(0, 10)
  const urls = []
  const add = (loc, { changefreq = 'weekly', priority = '0.6', lastmod = today } = {}) => {
    urls.push(
      `  <url>\n    <loc>${absUrl(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`,
    )
  }
  add('/', { changefreq: 'daily', priority: '1.0' })
  add('/catalog', { changefreq: 'daily', priority: '0.9' })
  for (const sp of staticPaths) add(sp, { changefreq: 'monthly', priority: '0.4' })
  for (const c of categories) add(c.path, { changefreq: 'weekly', priority: '0.7' })
  for (const p of products)
    add(p.path, {
      changefreq: 'weekly',
      priority: '0.8',
      lastmod: p.createdAt ? new Date(p.createdAt).toISOString().slice(0, 10) : today,
    })
  for (const a of articles)
    add(`/blog/${a.slug}`, { changefreq: 'monthly', priority: '0.6', lastmod: (a.updated || a.date || today).slice(0, 10) })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}
