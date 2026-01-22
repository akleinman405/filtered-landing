#!/usr/bin/env node
/**
 * Generate Static Quote Card SVGs for Instagram
 * Output: 1080x1080 SVG files
 */

const fs = require('fs');
const path = require('path');
const brand = require('./brand-config');

// Output directory
const OUTPUT_DIR = path.join(__dirname, '../social-media-assets/generated/month-1/static');

// Quote card data
const quoteCards = [
  {
    id: 'static-01-coparent-anger',
    lines: [
      'You need to co-parent.',
      '',
      'You don\'t need to absorb',
      'their anger.'
    ],
    attribution: '— Filtered',
    style: 'gradient', // gradient, white, softGradient
  },
  {
    id: 'static-02-biff',
    lines: [
      'Brief.',
      'Informative.',
      'Friendly.',
      'Firm.',
      '',
      'Your new communication',
      'framework.'
    ],
    attribution: null,
    style: 'gradient',
  },
  {
    id: 'static-03-boundaries',
    lines: [
      'Boundaries aren\'t',
      'punishment for them.',
      '',
      'They\'re protection',
      'for you.'
    ],
    attribution: null,
    style: 'gradient',
  },
  {
    id: 'static-03b-everything-right',
    lines: [
      'Sometimes you do',
      'everything right',
      '',
      'and they still',
      'don\'t change.',
      '',
      'That\'s not your failure.'
    ],
    attribution: null,
    style: 'softGradient',
  },
  {
    id: 'static-04-nervous-system',
    lines: [
      'Your body responding to',
      'their notification with',
      'anxiety isn\'t weakness.',
      '',
      'It\'s your nervous system',
      'doing its job.',
      '',
      'The goal isn\'t to not',
      'feel it. The goal is to',
      'respond to it wisely.'
    ],
    attribution: null,
    style: 'gradient',
  }
];

function generateQuoteCard(card) {
  const { width, height } = brand.dimensions.square;
  const centerX = width / 2;

  // Calculate vertical positioning
  const lineHeight = 70;
  const nonEmptyLines = card.lines.filter(l => l !== '');
  const totalTextHeight = card.lines.length * lineHeight;
  let startY = (height - totalTextHeight) / 2 + 40;

  // Adjust for attribution
  if (card.attribution) {
    startY -= 30;
  }

  // Build text elements
  const textElements = card.lines.map((line, i) => {
    if (line === '') {
      return ''; // Empty line for spacing
    }
    const y = startY + (i * lineHeight);
    const fontSize = line.length > 30 ? 48 : 56;
    const fontWeight = line.endsWith('.') && line.length < 20 ? 700 : 400;

    return `  <text x="${centerX}" y="${y}"
        font-family="${brand.fonts.primary}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="white"
        text-anchor="middle">${escapeXml(line)}</text>`;
  }).filter(Boolean).join('\n');

  // Attribution if present
  const attributionElement = card.attribution ? `
  <text x="${centerX}" y="${startY + (card.lines.length * lineHeight) + 40}"
        font-family="${brand.fonts.primary}"
        font-size="36"
        font-weight="400"
        fill="white"
        opacity="0.8"
        text-anchor="middle">${escapeXml(card.attribution)}</text>` : '';

  // Choose gradient
  let gradientDef, bgFill;
  if (card.style === 'white') {
    gradientDef = '';
    bgFill = 'white';
  } else if (card.style === 'softGradient') {
    gradientDef = brand.helpers.createGradientDef(brand.gradients.softTeal);
    bgFill = `url(#${brand.gradients.softTeal.id})`;
  } else {
    gradientDef = brand.helpers.createGradientDef(brand.gradients.tealDiagonal);
    bgFill = `url(#${brand.gradients.tealDiagonal.id})`;
  }

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${gradientDef}
    ${brand.patterns.dots}
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${bgFill}"/>
  <rect width="${width}" height="${height}" fill="url(#dots)"/>

  <!-- Decorative circles -->
  <circle cx="${width - 80}" cy="80" r="150" fill="white" opacity="0.03"/>
  <circle cx="80" cy="${height - 80}" r="100" fill="white" opacity="0.03"/>

  <!-- Quote Text -->
${textElements}
${attributionElement}
</svg>`;

  return svg;
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function main() {
  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log('Generating quote cards...\n');

  quoteCards.forEach(card => {
    const svg = generateQuoteCard(card);
    const filename = `${card.id}.svg`;
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, svg);
    console.log(`  Created: ${filename}`);
  });

  console.log(`\nGenerated ${quoteCards.length} quote cards in ${OUTPUT_DIR}`);
}

main();
