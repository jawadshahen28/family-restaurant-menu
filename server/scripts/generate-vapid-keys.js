import webpush from 'web-push';

const vapidKeys = webpush.generateVAPIDKeys();

console.log('--- Generated Web Push VAPID Keys ---');
console.log('Copy these to your server/.env file:\n');
console.log(`VAPID_PUBLIC_KEY=${vapidKeys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${vapidKeys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@family-restaurant.local\n');
console.log('Keep VAPID_PRIVATE_KEY secret and never expose it to the client.');
