// Copies the Google emoji spritesheet from emoji-datasource-google into
// web/public/emoji so the picker serves polished Google glyphs from our own
// origin (no CDN, works offline). Runs automatically on `npm install` via the
// "postinstall" script, and can be re-run with `npm run copy-emoji`.
//
// It is intentionally forgiving: if the source package isn't installed yet it
// warns and exits 0 rather than failing the whole install. The EmojiPicker then
// simply shows blank tiles until the sprite exists, which is the signal to run
// `npm install` again.

import { copyFileSync, cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

// Keep individual files because emoji-mart requests each emoji by unified code.
const packageRelativePath = 'emoji-datasource-google/img/google/64';
const sheetRelativePath = 'emoji-datasource-google/img/google/sheets-256/64.png';
const sourceCandidates = [
  resolve(webRoot, 'node_modules', packageRelativePath),
  resolve(webRoot, '..', 'node_modules', packageRelativePath),
];
const sheetCandidates = [
  resolve(webRoot, 'node_modules', sheetRelativePath),
  resolve(webRoot, '..', 'node_modules', sheetRelativePath),
];
const src = sourceCandidates.find((candidate) => existsSync(candidate));
const sheetSrc = sheetCandidates.find((candidate) => existsSync(candidate));
const destDir = resolve(webRoot, 'public/emoji/google/64');
const sheetDest = resolve(webRoot, 'public/emoji/google-64.png');
const metadataDest = resolve(webRoot, 'public/emoji/google/emoji.json');
const localMetadataCandidates = [
  resolve(webRoot, 'node_modules', 'emoji-datasource-google/emoji.json'),
  resolve(webRoot, '..', 'node_modules', 'emoji-datasource-google/emoji.json'),
];

if (!src) {
  console.warn('[copy-emoji] emoji-datasource-google not found yet — skipping. Run `npm install` to fetch it, then `npm run copy-emoji`.');
  process.exit(0);
}

try {
  mkdirSync(destDir, { recursive: true });
  cpSync(src, destDir, { recursive: true });
  if (sheetSrc) copyFileSync(sheetSrc, sheetDest);
  const localMetadata = localMetadataCandidates.find((candidate) => existsSync(candidate));
  if (localMetadata) {
    copyFileSync(localMetadata, metadataDest);
  } else {
    const response = await fetch('https://cdnjs.cloudflare.com/ajax/libs/emoji-datasource-google/16.0.0/emoji.json');
    if (!response.ok) throw new Error(`Google emoji metadata request failed: ${response.status}`);
    writeFileSync(metadataDest, await response.text());
  }
  console.log(`[copy-emoji] Google emoji images → ${destDir}`);
  if (sheetSrc) console.log(`[copy-emoji] Google emoji spritesheet → ${sheetDest}`);
  console.log(`[copy-emoji] Google emoji metadata → ${metadataDest}`);
} catch (err) {
  console.warn(`[copy-emoji] Could not copy spritesheet: ${err.message}`);
  process.exit(0);
}
