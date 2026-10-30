import { apiRequest } from './apiClient.js';

export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = typeof atob === 'function'
    ? atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export function isIOS() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function checkPushCapabilities() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return { supported: false, isIOS: false, standalone: false, needsInstall: false };
  }

  const ios = isIOS();
  const standalone = isStandalone();
  const hasSW = 'serviceWorker' in navigator;
  const hasPush = 'PushManager' in window;
  const hasNotification = 'Notification' in window;

  const supported = hasSW && hasPush && hasNotification;
  const needsInstall = ios && !standalone;

  return {
    supported,
    isIOS: ios,
    standalone,
    needsInstall,
    permission: hasNotification ? Notification.permission : 'unsupported',
  };
}

export async function getVapidPublicKey() {
  const res = await apiRequest('/admin/push/public-key', { method: 'GET', credentials: 'same-origin' });
  return res.data?.publicKey;
}

export async function getPushStatus(endpoint) {
  const query = endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : '';
  const res = await apiRequest(`/admin/push/status${query}`, { method: 'GET', credentials: 'same-origin' });
  return res.data;
}

export async function subscribeDevice(payload, csrfToken) {
  const res = await apiRequest('/admin/push/subscribe', {
    method: 'POST',
    body: payload,
    csrfToken,
    credentials: 'same-origin',
  });
  return res.data;
}

export async function unsubscribeDevice(endpoint, csrfToken) {
  const res = await apiRequest('/admin/push/unsubscribe', {
    method: 'POST',
    body: { endpoint },
    csrfToken,
    credentials: 'same-origin',
  });
  return res.data;
}

export async function subscribeCurrentDevice(csrfToken) {
  const capabilities = checkPushCapabilities();
  if (!capabilities.supported) {
    throw new Error('متصفحك لا يدعم الإشعارات الفورية (Web Push).');
  }

  if (capabilities.needsInstall) {
    throw new Error('على أجهزة iPhone و iPad، يجب إضافة التطبيق إلى الشاشة الرئيسية (Add to Home Screen) أولاً.');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? 'تم رفض إذن الإشعارات من إعدادات المتصفح.'
        : 'لم يتم منح الإذن بتفعيل الإشعارات.'
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const publicKey = await getVapidPublicKey();
  if (!publicKey) {
    throw new Error('مفاتيح الإشعارات الفورية (VAPID) غير مهيأة على الخادم بعد.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const subJson = subscription.toJSON();
  const deviceLabel = capabilities.isIOS
    ? (navigator.userAgent.includes('iPad') ? 'iPad' : 'iPhone')
    : (navigator.userAgent.includes('Android') ? 'هاتف Android' : 'متصفح سطح المكتب');

  await subscribeDevice(
    {
      endpoint: subscription.endpoint,
      keys: subJson.keys,
      device: {
        userAgent: navigator.userAgent,
        platform: navigator.platform || '',
        label: deviceLabel,
      },
    },
    csrfToken
  );

  return subscription;
}

export async function unsubscribeCurrentDevice(csrfToken) {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (subscription) {
    const endpoint = subscription.endpoint;
    try {
      await subscription.unsubscribe();
    } catch {
      // Continue even if local unsubscribe fails
    }
    await unsubscribeDevice(endpoint, csrfToken);
  }
}
