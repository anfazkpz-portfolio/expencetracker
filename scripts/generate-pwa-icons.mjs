import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// Generate SVG with vector-based Rupee symbol so it doesn't depend on system fonts
function createRupeeSvg({ size, maskable = true }) {
  // Center is size/2
  // We'll use a 512x512 coordinate space for viewBox
  // 80% safe zone is radius 204 (diameter 409.6)
  const bg = '#09090b'; // Clean dark theme background
  const emerald = '#10b981';

  // Vector paths for Indian Rupee symbol normalized in a 24x24 box
  // Scale and translate into center of 512x512
  // 24x24 box scaled by factor 10 -> 240x240 box
  // Centered at 512: (512 - 240) / 2 = 136
  const scale = 11;
  const tx = (512 - 24 * scale) / 2; // (512 - 264)/2 = 124
  const ty = (512 - 24 * scale) / 2; // 124

  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#18181b" />
      <stop offset="100%" stop-color="#09090b" />
    </linearGradient>
    <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.8" />
      <stop offset="100%" stop-color="#059669" stop-opacity="0.3" />
    </linearGradient>
  </defs>

  <!-- Full bleed dark background for maskable & standard launchers -->
  <rect width="512" height="512" ${maskable ? '' : 'rx="100"'} fill="url(#bgGrad)"/>

  <!-- Subtle glow / ambient accent behind the emblem -->
  <circle cx="256" cy="256" r="150" fill="#10b981" opacity="0.08" />

  <!-- Outer accent ring (within safe zone) -->
  <circle cx="256" cy="256" r="170" fill="none" stroke="url(#ringGrad)" stroke-width="8" stroke-dasharray="12 12" />

  <!-- Indian Rupee Emblem Vector Path -->
  <g transform="translate(${tx}, ${ty}) scale(${scale})" fill="none" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 3h12" />
    <path d="M6 8h12" />
    <path d="m6 13 8.5 8" />
    <path d="M6 13h3" />
    <path d="M9 13c6.667 0 6.667-10 0-10" />
  </g>

  <!-- Modern Live Accent Dot -->
  <circle cx="360" cy="148" r="18" fill="${emerald}" stroke="#09090b" stroke-width="4"/>
</svg>
  `.trim();
}

async function main() {
  const publicIconsDir = path.resolve('public/icons');
  if (!fs.existsSync(publicIconsDir)) {
    fs.mkdirSync(publicIconsDir, { recursive: true });
  }

  // 1. Generate icon.svg
  const svg512 = createRupeeSvg({ size: 512, maskable: true });
  fs.writeFileSync(path.join(publicIconsDir, 'icon.svg'), svg512, 'utf-8');
  console.log('Generated public/icons/icon.svg');

  // 2. Generate icon-512x512.png (maskable & any compatible)
  const buf512 = await sharp(Buffer.from(svg512))
    .resize(512, 512)
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-512x512.png'), buf512);
  console.log('Generated public/icons/icon-512x512.png (' + buf512.length + ' bytes)');

  // 3. Generate icon-192x192.png
  const svg192 = createRupeeSvg({ size: 192, maskable: true });
  const buf192 = await sharp(Buffer.from(svg192))
    .resize(192, 192)
    .png({ quality: 100, compressionLevel: 9 })
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'icon-192x192.png'), buf192);
  console.log('Generated public/icons/icon-192x192.png (' + buf192.length + ' bytes)');

  // 4. Generate apple-touch-icon.png (180x180)
  const bufApple = await sharp(Buffer.from(svg192))
    .resize(180, 180)
    .png({ quality: 100 })
    .toBuffer();
  fs.writeFileSync(path.join(publicIconsDir, 'apple-touch-icon.png'), bufApple);
  console.log('Generated public/icons/apple-touch-icon.png (' + bufApple.length + ' bytes)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
