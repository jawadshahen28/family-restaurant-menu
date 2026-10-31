import { storedImage } from './uploadService.js';

export function createImageService({ repository, uploads, logger }) {
  let running, timer;
  async function queue(previous) {
    const asset = storedImage(previous);
    if (asset.cloudName && asset.imagePublicId) await repository.queueImageDeletion(asset);
  }
  function cleanup() {
    if (running) return running;
    if (!uploads.isConfigured()) return Promise.resolve();
    running = (async () => {
      for (const job of await repository.pendingImageDeletions()) {
        try {
          if (await repository.imageIsReferenced(job)) {
            await repository.deferImageDeletion(job._id);
            continue;
          }
          await uploads.deleteImage(job);
          await repository.completeImageDeletion(job._id);
        } catch {
          await repository.deferImageDeletion(job._id);
          logger.error('image_cleanup_deferred', {});
        }
      }
    })().finally(() => { running = null; });
    return running;
  }
  async function cleanupSafely() { try { await cleanup(); } catch { logger.error('image_cleanup_deferred', {}); } }
  return {
    async save({ data, previous = {}, owner, persist, productId }) {
      const prepared = uploads.prepareImage(data, previous, owner);
      const old = storedImage(previous);
      const changed = prepared.imageUrl !== undefined && prepared.imageUrl !== old.imageUrl;
      if (changed) {
        // A queued asset cannot be deleted while MongoDB still references it.
        await queue(previous);
        if (productId && old.imageUrl) await repository.clearInheritedOfferImages(productId, old.imageUrl);
      }
      const saved = await persist(prepared);
      if (changed) await cleanupSafely();
      return saved;
    },
    async remove(previous, removeRecord) {
      await queue(previous);
      await removeRecord();
      await cleanupSafely();
    },
    cleanup,
    start() { timer = setInterval(cleanupSafely, 60000); timer.unref(); void cleanupSafely(); },
    async stop() { clearInterval(timer); await running; },
  };
}
