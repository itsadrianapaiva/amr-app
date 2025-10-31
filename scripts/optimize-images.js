#!/usr/bin/env node
/**
 * Image Optimization Script
 * PERF-TUNING v2025-10-31
 *
 * Dev-only tool to generate optimized AVIF/WebP versions of marketing images.
 * This script runs locally and should NEVER be imported in runtime code.
 *
 * Usage: npm run images:optimize
 *
 * Reads from: public/images/raw/
 * Outputs to: public/images/optimized/
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

// Configuration
const RAW_DIR = path.join(__dirname, "..", "public", "images", "raw");
const OPTIMIZED_DIR = path.join(__dirname, "..", "public", "images", "optimized");

// Max dimensions for different asset types
const PRESETS = {
  hero: { width: 1920, quality: 80 }, // Hero backgrounds
  logo: { width: 400, quality: 85 },  // Logo assets
  machine: { width: 1200, quality: 80 }, // Machine photos
  default: { width: 1600, quality: 80 }, // General marketing images
};

/**
 * Ensure output directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created directory: ${dir}`);
  }
}

/**
 * Determine preset based on filename
 */
function getPreset(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes("hero")) return PRESETS.hero;
  if (lower.includes("logo")) return PRESETS.logo;
  if (lower.includes("machine")) return PRESETS.machine;
  return PRESETS.default;
}

/**
 * Generate optimized variants (AVIF + WebP) for a single image
 */
async function optimizeImage(inputPath, filename) {
  const preset = getPreset(filename);
  const baseName = path.parse(filename).name;

  console.log(`\n📸 Processing: ${filename}`);
  console.log(`   Preset: max-width ${preset.width}px, quality ${preset.quality}`);

  try {
    // Get original dimensions
    const metadata = await sharp(inputPath).metadata();
    const originalSize = fs.statSync(inputPath).size;
    console.log(`   Original: ${metadata.width}x${metadata.height} (${(originalSize / 1024).toFixed(1)} KB)`);

    // Determine resize width (don't upscale)
    const resizeWidth = Math.min(metadata.width, preset.width);

    // Generate AVIF
    const avifPath = path.join(OPTIMIZED_DIR, `${baseName}.avif`);
    await sharp(inputPath)
      .resize(resizeWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .avif({
        quality: preset.quality,
        effort: 6, // Higher effort = better compression (0-9)
      })
      .toFile(avifPath);

    const avifSize = fs.statSync(avifPath).size;
    const avifSavings = ((1 - avifSize / originalSize) * 100).toFixed(1);
    console.log(`   ✓ AVIF: ${(avifSize / 1024).toFixed(1)} KB (${avifSavings}% smaller)`);

    // Generate WebP
    const webpPath = path.join(OPTIMIZED_DIR, `${baseName}.webp`);
    await sharp(inputPath)
      .resize(resizeWidth, null, {
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({
        quality: preset.quality,
        effort: 6,
      })
      .toFile(webpPath);

    const webpSize = fs.statSync(webpPath).size;
    const webpSavings = ((1 - webpSize / originalSize) * 100).toFixed(1);
    console.log(`   ✓ WebP: ${(webpSize / 1024).toFixed(1)} KB (${webpSavings}% smaller)`);

    return {
      filename,
      avifSize,
      webpSize,
      originalSize,
      avifSavings: parseFloat(avifSavings),
      webpSavings: parseFloat(webpSavings)
    };
  } catch (error) {
    console.error(`   ✗ Error: ${error.message}`);
    return null;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log("🎨 Image Optimization Tool (PERF-TUNING v2025-10-31)");
  console.log("=" .repeat(60));

  // Validate input directory
  if (!fs.existsSync(RAW_DIR)) {
    console.error(`\n❌ Raw images directory not found: ${RAW_DIR}`);
    console.error("   Create this directory and add source images to optimize.");
    process.exit(1);
  }

  // Ensure output directory exists
  ensureDir(OPTIMIZED_DIR);

  // Find all image files
  const files = fs.readdirSync(RAW_DIR).filter(file => {
    const ext = path.extname(file).toLowerCase();
    return [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
  });

  if (files.length === 0) {
    console.log(`\n⚠️  No images found in ${RAW_DIR}`);
    console.log("   Add .jpg, .jpeg, .png, or .webp files to optimize.");
    process.exit(0);
  }

  console.log(`\n📁 Found ${files.length} image(s) to optimize\n`);

  // Process all images
  const results = [];
  for (const file of files) {
    const inputPath = path.join(RAW_DIR, file);
    const result = await optimizeImage(inputPath, file);
    if (result) results.push(result);
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary");
  console.log("=".repeat(60));

  if (results.length === 0) {
    console.log("No images were successfully processed.");
    return;
  }

  const totalOriginal = results.reduce((sum, r) => sum + r.originalSize, 0);
  const totalAvif = results.reduce((sum, r) => sum + r.avifSize, 0);
  const totalWebp = results.reduce((sum, r) => sum + r.webpSize, 0);
  const avgAvifSavings = results.reduce((sum, r) => sum + r.avifSavings, 0) / results.length;
  const avgWebpSavings = results.reduce((sum, r) => sum + r.webpSavings, 0) / results.length;

  console.log(`✓ Processed ${results.length} image(s)`);
  console.log(`Original total: ${(totalOriginal / 1024).toFixed(1)} KB`);
  console.log(`AVIF total: ${(totalAvif / 1024).toFixed(1)} KB (avg ${avgAvifSavings.toFixed(1)}% savings)`);
  console.log(`WebP total: ${(totalWebp / 1024).toFixed(1)} KB (avg ${avgWebpSavings.toFixed(1)}% savings)`);
  console.log(`\n📂 Optimized files saved to: ${OPTIMIZED_DIR}`);
  console.log("\n💡 Next steps:");
  console.log("   1. Review optimized images for quality");
  console.log("   2. Move selected files to their final locations (e.g., public/images/)");
  console.log("   3. Update component imports to use optimized assets");
}

// Run script
main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
