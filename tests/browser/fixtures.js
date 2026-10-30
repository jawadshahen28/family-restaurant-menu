import { test as base, expect } from '@playwright/test';
import mongoose from 'mongoose';
import { createModels } from '../../server/src/models/index.js';
import { seedData } from '../../server/scripts/seedData.js';

export { expect };
export let models;
export const test = base.extend({
  isolatedDatabase: [async ({}, use) => {
    const uri = process.env.FAMILY_TEST_MONGO_URI;
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri || '')) throw new Error('Run browser tests with npm run test:ui; an isolated database is required.');
    const connection = await mongoose.createConnection(uri, { dbName: 'family_menu', autoIndex: false, bufferCommands: false }).asPromise();
    models = createModels(connection);
    await use(models);
    await connection.close();
  }, { scope: 'worker' }],
  resetIsolatedData: [async ({ isolatedDatabase }, use) => {
    await Promise.all(Object.values(isolatedDatabase).map((model) => model.deleteMany({})));
    await seedData(isolatedDatabase);
    await use();
  }, { auto: true }],
});
