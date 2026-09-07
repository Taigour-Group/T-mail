import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { useDismiss } from '../lib/useDismiss.js';

// Emoji picker built on emoji-mart, using the GOOGLE set served from OUR OWN
// origin. Non-native emoji-mart sets normally pull a spritesheet from a jsDelivr
// CDN; when that's blocked you get "#" placeholders (the earlier bug). We override
// getSpritesheetURL to a file under /public, so the polished Google glyphs load
// from the app itself — no CDN, works offline.
//
//   SETUP (one time, done outside this file):
//     1. `npm install`  (adds emoji-datasource-google, pinned to 15.0.1 to match
//        @emoji-mart/data so sprite coordinates line up)
//     2. copy node_modules/emoji-datasource-google/img/google/sheets-256/64.png
//        → web/public/emoji/google-64.png
//   If that file is missing the picker shows blanks, so the copy step is required.
//   To fall back to OS emoji instead, set SET = 'native' and drop the sprite prop.
//
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

// Google emoji spritesheet served from our own /public (see setup notes above).
// Switch to 'native' + remove getSpritesheetURL to use OS emoji instead.
const SET = 'google';
const SPRITE_URL = '/emoji/google-64.png';

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
            data={data}
            onEmojiSelect={pick}
            set={SET}
            getSpritesheetURL={() => SPRITE_URL}
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
