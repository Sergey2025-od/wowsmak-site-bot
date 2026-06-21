// dotenv завантажуємо опціонально: у повному режимі (npm install) він є,
// а для локального превью без залежностей — просто пропускаємо.
try {
  await import('dotenv/config')
} catch {
  // dotenv не встановлено — змінні беруться з process.env (або пропускаються)
}

function required(name) {
  const value = process.env[name]
  if (!value) {
    console.warn(`⚠️  Змінну оточення ${name} не задано`)
  }
  return value
}

// ADMIN_CHAT_ID може містити кілька id через кому: "111,222"
const adminIds = (process.env.ADMIN_CHAT_ID || '')
  .split(',')
  .map((s) => Number(s.trim()))
  .filter(Boolean)

export const config = {
  botToken: required('BOT_TOKEN'),
  webhookSecret: process.env.WEBHOOK_SECRET || 'secret',
  publicUrl: process.env.PUBLIC_URL || '',
  adminIds,
  adminChatId: adminIds[0] || null,
  port: process.env.PORT ? Number(process.env.PORT) : 3000,

  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_KEY'),

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  },
}
