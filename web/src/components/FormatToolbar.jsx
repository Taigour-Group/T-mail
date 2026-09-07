import { useRef, useState } from 'react';
import { useDismiss } from '../lib/useDismiss.js';
import EmojiPicker from './EmojiPicker.jsx';

// One formatting toolbar, shared by every compose surface. Previously the same
// ~20 buttons were hand-duplicated in Compose's inline and full modes, which is
// exactly how the two drifted out of sync. Keeping it here means one definition,
// one behavior. `execCommand` is deprecated but still the pragmatic path for a
// contentEditable rich editor and is what the rest of the app already relies on.
//
// Font / size / style are custom dropdowns, NOT native <select>s: a browser can't
// render each <option> in its own typeface or size, so a native menu can't show
// you what you're choosing. These dropdowns preview every choice — the font name
// set in that font, each size at its real size — which is the whole point.
//
// Color / highlight are popovers built from BUTTONS (not native inputs): a native
// <input type=color> steals focus and collapses the editor's selection, so
// foreColor would apply to nothing. Buttons with onMouseDown-preventDefault keep
// the selection alive — the same trick the plain toolbar buttons use.

const FONTS = [
  { label: 'Sans Serif', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Monospace', value: '"Courier New", monospace' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
  { label: 'Tahoma', value: 'Tahoma, sans-serif' },
];

// execCommand fontSize takes the legacy 1–7 scale; px is only for the preview.
const SIZES = [
  { label: 'Small', value: '2', px: 12 },
  { label: 'Normal', value: '3', px: 15 },
  { label: 'Medium', value: '4', px: 18 },
  { label: 'Large', value: '5', px: 22 },
  { label: 'Huge', value: '7', px: 30 },
];

// Paragraph-style presets via formatBlock. previewClass renders each row the way
// the style will actually look.
const STYLES = [
  { label: 'Normal text', value: 'P', previewClass: 'text-sm' },
  { label: 'Title', value: 'H1', previewClass: 'text-xl font-bold' },
  { label: 'Heading', value: 'H2', previewClass: 'text-lg font-semibold' },
  { label: 'Subheading', value: 'H3', previewClass: 'text-base font-medium text-gray-700' },
  { label: 'Quote', value: 'BLOCKQUOTE', previewClass: 'text-sm italic text-gray-600' },
  { label: 'Code block', value: 'PRE', previewClass: 'font-mono text-[13px] text-gray-700' },
];

const TEXT_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#ffffff',
  '#e11d48', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#06b6d4', '#0ea5e9', '#1a73e8', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#78350f',
];

const HIGHLIGHTS = [
  { label: 'None', value: 'transparent' },
  { label: 'Yellow', value: '#fff3bf' },
  { label: 'Green', value: '#d3f9d8' },
  { label: 'Blue', value: '#d0ebff' },
  { label: 'Pink', value: '#ffe3ec' },
  { label: 'Orange', value: '#ffe8cc' },
  { label: 'Purple', value: '#eebefa' },
  { label: 'Gray', value: '#e9ecef' },
];

