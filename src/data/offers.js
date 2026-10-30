// بيانات إدخال أولي للعروض؛ الواجهة تعتمد على العروض السارية من MongoDB.
export const offers = [
  {
    id: 'family-offer', productId: 'family-meal', title: 'عرض لمّة العائلة',
    description: 'وجبة العائلة مع البطاطا والخبز والسلطات.',
    image: '/images/family-meal.webp', originalPrice: 85, offerPrice: 75,
    startDate: '2026-10-01T00:00:00+03:00', endDate: '2026-12-31T23:59:59+02:00',
    isActive: false,
  },
];
