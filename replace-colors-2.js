const fs = require('fs');

const file = 'artifacts/project-holiness/src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const colorMap = {
  '#6f9878': '#8A3324',
  '#93a095': '#755F4D',
  '#d8dcd3': '#432920',
  '#dce9dc': '#2B0E0A',
  '#f9f7ef': '#EACCA0'
};

for (const [oldColor, newColor] of Object.entries(colorMap)) {
  const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  content = content.replace(regex, newColor);
}

fs.writeFileSync(file, content);
