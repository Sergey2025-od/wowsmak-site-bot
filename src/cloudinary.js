import { v2 as cloudinary } from 'cloudinary'
import { config } from './config.js'

cloudinary.config({
  cloud_name: config.cloudinary.cloudName,
  api_key: config.cloudinary.apiKey,
  api_secret: config.cloudinary.apiSecret,
})

// Якщо в БД зберігається public_id — будуємо оптимізований URL.
// Якщо зберігається готовий https-URL — повертаємо як є.
export function imageUrl(imageRef, { width = 800, crop = 'fill', format } = {}) {
  if (!imageRef) return null
  if (imageRef.startsWith('http')) return imageRef
  // Якщо явно вказано format (напр. 'png') — віддаємо саме його, щоб зберегти
  // прозорість (альфа-канал). f_auto може "сплющити" прозорий PNG і залити фон білим.
  return cloudinary.url(imageRef, {
    secure: true,
    width,
    crop, // 'fill' — заповнює/обрізає; 'fit' — вписує ціле зображення без обрізки (зберігає прозорість)
    quality: 'auto',
    fetch_format: format || 'auto',
  })
}

// Квадратна мініатюра у форматі JPG (PDFKit не підтримує WebP) — для накладної.
export function thumbUrl(ref, size = 120) {
  if (!ref) return null
  if (ref.startsWith('http')) return ref
  return cloudinary.url(ref, {
    secure: true,
    width: size,
    height: size,
    crop: 'fill',
    format: 'jpg',
  })
}

export function videoUrl(ref) {
  if (!ref) return null
  if (ref.startsWith('http')) return ref
  return cloudinary.url(ref, { secure: true, resource_type: 'video' })
}

// Завантаження фото в Cloudinary. Приймає URL або шлях. Повертає public_id.
export async function uploadImage(fileOrUrl, folder = 'candy-shop') {
  const res = await cloudinary.uploader.upload(fileOrUrl, { folder })
  return res.public_id
}

// Завантаження відео в Cloudinary. Повертає public_id.
export async function uploadVideo(fileOrUrl, folder = 'candy-shop') {
  const res = await cloudinary.uploader.upload(fileOrUrl, {
    folder,
    resource_type: 'video',
  })
  return res.public_id
}
