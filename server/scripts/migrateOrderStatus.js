import mongoose from 'mongoose';
import { createModels } from '../src/models/index.js';
import { loadEnvironment } from '../src/config/env.js';
import { connectDatabase } from '../src/config/database.js';

/**
 * Migration helper to safely map legacy order statuses to the 3 approved statuses:
 * - confirmed -> new
 * - preparing -> received
 * - ready / completed -> prepared
 */
export async function migrateOrderStatuses(models, { dryRun = false } = {}) {
  const { Order } = models;

  const legacyConfirmed = await Order.countDocuments({ status: 'confirmed' });
  const legacyPreparing = await Order.countDocuments({ status: 'preparing' });
  const legacyReady = await Order.countDocuments({ status: { $in: ['ready', 'completed'] } });

  const summary = {
    toNew: legacyConfirmed,
    toReceived: legacyPreparing,
    toPrepared: legacyReady,
    totalToMigrate: legacyConfirmed + legacyPreparing + legacyReady,
    dryRun,
  };

  if (dryRun) {
    return summary;
  }

  const updates = [];
  if (legacyConfirmed > 0) {
    updates.push(Order.updateMany({ status: 'confirmed' }, { $set: { status: 'new' } }));
  }
  if (legacyPreparing > 0) {
    updates.push(Order.updateMany({ status: 'preparing' }, { $set: { status: 'received' } }));
  }
  if (legacyReady > 0) {
    updates.push(Order.updateMany({ status: { $in: ['ready', 'completed'] } }, { $set: { status: 'prepared' } }));
  }

  await Promise.all(updates);
  return summary;
}

// Standalone execution if run directly via Node CLI
if (process.argv[1] && process.argv[1].endsWith('migrateOrderStatus.js')) {
  const dryRun = process.argv.includes('--dry-run');
  const config = loadEnvironment();
  console.log(`بدء هجرة حالات الطلبات... (وضع المحاكاة: ${dryRun ? 'نعم' : 'لا'})`);

  try {
    const connection = await connectDatabase(config);
    const models = createModels(connection);
    const summary = await migrateOrderStatuses(models, { dryRun });

    console.log('ملخص الهجرة:');
    console.log(`- الطلبات المؤكدة القديمة المحولة إلى "جديد": ${summary.toNew}`);
    console.log(`- الطلبات قيد التجهيز المحولة إلى "تم استلام الطلب": ${summary.toReceived}`);
    console.log(`- الطلبات الجاهزة/المكتملة المحولة إلى "تم التجهيز": ${summary.toPrepared}`);
    console.log(`- إجمالي الطلبات التي تمت معالجتها: ${summary.totalToMigrate}`);

    await connection.close();
    process.exit(0);
  } catch (err) {
    console.error('فشلت عملية الهجرة:', err);
    process.exit(1);
  }
}
