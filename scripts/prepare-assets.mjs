import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const reference = process.argv[2] || 'C:/Users/Lenovo/Downloads/واجهة تطبيق مطعم ومطبخ العائلة.png';
const logo = process.argv[3] || 'C:/Users/Lenovo/Pictures/Saved Pictures/images (1).jpg';
await fs.mkdir('public/images', { recursive: true });
await fs.mkdir('src/assets', { recursive: true });
await fs.copyFile(logo, 'src/assets/logo-original.jpg');

// Remove only the connected white outer background; preserve the original artwork.
const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height } = info;
const visited = new Uint8Array(width * height);
const queue = [];
function visit(x, y) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const pixel = y * width + x;
  if (visited[pixel]) return;
  visited[pixel] = 1;
  const offset = pixel * 4;
  const channels = [data[offset], data[offset + 1], data[offset + 2]];
  if (Math.min(...channels) < 205 || Math.max(...channels) - Math.min(...channels) > 35) return;
  data[offset + 3] = 0;
  queue.push([x, y]);
}
for (let x = 0; x < width; x++) { visit(x, 0); visit(x, height - 1); }
for (let y = 0; y < height; y++) { visit(0, y); visit(width - 1, y); }
for (let i = 0; i < queue.length; i++) {
  const [x, y] = queue[i];
  visit(x - 1, y); visit(x + 1, y); visit(x, y - 1); visit(x, y + 1);
}
await sharp(data, { raw: { width, height, channels: 4 } }).png().toFile('src/assets/logo.png');
await sharp('src/assets/logo.png').resize(64, 64).png().toFile('public/images/favicon.png');

// Extract the actual food photographs from the supplied design, excluding UI controls.
const crops = [
  ['hero-chicken', 104, 330, 388, 295],
  ['broast-8', 538, 791, 276, 175],
  ['broast-4', 182, 791, 275, 175],
  ['crispy', 171, 1171, 176, 148],
  ['wings', 412, 1171, 166, 148],
  ['family-meal', 642, 1171, 173, 148],
];
for (const [name, left, top, cropWidth, cropHeight] of crops) {
  await sharp(reference).extract({ left, top, width: cropWidth, height: cropHeight }).webp({ quality: 88 }).toFile(path.join('public/images', `${name}.webp`));
}

const photos = [
  ['sandwich', 'photo-1690749127581-c9351d7d0abc'],
  ['fries', 'photo-1573080496219-bb080dd4f877'],
  ['drink', 'photo-1622483767028-3f66f32aef97'],
];
for (const [name, id] of photos) {
  const response = await fetch(`https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=85`);
  if (!response.ok) throw new Error(`Image download failed: ${name} (${response.status})`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await sharp(buffer).resize(700, 480, { fit: 'cover' }).webp({ quality: 84 }).toFile(`public/images/${name}.webp`);
}
console.log('Original logo and all food assets prepared locally.');
