import sharp from 'sharp';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicImagesDir = path.join(__dirname, '..', 'public', 'images');

// Ensure images directory exists
if (!fs.existsSync(publicImagesDir)) {
  fs.mkdirSync(publicImagesDir, { recursive: true });
}

// Download function
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Optimize image to progressive JPEG
async function optimizeImage(inputPath, outputPath, maxWidth = 1920) {
  const startSize = fs.statSync(inputPath).size;

  await sharp(inputPath)
    .resize(maxWidth, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .jpeg({
      quality: 85,
      progressive: true,
      mozjpeg: true, // Use mozjpeg for better compression
    })
    .toFile(outputPath);

  const endSize = fs.statSync(outputPath).size;
  const reduction = ((startSize - endSize) / startSize * 100).toFixed(1);

  return {
    originalSize: (startSize / 1024 / 1024).toFixed(2) + ' MB',
    optimizedSize: (endSize / 1024 / 1024).toFixed(2) + ' MB',
    reduction: reduction + '%'
  };
}

async function main() {
  console.log('🖼️  Hero Image Optimization Script\n');
  console.log('='.repeat(50) + '\n');

  // Image 1: Landing page - desert.png (already local)
  console.log('[1/3] Optimizing Landing Page Background (desert.png)');
  const desertPath = path.join(publicImagesDir, 'desert.png');
  const desertOptimized = path.join(publicImagesDir, 'desert-optimized.jpg');

  if (fs.existsSync(desertPath)) {
    const result1 = await optimizeImage(desertPath, desertOptimized);
    console.log(`✅ Desert optimized: ${result1.originalSize} → ${result1.optimizedSize} (${result1.reduction} reduction)\n`);
  } else {
    console.log(`⚠️  desert.png not found at ${desertPath}\n`);
  }

  // Image 2: Sage background (download from CDN)
  console.log('[2/3] Downloading & Optimizing Sage Background');
  const sageUrl = 'https://c.animaapp.com/ArhZSyxG/img/frank-sepulveda-st9ymbaqqg4-unsplash.jpg';
  const sageTempPath = path.join(publicImagesDir, 'sage-hero-temp.jpg');
  const sageOptimized = path.join(publicImagesDir, 'sage-hero-optimized.jpg');

  try {
    await downloadImage(sageUrl, sageTempPath);
    console.log('📥 Downloaded Sage background');
    const result2 = await optimizeImage(sageTempPath, sageOptimized);
    fs.unlinkSync(sageTempPath); // Delete temp file
    console.log(`✅ Sage optimized: ${result2.originalSize} → ${result2.optimizedSize} (${result2.reduction} reduction)\n`);
  } catch (error) {
    console.error(`❌ Error with Sage image: ${error.message}\n`);
  }

  // Image 3: Forge background (download from CDN)
  console.log('[3/3] Downloading & Optimizing Forge Background');
  const forgeUrl = 'https://c.animaapp.com/EVbz3TeZ/img/susan-wilkinson-eo76daedyim-unsplash.jpg';
  const forgeTempPath = path.join(publicImagesDir, 'forge-hero-temp.jpg');
  const forgeOptimized = path.join(publicImagesDir, 'forge-hero-optimized.jpg');

  try {
    await downloadImage(forgeUrl, forgeTempPath);
    console.log('📥 Downloaded Forge background');
    const result3 = await optimizeImage(forgeTempPath, forgeOptimized);
    fs.unlinkSync(forgeTempPath); // Delete temp file
    console.log(`✅ Forge optimized: ${result3.originalSize} → ${result3.optimizedSize} (${result3.reduction} reduction)\n`);
  } catch (error) {
    console.error(`❌ Error with Forge image: ${error.message}\n`);
  }

  console.log('='.repeat(50));
  console.log('🎉 Image optimization complete!\n');
  console.log('Optimized images saved to: /public/images/');
  console.log('  - desert-optimized.jpg');
  console.log('  - sage-hero-optimized.jpg');
  console.log('  - forge-hero-optimized.jpg\n');
  console.log('Next steps:');
  console.log('  1. Update app/landing.css to use desert-optimized.jpg');
  console.log('  2. Update app/sage/page.tsx to use /images/sage-hero-optimized.jpg');
  console.log('  3. Update app/forge/page.tsx to use /images/forge-hero-optimized.jpg');
}

main().catch(console.error);
