import { categories } from '../../src/data/categories.js';
import { products } from '../../src/data/products.js';
import { offers } from '../../src/data/offers.js';
import { defaultStore } from '../src/services/menuService.js';

async function insertOnly(model, filter, data) {
  const now = new Date();
  await model.updateOne(filter, { $setOnInsert: { ...data, createdAt: now, updatedAt: now } }, { upsert: true, runValidators: true, timestamps: false });
}

export async function seedData(models) {
  for (const [sortOrder, category] of categories.entries()) {
    await insertOnly(models.Category, { slug: category.id }, { slug: category.id, name: category.name, image: category.image, icon: category.icon, sortOrder, isActive: true });
  }
  const savedCategories = await models.Category.find({ slug: { $in: categories.map((category) => category.id) } }).lean();
  for (const [sortOrder, product] of products.entries()) {
    const { id, categoryId, ...fields } = product;
    const category = savedCategories.find((entry) => entry.slug === categoryId);
    await insertOnly(models.Product, { slug: id }, { ...fields, slug: id, categoryId: category._id, sortOrder });
  }
  const savedProducts = await models.Product.find({ slug: { $in: products.map((product) => product.id) } }).lean();
  for (const offer of offers) {
    const { id, productId, ...fields } = offer;
    const product = savedProducts.find((entry) => entry.slug === productId);
    await insertOnly(models.Offer, { slug: id }, { ...fields, slug: id, productId: product?._id || null });
  }
  await insertOnly(models.StoreSettings, { _id: 'store' }, defaultStore);
  return { categories: categories.length, products: products.length, offers: offers.length };
}
