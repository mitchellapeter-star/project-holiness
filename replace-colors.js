const fs = require('fs');

const file = 'artifacts/project-holiness/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const colorMap = {
  // Backgrounds (light paper -> dark chapel wood)
  '#f4f3eb': '#140C0B',
  '#f8f7f1': '#1B110F',
  '#fcfbf7': '#1B110F',
  '#f8fbf7': '#1B110F',
  '#fbfaf5': '#1B110F',
  '#f9f8f2': '#1B110F',
  '#edf3eb': '#221411',
  '#edf2e9': '#221411',
  '#e4eee1': '#221411',
  '#dcebdc': '#2E1A16',
  '#dbe8d8': '#2E1A16',
  '#dbe8db': '#2E1A16',
  '#edf0ea': '#221411',
  '#e8e9dc': '#301C18',
  '#e0eee4': '#1B261D', // green pill bg -> dark emerald bg
  '#e7ece2': '#221411',

  // Borders and muted bg
  '#c1d6c1': '#432920',
  '#cbd7c6': '#432920',
  '#cbd8ca': '#432920',
  '#c9cbb8': '#432920',
  '#d6ddcf': '#432920',
  '#d1dcd0': '#432920',
  '#dedfd4': '#432920',
  '#d8ddce': '#432920',
  '#e1e2d8': '#38221B',
  '#e4e5dc': '#38221B',
  '#e3e4da': '#38221B',
  '#e0e0d4': '#38221B',
  '#d9dfd5': '#432920',
  '#c7cec1': '#432920',
  '#d6e2d3': '#432920',
  '#e2e5dc': '#432920',
  '#c2ddcb': '#284531', // green pill border -> dark emerald border
  '#dfe2d8': '#432920',

  // Dark elements (shadows, sidebars, text)
  '#1e4938': '#EACCA0', // primary dark green -> warm gold text
  '#183b2c': '#0A0605', // sidebar bg -> deep shadow
  '#163a2b': '#0A0605', 
  '#10241b': '#000000',
  '#285a45': '#6B1D18', // button green -> crimson
  '#315d46': '#C8AC85', // text green -> dimmer gold
  '#286046': '#C8AC85', // text green
  '#2c684b': '#C8AC85',
  '#345846': '#241511', // dark border
  '#456956': '#241511',
  '#264d3b': '#82251D', // hover greens -> lighter crimson
  '#224a38': '#6B1D18',
  '#1e4433': '#4D120E',
  '#2d5945': '#4D120E',
  '#3b7654': '#AA8866', // mid greens
  '#427158': '#AA8866',
  '#496756': '#AA8866',
  '#4c855e': '#AA8866',
  '#4e7659': '#AA8866',
  '#557164': '#8B6D53',
  '#527260': '#8B6D53',
  '#5b7063': '#8B6D53',
  '#55755f': '#8B6D53',
  '#60776b': '#9A8572', // muted text
  '#6c8175': '#9A8572',
  '#66806e': '#9A8572',
  '#718276': '#9A8572',
  '#73877a': '#9A8572',
  '#789080': '#9A8572',
  '#7e9d83': '#9A8572',
  '#819185': '#755F4D', // lighter text
  '#88998c': '#755F4D',
  '#89988e': '#755F4D',
  '#8cb097': '#755F4D',
  '#a0ada2': '#5C4232', // very light text/borders
  '#a6b7a7': '#5C4232',
  '#b4c8b2': '#5C4232',
  '#b6c7b6': '#5C4232',
  '#b9cbb8': '#5C4232',
  '#c3d0c3': '#5C4232',
  '#e6eee3': '#9A8572',
  
  // Gold/Yellows
  '#d7b56d': '#D4AF37',
  '#a27e43': '#B89030',
  '#ac8345': '#B89030',
  '#b59146': '#B89030',
  '#c28f3e': '#B89030',
  '#f5ead0': '#291F11',
  '#f5ecd7': '#291F11',
  '#e8d5b0': '#4A3B24',
  '#86652e': '#F2D588',

  // Reds
  '#a34f3e': '#E5534B',
  '#9d4d3b': '#E5534B',
  '#e2c1b7': '#611F17',
  '#f0c5bb': '#611F17',
  '#f9ece8': '#2B0E0A',
  '#f7e6e1': '#2B0E0A',

  // Explicit string swaps for standard tailwind colors used
  'bg-white/50': 'bg-black/40',
  'bg-white/60': 'bg-black/50',
  'bg-white/80': 'bg-black/70',
  'bg-white': 'bg-[#18100D]',
  'hover:bg-white/80': 'hover:bg-black/60',
  'text-white': 'text-[#EACCA0]',
  'bg-black/5': 'bg-white/5',
  'bg-black/10': 'bg-white/10',
  'bg-black/20': 'bg-white/20',
};

for (const [oldColor, newColor] of Object.entries(colorMap)) {
  const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  content = content.replace(regex, newColor);
}

fs.writeFileSync(file, content);
