#!/usr/bin/env node
/**
 * Generate Carousel Slide SVGs for Instagram
 * Output: 1080x1350 SVG files
 */

const fs = require('fs');
const path = require('path');
const brand = require('./brand-config');

// Output base directory
const OUTPUT_BASE = path.join(__dirname, '../social-media-assets/generated/month-1');

// Carousel definitions
const carousels = {
  'carousel-01': {
    name: 'Introduction',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['What if you could read', 'your co-parent\'s messages', '', 'without the anxiety?'],
        style: 'gradient'
      },
      {
        id: 'slide-02',
        type: 'content',
        lines: ['You know the feeling:', '', 'Their name appears on your phone.', 'Your stomach drops.', 'Your mind races.', '', 'Before you even read it,', 'you\'re already bracing for impact.'],
        style: 'white'
      },
      {
        id: 'slide-03',
        type: 'content',
        lines: ['You need to co-parent.', '', 'You don\'t need to absorb', 'their frustration.', '', 'You don\'t need to decode', 'their passive-aggression.', '', 'You just need the information.'],
        style: 'gradient'
      },
      {
        id: 'slide-04',
        type: 'content',
        lines: ['We asked ourselves:', '', 'What if there was a way to get', 'the information you need...', '', 'without the emotional weight', 'that comes with it?'],
        style: 'softGradient'
      },
      {
        id: 'slide-05',
        type: 'content',
        lines: ['That\'s why we built Filtered.', '', 'An app that shows you:', '• What they\'re actually asking for', '• Any deadlines or action items', '• The mood of the message', '• Suggested responses', '', 'The facts. Not the drama.'],
        style: 'white'
      },
      {
        id: 'slide-06',
        type: 'content',
        lines: ['The original message is', 'always there if you need it.', '', 'For documentation.', 'For your records.', '', 'But you don\'t have to absorb', 'the hostility to get the information.'],
        style: 'gradient'
      },
      {
        id: 'slide-07',
        type: 'cta',
        lines: ['Your peace matters.', '', 'If you\'re ready to change how', 'you experience co-parent messages,', 'link is in bio.'],
        hashtags: '#coparenting #peacefulcoparenting',
        style: 'gradient'
      }
    ]
  },
  'carousel-01b': {
    name: 'Dads',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['To every dad navigating', 'co-parent communication:', '', 'This one\'s for you.'],
        style: 'gradient'
      },
      {
        id: 'slide-02',
        type: 'content',
        lines: ['Co-parenting resources often', 'assume the audience is moms.', '', 'But dads are navigating the', 'same anxiety, the same difficult', 'texts, the same sleepless nights.', '', 'Your experience matters too.'],
        style: 'white'
      },
      {
        id: 'slide-03',
        type: 'content',
        lines: ['You don\'t have to explain:', '', '• Why you want to be involved', '• Why your parenting looks different', '• Why this is hard for you too', '• Why you need boundaries', '• Why you need support'],
        style: 'softGradient'
      },
      {
        id: 'slide-04',
        type: 'content',
        lines: ['"Dads don\'t get anxious about texts."', '', 'Actually, they do.', '', '"Dads should just let it go."', '', 'Actually, they shouldn\'t have to.', '', 'Your feelings are valid.'],
        style: 'white'
      },
      {
        id: 'slide-05',
        type: 'content',
        lines: ['Different doesn\'t mean wrong.', '', 'Your household, your routines.', 'Consistency within YOUR home', 'is what matters.', '', 'You\'re not "babysitting."', 'You\'re parenting.'],
        style: 'softGradient'
      },
      {
        id: 'slide-06',
        type: 'cta',
        lines: ['To every dad navigating this:', '', 'Your presence matters.', 'Your peace matters.', 'You\'re not alone.', '', 'Save this for a hard day.'],
        hashtags: '#coparentingdads #fatherhood',
        style: 'gradient'
      }
    ]
  },
  'carousel-02': {
    name: 'BIFF Method',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['The 4-letter framework that', 'changes co-parenting:', '', 'BIFF', '', '↓ Swipe to learn it ↓'],
        style: 'gradient'
      },
      {
        id: 'slide-02',
        type: 'content',
        lines: ['BIFF stands for:', '', 'Brief', 'Informative', 'Friendly', 'Firm', '', 'Created by Bill Eddy at the', 'High Conflict Institute.'],
        style: 'white'
      },
      {
        id: 'slide-03',
        type: 'letter',
        letter: 'B',
        title: 'Brief',
        lines: ['Keep it short. One paragraph', 'max—often one sentence is better.', '', 'Long explanations invite debate.', 'Short responses end conversations.', '', '✗ "I understand you\'re frustrated..."', '✓ "I can do 5pm pickup."'],
        style: 'gradient'
      },
      {
        id: 'slide-04',
        type: 'letter',
        letter: 'I',
        title: 'Informative',
        lines: ['Stick to facts. No opinions,', 'no emotions, no defensiveness.', '', 'Just the relevant information.', '', '✗ "You always do this, but fine..."', '✓ "I can adjust the pickup time."'],
        style: 'white'
      },
      {
        id: 'slide-05',
        type: 'letter',
        letter: 'F',
        title: 'Friendly',
        lines: ['Neutral tone. Not aggressive,', 'not overly warm.', '', 'Professional warmth—like you\'d', 'use with a colleague.', '', '✗ "Whatever you want."', '✓ "Thanks for letting me know."'],
        style: 'gradient'
      },
      {
        id: 'slide-06',
        type: 'letter',
        letter: 'F',
        title: 'Firm',
        lines: ['End the conversation. Don\'t', 'leave room for debate.', '', 'No questions that invite argument.', '', '✗ "Does that work for you?"', '✓ "See you Saturday at 5pm."'],
        style: 'white'
      },
      {
        id: 'slide-07',
        type: 'content',
        lines: ['BIFF in action:', '', 'They send: A 3-paragraph message', 'about everything you\'ve done wrong,', 'ending with a schedule change.', '', 'Your BIFF response:', '', '"Thanks for letting me know.', '5pm works. See you then."', '', 'That\'s it.'],
        style: 'softGradient'
      },
      {
        id: 'slide-08',
        type: 'cta',
        lines: ['You don\'t have to match', 'their energy.', '', 'Brief. Informative.', 'Friendly. Firm.', '', 'Save this for your next', 'difficult exchange.'],
        hashtags: '#BIFF #coparenting',
        style: 'gradient'
      }
    ]
  },
  'carousel-03': {
    name: 'Boundaries',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['When they demand', 'an immediate response', '', '↓ Your boundary script ↓'],
        style: 'gradient'
      },
      {
        id: 'slide-02',
        type: 'scenario',
        lines: ['The message:', '', '"I need to know NOW.', 'This can\'t wait.', 'Answer me."', '', 'Your heart rate spikes.', 'Your fingers start typing.', '', 'Wait.'],
        style: 'white'
      },
      {
        id: 'slide-03',
        type: 'content',
        lines: ['Before you respond, ask:', '', 'Is this actually an emergency?', '(Is a child in danger?)', '', 'If no—you have time.', '', 'Their urgency is not', 'your emergency.'],
        style: 'gradient'
      },
      {
        id: 'slide-04',
        type: 'response',
        lines: ['Your response:', '', '"I\'ll review this and', 'respond by [time/date]."', '', 'That\'s it.', '', 'You\'ve acknowledged.', 'You\'ve committed to respond.', 'You\'ve set YOUR timeline.'],
        style: 'white'
      },
      {
        id: 'slide-05',
        type: 'content',
        lines: ['Why this works:', '', '✓ You\'re not ignoring them', '✓ You\'re giving yourself space', '✓ You\'re responding thoughtfully', '✓ You\'re modeling healthy pacing', '✓ You\'re protecting your nervous system'],
        style: 'softGradient'
      },
      {
        id: 'slide-06',
        type: 'content',
        lines: ['The only exception:', '', 'Actual emergencies involving', 'your children\'s safety.', '', '"I need to know which', 'shoes to pack" ≠ emergency', '', '"Child has a 104 fever and', 'needs a medical decision" = emergency'],
        style: 'white'
      },
      {
        id: 'slide-07',
        type: 'cta',
        lines: ['Boundaries aren\'t punishment.', 'They\'re protection.', '', 'Save this for next time.'],
        hashtags: '#coparenting #boundaries',
        style: 'gradient'
      }
    ]
  },
  'carousel-04': {
    name: 'Nervous System',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['Why your stomach drops', 'when you see their name', 'on your phone', '', '(It\'s not weakness—it\'s biology)', '', '↓ Swipe ↓'],
        style: 'gradient'
      },
      {
        id: 'slide-02',
        type: 'content',
        lines: ['Here\'s what\'s happening:', '', 'Your brain has learned that', 'messages from your co-parent', 'sometimes mean conflict.', '', 'So your nervous system', 'responds to the notification', 'like a threat.', '', 'Before you even read it.'],
        style: 'white'
      },
      {
        id: 'slide-03',
        type: 'content',
        lines: ['This is called the', 'fight-or-flight response.', '', 'Your heart rate increases.', 'Stress hormones release.', 'Your thinking brain takes', 'a backseat.', '', 'This happens in milliseconds.'],
        style: 'softGradient'
      },
      {
        id: 'slide-04',
        type: 'content',
        lines: ['Why this matters:', '', 'When you\'re in fight-or-flight,', 'you\'re NOT in your best', 'decision-making state.', '', 'That\'s why you draft texts', 'at 2am that seem reasonable', 'then but cringe-worthy later.'],
        style: 'gradient'
      },
      {
        id: 'slide-05',
        type: 'content',
        lines: ['What helps:', '', '1. Recognize the response', '   (That\'s just my nervous system)', '', '2. Create space before reading', '   (I don\'t have to open this now)', '', '3. Wait for regulation', '   (Let the stress hormones clear)', '', '4. Then respond', '   (From a clearer headspace)'],
        style: 'white'
      },
      {
        id: 'slide-06',
        type: 'cta',
        lines: ['Your body is trying', 'to protect you.', '', 'That\'s not weakness.', 'That\'s wisdom.', '', 'Save this for a hard day.'],
        hashtags: '#coparenting #nervoussystem',
        style: 'gradient'
      }
    ]
  },
  'carousel-04b': {
    name: 'Self-Reflection',
    slides: [
      {
        id: 'slide-01',
        type: 'hook',
        lines: ['The hardest question', 'to ask ourselves:', '', '"When am I contributing', 'to the conflict?"', '', '↓ Swipe for honest reflection ↓'],
        style: 'softGradient'
      },
      {
        id: 'slide-02',
        type: 'content',
        lines: ['This isn\'t about blame.', '', 'It\'s about self-awareness.', '', 'Even when we\'re dealing with', 'genuinely difficult communication...', '', 'Sometimes our patterns', 'aren\'t helping either.'],
        style: 'gradient'
      },
      {
        id: 'slide-03',
        type: 'content',
        lines: ['Honest check-in:', '', '• Do I sometimes over-explain', '  when one sentence would do?', '', '• Do I match their energy', '  instead of choosing my own?', '', '• Do I respond when silence', '  would be more effective?'],
        style: 'white'
      },
      {
        id: 'slide-04',
        type: 'content',
        lines: ['More honest questions:', '', '• Do I rehearse arguments', '  in my head between messages?', '', '• Do I sometimes want to', '  "win" the exchange?', '', '• Have I made this harder', '  by not setting boundaries earlier?'],
        style: 'softGradient'
      },
      {
        id: 'slide-05',
        type: 'content',
        lines: ['This isn\'t about self-blame.', '', 'It\'s about self-awareness.', '', 'You can be dealing with', 'genuinely difficult behavior', 'AND have patterns worth examining.', '', 'Both can be true.'],
        style: 'gradient'
      },
      {
        id: 'slide-06',
        type: 'cta',
        lines: ['Growth isn\'t weakness.', '', 'Honest self-reflection is', 'part of protecting your peace.', '', 'Save this for a reflective moment.'],
        hashtags: '#coparenting #selfawareness',
        style: 'gradient'
      }
    ]
  }
};

