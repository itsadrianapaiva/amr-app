#!/usr/bin/env node
/**
 * Non-destructive Image Optimization Script
 *
 * Generates WebP copies of PNG and JPEG images in public/images and public/assets.
 * Optimized files are placed in parallel "optimized" subdirectories.
 *
 * Requirements:
 * - Never modifies or deletes original files
 * - Skips images smaller than 64x64 pixels
 * - Only keeps WebP if it's at least 10% smaller than original
 * - Idempotent: can be run multiple times safely
 *
 * Usage: npm run optimize:images
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Configuration
const IMAGE_ROOTS = ['public/images', 'public/assets'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const MIN_DIMENSION = 64; // Skip images smaller than this in both dimensions
const MIN_SAVINGS_RATIO = 0.9; // WebP must be < 90% of original size to keep
const WEBP_QUALITY = 85;

// Statistics
const stats = {
  inspected: 0,
  created: 0,
  skipped: 0,
  tooSmall: 0,
  notSmaller: 0,
  alreadyOptimized: 0,
  errors: 0,
  bytesSaved: 0
};

/**
 * Recursively walk a directory and yield all file paths
 */
function* walkDirectory(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip any directory named "optimized"
        if (entry.name === 'optimized') {
          continue;
        }
        yield* walkDirectory(fullPath);
      } else if (entry.isFile()) {
        yield fullPath;
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read directory ${dir}: ${error.message}`);
  }
}

/**
 * Check if a file should be processed
 */
function shouldProcessFile(filePath) {
  // Skip files in optimized directories
  if (filePath.includes(path.sep + 'optimized' + path.sep) ||
      filePath.includes('/optimized/')) {
    return false;
  }

  // Check file extension
  const ext = path.extname(filePath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return false;
  }

  return true;
}

/**
 * Get the output path for an optimized image
 */
function getOptimizedPath(sourcePath, root) {
  // Normalize paths for cross-platform compatibility
  const normalizedSource = sourcePath.replace(/\\/g, '/');
  const normalizedRoot = root.replace(/\\/g, '/');

  // Get the relative path from the root
  const relativePath = normalizedSource.substring(normalizedRoot.length + 1);

  // Parse the path components
  const parsed = path.parse(relativePath);
  const dir = parsed.dir;
  const name = parsed.name;

  // Build output path: root/optimized/dir/name.webp
  const outputDir = path.join(root, 'optimized', dir);
  const outputPath = path.join(outputDir, `${name}.webp`);

  return { outputPath, outputDir };
}

/**
 * Process a single image file
 */
async function processImage(sourcePath, root) {
  stats.inspected++;

  try {
    // Check if image is too small
    const metadata = await sharp(sourcePath).metadata();

    if (metadata.width < MIN_DIMENSION && metadata.height < MIN_DIMENSION) {
      console.log(`  Skipped (too small): ${sourcePath} (${metadata.width}x${metadata.height})`);
      stats.tooSmall++;
      stats.skipped++;
      return;
    }

    // Get output path
    const { outputPath, outputDir } = getOptimizedPath(sourcePath, root);

    // Check if output already exists (idempotency)
    if (fs.existsSync(outputPath)) {
      const sourceStats = fs.statSync(sourcePath);
      const outputStats = fs.statSync(outputPath);

      // If output is newer than source, skip
      if (outputStats.mtime >= sourceStats.mtime) {
        stats.alreadyOptimized++;
        return;
      }
    }

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Convert to WebP
    await sharp(sourcePath)
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    // Compare file sizes
    const originalSize = fs.statSync(sourcePath).size;
    const webpSize = fs.statSync(outputPath).size;

    // Keep only if WebP is significantly smaller
    if (webpSize >= originalSize * MIN_SAVINGS_RATIO) {
      fs.unlinkSync(outputPath);
      console.log(`  WebP not smaller, discarded: ${sourcePath} (${formatBytes(originalSize)} -> ${formatBytes(webpSize)})`);
      stats.notSmaller++;
      stats.skipped++;
    } else {
      const savings = originalSize - webpSize;
      stats.bytesSaved += savings;
      stats.created++;

      const savingsPercent = Math.round((savings / originalSize) * 100);
      console.log(`  Optimized: ${sourcePath} -> ${outputPath}`);
      console.log(`    ${formatBytes(originalSize)} -> ${formatBytes(webpSize)} (${savingsPercent}% savings)`);
    }

  } catch (error) {
    console.error(`  Error processing ${sourcePath}: ${error.message}`);
    stats.errors++;
  }
}

/**
 * Format bytes into human-readable string
 */
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round(bytes / (1024 * 1024) * 10) / 10} MB`;
}

/**
 * Main execution
 */
async function main() {
  console.log('=== Image Optimization Script ===\n');
  console.log(`Scanning directories: ${IMAGE_ROOTS.join(', ')}`);
  console.log(`Target formats: ${ALLOWED_EXTENSIONS.join(', ')}`);
  console.log(`WebP quality: ${WEBP_QUALITY}`);
  console.log(`Minimum savings threshold: ${Math.round((1 - MIN_SAVINGS_RATIO) * 100)}%\n`);

  // Process each root directory
  for (const root of IMAGE_ROOTS) {
    if (!fs.existsSync(root)) {
      console.log(`Skipping ${root} (directory does not exist)\n`);
      continue;
    }

    console.log(`Processing ${root}...`);

    // Walk directory and process images
    for (const filePath of walkDirectory(root)) {
      if (shouldProcessFile(filePath)) {
        await processImage(filePath, root);
      }
    }

    console.log('');
  }

  // Print summary
  console.log('=== Summary ===');
  console.log(`Files inspected: ${stats.inspected}`);
  console.log(`WebP files created: ${stats.created}`);
  console.log(`Already optimized (skipped): ${stats.alreadyOptimized}`);
  console.log(`Too small (skipped): ${stats.tooSmall}`);
  console.log(`WebP not smaller (discarded): ${stats.notSmaller}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Total bytes saved: ${formatBytes(stats.bytesSaved)}`);

  // Exit successfully even if some files had errors (best-effort tool)
  process.exit(0);
}

// Run the script
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
