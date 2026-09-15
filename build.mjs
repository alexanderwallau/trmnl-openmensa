import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const root = new URL('./', import.meta.url);
const archive = execFileSync('zip', [
  '-q', '-X', '-MM', '-',
  'settings.yml',
  'shared.liquid',
  'full.liquid',
  'half_horizontal.liquid',
  'half_vertical.liquid',
  'quadrant.liquid',
], { cwd: root });

mkdirSync(new URL('dist/', root), { recursive: true });
writeFileSync(new URL('dist/import.zip', root), archive);
console.log('Built dist/import.zip');
