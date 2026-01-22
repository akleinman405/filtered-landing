#!/usr/bin/env node
/**
 * Convert SVG files to PNG using @resvg/resvg-js
 * Pure JavaScript - no external dependencies needed
 */

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const GENERATED_DIR = path.join(__dirname, '../social-media-assets/generated');

// Font configuration - use system fonts
const FONT_OPTIONS = {
  fontFiles: [],
  loadSystemFonts: true,
  defaultFontFamily: 'Inter',
};

function convertSvgToPng(svgPath, pngPath) {
  try {
    const svgContent = fs.readFileSync(svgPath, 'utf8');

    const resvg = new Resvg(svgContent, {
      font: FONT_OPTIONS,
      fitTo: {
        mode: 'original'
      },
      background: 'rgba(0, 0, 0, 0)', // Transparent background as fallback
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    fs.writeFileSync(pngPath, pngBuffer);
    return true;
  } catch (e) {
    console.error(`    Error: ${e.message}`);
    return false;
  }
}

function findSvgFiles(dir) {
  const svgFiles = [];

  function walkDir(currentDir) {
    const files = fs.readdirSync(currentDir);
    files.forEach(file => {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else if (file.endsWith('.svg')) {
        svgFiles.push(filePath);
      }
    });
  }

  walkDir(dir);
  return svgFiles;
}

async function main() {
  console.log('SVG to PNG Converter (using resvg-js)\n');
  console.log('Finding SVG files...\n');

  const svgFiles = findSvgFiles(GENERATED_DIR);
  console.log(`Found ${svgFiles.length} SVG files\n`);

  let converted = 0;
  let failed = 0;

  for (const svgPath of svgFiles) {
    const pngPath = svgPath.replace('.svg', '.png');
    const relativePath = path.relative(GENERATED_DIR, svgPath);

    const success = convertSvgToPng(svgPath, pngPath);

    if (success) {
      console.log(`  ✓ ${relativePath}`);
      converted++;
    } else {
      console.log(`  ✗ ${relativePath}`);
      failed++;
    }
  }

  console.log(`\n-------------------`);
  console.log(`Converted: ${converted}/${svgFiles.length}`);

  if (failed > 0) {
    console.log(`Failed: ${failed}`);
    console.log(`\nNote: Font rendering may vary. For best results with Inter font:`);
    console.log(`  - Ensure Inter is installed on your system`);
    console.log(`  - Or use Figma/Canva for final exports`);
  }

  // Show output location
  console.log(`\nPNG files saved to: ${GENERATED_DIR}`);
}

main();