function generateSlide(slide, carouselId) {
  const { width, height } = brand.dimensions.carousel;
  const centerX = width / 2;
  const padding = 80;

  // Style configurations
  let bgColor, textColor, gradientDef = '';
  if (slide.style === 'white') {
    bgColor = '#FFFFFF';
    textColor = brand.colors.darkText;
  } else if (slide.style === 'softGradient') {
    gradientDef = brand.helpers.createGradientDef(brand.gradients.softTeal);
    bgColor = `url(#${brand.gradients.softTeal.id})`;
    textColor = brand.colors.white;
  } else {
    gradientDef = brand.helpers.createGradientDef(brand.gradients.tealDiagonal);
    bgColor = `url(#${brand.gradients.tealDiagonal.id})`;
    textColor = brand.colors.white;
  }

  // Calculate line heights and positioning
  const baseFontSize = slide.type === 'hook' ? 52 : 42;
  const lineHeight = baseFontSize * 1.4;
  const totalLines = slide.lines.length;
  const contentHeight = totalLines * lineHeight;
  let startY = (height - contentHeight) / 2;

  // Adjust for special elements
  if (slide.letter) {
    startY += 60; // Make room for large letter
  }
  if (slide.hashtags) {
    startY -= 40; // Make room for hashtags
  }

  // Build text elements
  const textElements = slide.lines.map((line, i) => {
    if (line === '') return '';

    const y = startY + (i * lineHeight);
    let fontSize = baseFontSize;
    let fontWeight = 400;
    let opacity = 1;
    let textAnchor = 'middle';
    let x = centerX;

    // Style variations based on content
    if (line.startsWith('•') || line.startsWith('✓') || line.startsWith('✗')) {
      fontSize = 36;
      textAnchor = 'start';
      x = padding + 40;
    } else if (line.startsWith('   ')) {
      fontSize = 34;
      textAnchor = 'start';
      x = padding + 80;
    } else if (line.startsWith('"') || line.startsWith('"')) {
      fontSize = 38;
      fontWeight = 500;
      opacity = 0.95;
    } else if (line === line.toUpperCase() && line.length > 3) {
      // All caps = heading
      fontWeight = 700;
      fontSize = 44;
    } else if (line.includes('↓')) {
      fontSize = 32;
      opacity = 0.7;
    }

    // Hook slides get larger text
    if (slide.type === 'hook' && !line.includes('↓')) {
      fontSize = Math.min(fontSize + 8, 56);
      fontWeight = i === 0 ? 600 : fontWeight;
    }

    return `  <text x="${x}" y="${y}"
        font-family="${brand.fonts.primary}"
        font-size="${fontSize}"
        font-weight="${fontWeight}"
        fill="${textColor}"
        opacity="${opacity}"
        text-anchor="${textAnchor}">${escapeXml(line)}</text>`;
  }).filter(Boolean).join('\n');

  // Large letter for BIFF slides
  let letterElement = '';
  if (slide.letter) {
    letterElement = `
  <!-- Large Letter -->
  <text x="${centerX}" y="${startY - 80}"
        font-family="${brand.fonts.primary}"
        font-size="140"
        font-weight="900"
        fill="${textColor}"
        opacity="0.15"
        text-anchor="middle">${slide.letter}</text>
  <text x="${centerX}" y="${startY - 40}"
        font-family="${brand.fonts.primary}"
        font-size="36"
        font-weight="700"
        fill="${textColor}"
        text-anchor="middle">${slide.letter} = ${slide.title}</text>`;
  }

  // Hashtags for CTA slides
  let hashtagElement = '';
  if (slide.hashtags) {
    hashtagElement = `
  <text x="${centerX}" y="${height - 100}"
        font-family="${brand.fonts.primary}"
        font-size="28"
        font-weight="400"
        fill="${textColor}"
        opacity="0.7"
        text-anchor="middle">${escapeXml(slide.hashtags)}</text>`;
  }

  // Decorative elements for gradient slides
  let decorativeElements = '';
  if (slide.style !== 'white') {
    decorativeElements = `
  <!-- Decorative -->
  <circle cx="${width - 60}" cy="60" r="120" fill="white" opacity="0.03"/>
  <circle cx="60" cy="${height - 60}" r="80" fill="white" opacity="0.03"/>`;
  }

  const svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${gradientDef}
    ${slide.style !== 'white' ? brand.patterns.dots : ''}
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${height}" fill="${bgColor}"/>
  ${slide.style !== 'white' ? `<rect width="${width}" height="${height}" fill="url(#dots)"/>` : ''}
  ${decorativeElements}
${letterElement}
  <!-- Content -->
${textElements}
${hashtagElement}
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
  console.log('Generating carousel slides...\n');

  let totalSlides = 0;

  Object.entries(carousels).forEach(([carouselId, carousel]) => {
    const outputDir = path.join(OUTPUT_BASE, carouselId);
    fs.mkdirSync(outputDir, { recursive: true });

    console.log(`  ${carouselId} (${carousel.name}):`);

    carousel.slides.forEach(slide => {
      const svg = generateSlide(slide, carouselId);
      const filename = `${carouselId}-${slide.id}.svg`;
      const filepath = path.join(outputDir, filename);

      fs.writeFileSync(filepath, svg);
      console.log(`    - ${filename}`);
      totalSlides++;
    });

    console.log('');
  });

  console.log(`Generated ${totalSlides} carousel slides in ${OUTPUT_BASE}`);
}

main();
