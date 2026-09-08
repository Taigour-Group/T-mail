import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import baseData from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useDismiss } from '../lib/useDismiss.js';

// ARTWORK: Google emoji PNGs served from our own origin. `scripts/copy-emoji.mjs`
// copies emoji-datasource-google's img/google/64 into public/emoji/google/64 on
// postinstall, so filenames are exactly `<unified lowercased>.png` — the same
// identifier emoji-mart carries on every skin.
const GOOGLE_IMAGE_BASE = '/emoji/google/64';
const imageURL = (unified) => `${GOOGLE_IMAGE_BASE}/${String(unified).toLowerCase()}.png`;

// WHY WE STAMP `src` ONTO THE DATA INSTEAD OF USING A SPRITESHEET:
// emoji-mart hardcodes `spritesheet: true` for grid + search tiles, so a
// `getImageURL` prop alone is ignored there and it falls back to a CDN
// spritesheet positioned from each skin's `x`/`y`. The bundled dataset
// (@emoji-mart/data → sets/15/native.json) carries NO `x`/`y`, so those offsets
// came out `NaN%` and every tile rendered the sheet's first cell — the "#️⃣"
// keycap. That was the "all emoji show #" bug.
//
// A skin's own `src` takes precedence over both branches, so setting it here
// gets real per-emoji artwork everywhere, from our origin, with no CDN and no
// sprite-coordinate/version alignment to keep in sync. Rows are virtualised by
// emoji-mart, so only visible tiles are ever requested.
//
// emoji-mart mutates and memoises the data object it is given (module-level
// singleton), so we patch that same object once, lazily, and hand it over.
let patched = false;
function googleData() {
  if (!patched) {
    patched = true;
    Object.values(baseData.emojis || {}).forEach((emoji) => {
      (emoji.skins || []).forEach((skin) => {
        if (skin.unified && !skin.src) skin.src = imageURL(skin.unified);
      });
    });
  }
  return baseData;
}

// We hand back the emoji's unicode character (emoji.native) so stored messages
// stay portable, copyable and searchable — the image set only changes how the
// picker *looks*, not what gets inserted.
//
// POSITIONING: the panel is `position: fixed` and placed by measuring the trigger
// against the viewport, so it opens toward whichever side has the most room
// (above/below, and left/right) and never spills off-screen behind other panes —
// that was the "half behind the screen" bug. We recompute on open, scroll, and
// resize. The panel does NOT preventDefault on mousedown (emoji-mart's search
// input must be able to focus); only the trigger does, to keep the editor caret.

const PANEL_W = 300; // emoji-mart's default panel width
const PANEL_H = 435; // its default height
const GAP = 8;

export default function EmojiPicker({ onSelect, triggerClassName }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null); // { left, top } in viewport px
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  useDismiss(panelRef, open, () => setOpen(false), triggerRef);

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Vertical: prefer above the trigger; fall back to below if there's more room.
    const spaceAbove = r.top;
    const spaceBelow = vh - r.bottom;
    let top;
    if (spaceAbove >= PANEL_H + GAP || spaceAbove >= spaceBelow) {
      top = Math.max(GAP, r.top - GAP - PANEL_H);
    } else {
      top = Math.min(vh - PANEL_H - GAP, r.bottom + GAP);
    }
    top = Math.max(GAP, Math.min(top, vh - PANEL_H - GAP));

    // Horizontal: try to right-align the panel to the trigger, but keep it fully
    // on screen — clamp within [GAP, vw - PANEL_W - GAP].
    let left = r.right - PANEL_W;
    left = Math.max(GAP, Math.min(left, vw - PANEL_W - GAP));

    setPos({ left, top });
  }, []);

  // Measure synchronously before paint so the panel never flashes in the wrong
  // spot, then keep it pinned while the user scrolls or resizes.
  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    const onChange = () => place();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [open, place]);

  const pick = (emoji) => {
    if (emoji?.native) onSelect?.(emoji.native);
    setOpen(false);
  };

  return (
    <div className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()} // keep the editor selection when opening
        onClick={() => setOpen((v) => !v)}
        className={triggerClassName || `grid h-8 w-8 place-items-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${open ? 'bg-gray-100 text-gray-900' : ''}`}
        aria-label="Insert emoji"
        title="Insert emoji"
        aria-expanded={open}
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="fixed z-[60] rounded-2xl shadow-2xl"
          style={{ left: pos ? pos.left : -9999, top: pos ? pos.top : -9999, width: PANEL_W }}
        >
          <Picker
            data={googleData()}
            onEmojiSelect={pick}
            set="google"
            getImageURL={(set, unified) => imageURL(unified)}
            getSpritesheetURL={() => '/emoji/google-64.png'}
            theme="light"
            navPosition="top"
            previewPosition="none"
            skinTonePosition="search"
            perLine={8}
            maxFrequentRows={2}
            autoFocus
          />
        </div>
      )}
    </div>
  );
}
