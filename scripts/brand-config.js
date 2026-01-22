// Brand Configuration - Filtered
// Shared constants for all asset generators

module.exports = {
  // Colors
  colors: {
    primaryLight: '#0D9488',
    primaryDark: '#0F766E',
    white: '#FFFFFF',
    darkText: '#1F2937',
    lightGray: '#F3F4F6',
    mutedText: 'rgba(255, 255, 255, 0.7)',
    accentText: 'rgba(255, 255, 255, 0.9)',
  },

  // Typography
  fonts: {
    primary: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
  },

  // Dimensions
  dimensions: {
    square: { width: 1080, height: 1080 },
    carousel: { width: 1080, height: 1350 },
    story: { width: 1080, height: 1920 },
    facebook: { width: 1200, height: 630 },
  },

  // Gradient definitions
  gradients: {
    tealDiagonal: {
      id: 'tealGradient',
      x1: '0%', y1: '0%',
      x2: '100%', y2: '100%',
      stops: [
        { offset: '0%', color: '#0F766E' },
        { offset: '100%', color: '#0D9488' }
      ]
    },
    tealVertical: {
      id: 'tealVerticalGradient',
      x1: '0%', y1: '0%',
      x2: '0%', y2: '100%',
      stops: [
        { offset: '0%', color: '#0D9488' },
        { offset: '100%', color: '#0F766E' }
      ]
    },
    softTeal: {
      id: 'softTealGradient',
      x1: '0%', y1: '0%',
      x2: '100%', y2: '100%',
      stops: [
        { offset: '0%', color: '#14B8A6' },
        { offset: '100%', color: '#0D9488' }
      ]
    }
  },

  // Decorative elements
  patterns: {
    dots: `<pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
      <circle cx="20" cy="20" r="1.5" fill="white" opacity="0.06"/>
    </pattern>`
  },

  // Filter icon SVG path
  filterIcon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z',

  // Common SVG helpers
  helpers: {
    createGradientDef: (gradient) => `
      <linearGradient id="${gradient.id}" x1="${gradient.x1}" y1="${gradient.y1}" x2="${gradient.x2}" y2="${gradient.y2}">
        ${gradient.stops.map(s => `<stop offset="${s.offset}" style="stop-color:${s.color}"/>`).join('\n        ')}
      </linearGradient>`,

    wrapText: (text, maxWidth, fontSize) => {
      // Rough character estimation: ~0.6 * fontSize per character
      const charsPerLine = Math.floor(maxWidth / (fontSize * 0.5));
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';

      words.forEach(word => {
        if ((currentLine + ' ' + word).trim().length <= charsPerLine) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) lines.push(currentLine);
          currentLine = word;
        }
      });
      if (currentLine) lines.push(currentLine);

      return lines;
    }
  }
};