function Icon({ name }) {
  const paths = {
    link: <><path d="M10 13a5 5 0 007.07.07l1.86-1.86a5 5 0 00-7.07-7.07L10.8 5.13" /><path d="M14 11a5 5 0 00-7.07-.07L5.07 12.8a5 5 0 007.07 7.07l1.06-1.06" /></>,
    signature: <><path d="M4 19c2-3 3-8 6-8 2 0 0 5 2 5 1 0 2-2 3-3 1-1 2 0 2 1" /><path d="M4 21h16" /></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9" r="1.5" /><path d="m21 15-5-5L5 20" /></>,
    alignLeft: <><path d="M4 6h16M4 10h11M4 14h16M4 18h11" /></>,
    alignCenter: <><path d="M4 6h16M7 10h10M4 14h16M7 18h10" /></>,
    alignRight: <><path d="M4 6h16M9 10h11M4 14h16M9 18h11" /></>,
    indent: <><path d="M4 6h16M11 12h9M11 18h9M4 10v4l4-2Z" /></>,
    outdent: <><path d="M4 6h16M11 12h9M11 18h9M8 10v4l-4-2Z" /></>,
    highlighter: <><path d="m9 11-6 6v3h3l6-6" /><path d="M13 7l4 4M15 5l4 4-7 7-4-4Z" /></>,
    clear: <><path d="m5 5 14 14M4 12h16M7 8h10M7 16h10" /></>,
    chevron: <path d="m6 9 6 6 6-6" />,
  };
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function Btn({ onClick, label, active = false, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()} // keep the editor selection while clicking
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${active ? 'bg-gray-100 text-gray-900' : ''}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 border-l border-gray-200" />;
}

// A previewing dropdown for font / size / style. Each row is rendered the way the
// choice will actually look; the active row gets a check. Preserves the editor
// selection (panel + rows preventDefault mousedown) so formatting lands on the
// text you had selected. Opens upward — toolbars sit near the bottom edge.
function Dropdown({ title, items, value, onPick, width = 'w-56', maxTrigger = 'max-w-[112px]', styleTrigger = false }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  useDismiss(panelRef, open, () => setOpen(false), triggerRef);
  const current = items.find((i) => i.value === value) || items[0];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-8 items-center gap-1 rounded px-2 text-xs text-gray-700 hover:bg-gray-100 ${open ? 'bg-gray-100' : ''}`}
        title={title}
        aria-label={title}
        aria-expanded={open}
      >
        <span className={`truncate ${maxTrigger}`} style={styleTrigger ? current.previewStyle : undefined}>{current.label}</span>
        <Icon name="chevron" />
      </button>
      {open && (
        <div
          ref={panelRef}
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute bottom-full left-0 z-50 mb-1 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl ${width}`}
          role="menu"
        >
          {items.map((it) => {
            const active = it.value === value;
            return (
              <button
                key={it.value}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onPick(it); setOpen(false); }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-gray-100 ${active ? 'bg-gray-50' : ''}`}
                role="menuitem"
              >
                <span className="grid w-4 shrink-0 place-items-center text-accent">
                  {active && (
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-11" /></svg>
                  )}
                </span>
                <span className={`min-w-0 flex-1 truncate text-gray-800 ${it.previewClass || ''}`} style={it.previewStyle}>{it.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// A popover anchored to a trigger button (used for color + highlight swatches).
// Opens upward and dismisses on outside click / Escape via useDismiss. The panel
// keeps the editor selection: onMouseDown-preventDefault on the whole panel means
// clicking a swatch never blurs the contentEditable.
function Popover({ label, trigger, children, width = 'w-56' }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);
  const triggerRef = useRef(null);
  useDismiss(panelRef, open, () => setOpen(false), triggerRef);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setOpen((v) => !v)}
        className={`grid h-8 min-w-8 place-items-center rounded px-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 ${open ? 'bg-gray-100 text-gray-900' : ''}`}
        aria-label={label}
        title={label}
        aria-expanded={open}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          onMouseDown={(e) => e.preventDefault()}
          className={`absolute bottom-full left-0 z-50 mb-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl ${width}`}
          role="menu"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

const FONT_ITEMS = FONTS.map((f) => ({ value: f.value, label: f.label, previewStyle: { fontFamily: f.value } }));
const SIZE_ITEMS = SIZES.map((s) => ({ value: s.value, label: s.label, previewStyle: { fontSize: `${s.px}px`, lineHeight: 1.2 } }));
const STYLE_ITEMS = STYLES.map((s) => ({ value: s.value, label: s.label, previewClass: s.previewClass }));

export default function FormatToolbar({ onFormat, onLink, onSignature, onImage }) {
  // Optimistic current-selection labels (execCommand can't reliably report state,
  // same as the old native selects) — they show what you last applied.
  const [styleValue, setStyleValue] = useState('P');
  const [fontValue, setFontValue] = useState(FONTS[0].value);
  const [sizeValue, setSizeValue] = useState('3');

  return (
    <div className="flex flex-wrap items-center gap-0.5 text-gray-600">
      {/* Paragraph style + font + size — each previews its own choice */}
      <Dropdown
        title="Paragraph style"
        items={STYLE_ITEMS}
        value={styleValue}
        width="w-52"
        maxTrigger="max-w-[120px]"
        onPick={(it) => { setStyleValue(it.value); onFormat('formatBlock', it.value); }}
      />
      <Dropdown
        title="Font"
        items={FONT_ITEMS}
        value={fontValue}
        width="w-52"
        maxTrigger="max-w-[110px]"
        styleTrigger
        onPick={(it) => { setFontValue(it.value); onFormat('fontName', it.value); }}
      />
      <Dropdown
        title="Font size"
        items={SIZE_ITEMS}
        value={sizeValue}
        width="w-40"
        maxTrigger="max-w-[64px]"
        onPick={(it) => { setSizeValue(it.value); onFormat('fontSize', it.value); }}
      />

      <Divider />

      {/* Emphasis */}
      <Btn onClick={() => onFormat('bold')} label="Bold"><strong>B</strong></Btn>
      <Btn onClick={() => onFormat('italic')} label="Italic"><em>I</em></Btn>
      <Btn onClick={() => onFormat('underline')} label="Underline"><u>U</u></Btn>
      <Btn onClick={() => onFormat('strikeThrough')} label="Strikethrough"><span className="line-through">S</span></Btn>

      {/* Text color */}
      <Popover
        label="Text color"
        width="w-56"
        trigger={<span className="grid place-items-center leading-none"><span className="text-sm font-bold">A</span><span className="mt-0.5 h-1 w-4 rounded-sm bg-gradient-to-r from-rose-500 via-emerald-500 to-blue-600" /></span>}
      >
        {(close) => (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-gray-500">Text color</p>
            <div className="grid grid-cols-6 gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onFormat('foreColor', c); close(); }}
                  className="h-6 w-6 rounded-full border border-black/10 transition hover:scale-110"
                  style={{ backgroundColor: c }}
                  aria-label={`Text color ${c}`}
                  title={c}
                />
              ))}
            </div>
          </>
        )}
      </Popover>

      {/* Highlight color */}
      <Popover label="Highlight" width="w-52" trigger={<Icon name="highlighter" />}>
        {(close) => (
          <>
            <p className="mb-1.5 px-1 text-[11px] font-medium text-gray-500">Highlight</p>
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHTS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { onFormat('hiliteColor', h.value); close(); }}
                  className="flex h-7 items-center justify-center rounded border border-gray-200 text-[10px] text-gray-600 hover:ring-2 hover:ring-accent/40"
                  style={{ backgroundColor: h.value === 'transparent' ? '#fff' : h.value }}
                  aria-label={`Highlight ${h.label}`}
                  title={h.label}
                >
                  {h.value === 'transparent' ? '⃠' : ''}
                </button>
              ))}
            </div>
          </>
        )}
      </Popover>

      <Divider />

      {/* Alignment */}
      <Btn onClick={() => onFormat('justifyLeft')} label="Align left"><Icon name="alignLeft" /></Btn>
      <Btn onClick={() => onFormat('justifyCenter')} label="Align center"><Icon name="alignCenter" /></Btn>
      <Btn onClick={() => onFormat('justifyRight')} label="Align right"><Icon name="alignRight" /></Btn>

      {/* Lists + indent */}
      <Btn onClick={() => onFormat('insertOrderedList')} label="Numbered list"><span className="text-xs">1.</span></Btn>
      <Btn onClick={() => onFormat('insertUnorderedList')} label="Bulleted list">•</Btn>
      <Btn onClick={() => onFormat('outdent')} label="Decrease indent"><Icon name="outdent" /></Btn>
      <Btn onClick={() => onFormat('indent')} label="Increase indent"><Icon name="indent" /></Btn>

      <Divider />

      {/* Insert */}
      <Btn onClick={onLink} label="Add link"><Icon name="link" /></Btn>
      {onImage && (
        <label className="grid h-8 w-8 cursor-pointer place-items-center rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900" title="Insert image" aria-label="Insert image">
          <Icon name="image" />
          <input type="file" accept="image/*" multiple className="hidden" onChange={onImage} />
        </label>
      )}
      <EmojiPicker onSelect={(emoji) => onFormat('insertText', emoji)} align="right" />
      <Btn onClick={onSignature} label="Insert signature"><Icon name="signature" /></Btn>

      <Divider />

      <Btn onClick={() => onFormat('removeFormat')} label="Clear formatting"><Icon name="clear" /></Btn>
    </div>
  );
}
