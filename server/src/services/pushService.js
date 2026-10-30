import defaultWebPush from 'web-push';

export function createPushService({ repository, vapid = {}, webpushClient = defaultWebPush }) {
  const publicKey = vapid.publicKey || '';
  const privateKey = vapid.privateKey || '';
  const subject = vapid.subject || 'mailto:admin@family-restaurant.local';

  let isConfigured = false;
  if (publicKey && privateKey) {
    try {
      webpushClient.setVapidDetails(subject, publicKey, privateKey);
      isConfigured = true;
    } catch (err) {
      console.warn('Failed to configure VAPID details:', err.message);
    }
  }

  const service = {
    isConfigured() {
      return isConfigured;
    },

    getPublicKey() {
      return publicKey;
    },

    async subscribe({ adminId, endpoint, keys, device }) {
      return repository.upsertPushSubscription({
        adminId,
        endpoint,
        keys,
        device,
      });
    },

    async unsubscribe({ endpoint, adminId }) {
      return repository.deletePushSubscription(endpoint, adminId);
    },

    async getStatus({ adminId, endpoint }) {
      const [deviceCount, existing] = await Promise.all([
        repository.countPushSubscriptions(adminId),
        endpoint ? repository.findPushSubscriptionByEndpoint(endpoint) : null,
      ]);

      return {
        configured: Boolean(publicKey),
        deviceCount,
        isSubscribed: Boolean(existing),
      };
    },

    async enqueueNewOrderNotification({ orderId, orderNumber }) {
      try {
        const job = await repository.enqueuePushJob({ orderId, orderNumber });
        service.triggerWorker();
        return job;
      } catch (err) {
        console.warn('Failed to enqueue push notification job:', err.message);
        return null;
      }
    },

    async processJobs() {
      let job = await repository.claimNextPushJob();
      while (job) {
        try {
          if (!publicKey || !privateKey) {
            await repository.failPushJob(job._id, 'VAPID keys not configured', false);
            job = await repository.claimNextPushJob();
            continue;
          }

          const subscriptions = await repository.allPushSubscriptions();
          if (subscriptions.length === 0) {
            await repository.completePushJob(job._id);
            job = await repository.claimNextPushJob();
            continue;
          }

          const payload = JSON.stringify({
            title: 'طلب جديد 🍗 — مطعم العائلة',
            body: `وصل طلب جديد رقم #${job.orderNumber}. اضغط لعرض التفاصيل.`,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            tag: `order-${job.orderId}`,
            data: {
              orderId: String(job.orderId),
              orderNumber: job.orderNumber,
              url: `/admin/orders/${job.orderId}`,
            },
          });

          let temporaryFailure = false;
          let lastErrorMessage = '';

          for (const sub of subscriptions) {
            try {
              await webpushClient.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.keys.p256dh,
                    auth: sub.keys.auth,
                  },
                },
                payload,
                { TTL: 86400, urgency: 'high' }
              );
              await repository.updatePushSubscriptionLastDelivered(sub.endpoint);
            } catch (error) {
              const statusCode = error.statusCode || error.status;
              if (statusCode === 404 || statusCode === 410) {
                // Subscription is permanently expired or gone -> delete it
                await repository.deletePushSubscription(sub.endpoint);
              } else {
                temporaryFailure = true;
                lastErrorMessage = error.message || 'Push delivery failed';
              }
            }
          }

          if (temporaryFailure && job.attempts < (job.maxAttempts || 5)) {
            await repository.failPushJob(job._id, lastErrorMessage, true);
          } else {
            await repository.completePushJob(job._id);
          }
        } catch (jobErr) {
          await repository.failPushJob(job._id, jobErr.message, false);
        }

        job = await repository.claimNextPushJob();
      }
    },

    triggerWorker() {
      setImmediate(() => {
        service.processJobs().catch((err) => {
          console.warn('Background push job processing error:', err.message);
        });
      });
    },
  };

  return service;
}
