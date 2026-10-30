// بيانات الإدخال الأولي؛ قائمة التشغيل وأسعارها تُحمّل من MongoDB.
export const products = [
  { id: 'broast-8', name: 'بروست ٨ قطع', description: 'قطع دجاج ذهبية مقرمشة، مع البطاطا والخبز والسلطة.', price: 60, image: '/images/broast-8.webp', categoryId: 'broast', isAvailable: true, isFeatured: true, badge: 'لمّة العيلة' },
  { id: 'broast-4', name: 'بروست ٤ قطع', description: 'قرمشة على أصولها، مع البطاطا والخبز والصوص.', price: 35, image: '/images/broast-4.webp', categoryId: 'broast', isAvailable: true, isFeatured: true },
  { id: 'family-meal', name: 'وجبة العائلة', description: 'دجاج مقرمش، بطاطا، خبز وسلطات تكفي اللمّة.', price: 85, image: '/images/family-meal.webp', categoryId: 'broast', isAvailable: true, isFeatured: true, badge: 'للجَمعة الحلوة' },
  { id: 'hot-wings', name: 'جنحان حار', description: 'جنحان مقرمشة بصوص حار وخلطة العائلة الخاصة.', price: 28, image: '/images/wings.webp', categoryId: 'wings', isAvailable: true, isFeatured: true, isSpicy: true },
  { id: 'crispy-meal', name: 'وجبة كريسبي', description: 'شرائح دجاج كريسبي بقرمشة بتسمعها وطعم بتحبّه.', price: 32, image: '/images/crispy.webp', categoryId: 'crispy', isAvailable: true, isFeatured: true },
  { id: 'chicken-sandwich', name: 'ساندويش دجاج', description: 'دجاج مقرمش، خس وصوص العائلة في خبز طري.', price: 22, image: '/images/sandwich.webp', categoryId: 'sandwiches', isAvailable: true, isFeatured: false },
  { id: 'golden-fries', name: 'بطاطا ذهبية', description: 'بطاطا ساخنة ومقرمشة مع صوص الكاتشب.', price: 10, image: '/images/fries.webp', categoryId: 'sides', isAvailable: true, isFeatured: false },
  { id: 'cold-drink', name: 'مشروب غازي', description: 'مشروب بارد يكمل وجبتك، عبوة ٣٣٠ مل.', price: 5, image: '/images/drink.webp', categoryId: 'drinks', isAvailable: true, isFeatured: false },
];
