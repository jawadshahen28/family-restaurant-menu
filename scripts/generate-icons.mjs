import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const publicIconsDir = path.resolve('public/icons');
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
}

const logoPath = path.resolve('src/assets/logo.png');

async function generate() {
  // 192x192 standard icon
  await sharp(logoPath)
    .resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-192.png'));

  // 512x512 standard icon
  await sharp(logoPath)
    .resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicIconsDir, 'icon-512.png'));

  // Apple touch icon 180x180 (warm brand background so iOS doesn't make transparent pixels black)
  const logo150 = await sharp(logoPath)
    .resize(144, 144, { fit: 'contain', background: { r: 255, g: 253, b: 250, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 180,
      height: 180,
      channels: 4,
      background: { r: 255, g: 253, b: 250, alpha: 1 } // #fffdfa warm cream
    }
  })
    .composite([{ input: logo150, gravity: 'center' }])
    .png()
    .toFile(path.join(publicIconsDir, 'apple-touch-icon.png'));

  // Maskable 192x192 (safe zone padding: logo is ~75% inside warm brand background)
  const logo144 = await sharp(logoPath)
    .resize(144, 144, { fit: 'contain', background: { r: 255, g: 253, b: 250, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 192,
      height: 192,
      channels: 4,
      background: { r: 255, g: 253, b: 250, alpha: 1 }
    }
  })
    .composite([{ input: logo144, gravity: 'center' }])
    .png()
    .toFile(path.join(publicIconsDir, 'icon-maskable-192.png'));

  // Maskable 512x512 (safe zone padding: logo is ~75% inside warm brand background)
  const logo384 = await sharp(logoPath)
    .resize(384, 384, { fit: 'contain', background: { r: 255, g: 253, b: 250, alpha: 0 } })
    .toBuffer();

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 255, g: 253, b: 250, alpha: 1 }
    }
  })
    .composite([{ input: logo384, gravity: 'center' }])
    .png()
    .toFile(path.join(publicIconsDir, 'icon-maskable-512.png'));

  // Notification badge 72x72
  await sharp(logoPath)
    .resize(72, 72, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .png()
    .toFile(path.join(publicIconsDir, 'badge-72.png'));

  console.log('Successfully generated all PWA icons in public/icons/');
}

generate().catch((err) => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
