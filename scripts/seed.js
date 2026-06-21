// Наповнює БД прикладами товарів. Запуск: npm run seed
import { supabase } from '../src/db.js'

const sample = {
  'Шоколад': [
    { title: 'Шоколад «Мрія»', description: 'Молочний шоколад з фундуком', price: 180, weight_g: 100 },
    { title: 'Чорний 70%', description: 'Справжній бельгійський шоколад', price: 220, weight_g: 90 },
  ],
  'Льодяники': [
    { title: 'Льодяники на паличці', description: 'Асорті фруктових смаків', price: 90, weight_g: 60 },
  ],
  'Мармелад': [
    { title: 'Цукерки «Веселка»', description: 'Жувальний мармелад', price: 120, weight_g: 200 },
  ],
  'Подарункові набори': [
    { title: 'Набір «Солодкий день»', description: 'Асорті найкращих смаколиків', price: 650, weight_g: 500 },
  ],
}

const { data: categories } = await supabase.from('categories').select('id, title')
const byTitle = Object.fromEntries(categories.map((c) => [c.title, c.id]))

for (const [catTitle, products] of Object.entries(sample)) {
  const categoryId = byTitle[catTitle]
  if (!categoryId) continue
  for (const p of products) {
    await supabase.from('products').insert({ ...p, category_id: categoryId })
    console.log(`+ ${p.title}`)
  }
}
console.log('Готово ✅')
process.exit(0)
