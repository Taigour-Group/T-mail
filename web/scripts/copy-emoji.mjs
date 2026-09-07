// Copies the Google emoji spritesheet from emoji-datasource-google into
// web/public/emoji so the picker serves polished Google glyphs from our own
// origin (no CDN, works offline). Runs automatically on `npm install` via the
// "postinstall" script, and can be re-run with `npm run copy-emoji`.
//
// It is intentionally forgiving: if the source package isn't installed yet it
// warns and exits 0 rather than failing the whole install. The EmojiPicker then
// simply shows blank tiles until the sprite exists, which is the signal to run
// `npm install` again.

import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

// 64px sheet matches emoji-mart's default sprite geometry.
const src = resolve(webRoot, 'node_modules/emoji-datasource-google/img/google/sheets-256/64.png');
const destDir = resolve(webRoot, 'public/emoji');
const dest = resolve(destDir, 'google-64.png');

if (!existsSync(src)) {
  console.warn('[copy-emoji] emoji-datasource-google not found yet — skipping. Run `npm install` to fetch it, then `npm run copy-emoji`.');
  process.exit(0);
}

try {
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, dest);
  console.log(`[copy-emoji] Google emoji spritesheet → ${dest}`);
} catch (err) {
  console.warn(`[copy-emoji] Could not copy spritesheet: ${err.message}`);
  process.exit(0);
}
