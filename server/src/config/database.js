import mongoose from 'mongoose';
import { connectionFailure } from './connectionErrors.js';

export async function connectDatabase(config, driver = mongoose) {
  try {
    await driver.connect(config.mongoUri, { dbName: 'family_menu', serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 10, autoIndex: false, bufferCommands: false });
    return driver.connection;
  } catch (error) { throw connectionFailure(error, config.mongoUri); }
}
