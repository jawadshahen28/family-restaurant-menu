/**
 * Arabic to Latin transliteration mapping for creating clean URL-safe slugs.
 */
const ARABIC_TO_LATIN = {
  'أ': 'a', 'إ': 'e', 'آ': 'a', 'ا': 'a', 'ب': 'b', 'ت': 't', 'ث': 'th',
  'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
  'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
  'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ء': '', 'ئ': 'y', 'ؤ': 'w',
  '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٠': '0'
};

/**
 * Generates a valid slug matching /^[a-z0-9]+(?:-[a-z0-9]+)*$/
 */
export function generateSlug(text, defaultPrefix = 'item') {
  if (!text || typeof text !== 'string') {
    return `${defaultPrefix}-${Date.now().toString(36)}`;
  }

  let transliterated = '';
  for (const char of text.trim()) {
    transliterated += ARABIC_TO_LATIN[char] !== undefined ? ARABIC_TO_LATIN[char] : char;
  }

  let slug = transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    slug = `${defaultPrefix}-${Math.random().toString(36).slice(2, 8)}`;
  }
  return slug;
}

/**
 * Ensures slug uniqueness in MongoDB by appending incremental numbers if needed.
 */
export async function makeUniqueSlug(model, baseSlug, excludeId = null) {
  let slug = baseSlug;
  let counter = 1;
  while (true) {
    const query = { slug };
    if (excludeId) query._id = { $ne: excludeId };
    const exists = await model.findOne(query).select('_id').lean();
    if (!exists) return slug;
    counter++;
    slug = `${baseSlug}-${counter}`;
  }
}
