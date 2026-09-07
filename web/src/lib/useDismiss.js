import { useEffect } from 'react';

// Close a popover/menu when the user clicks outside it or presses Escape.
//
// Every toggle-only dropdown in the app had the same bug: it opened and closed
// with its own button but ignored clicks elsewhere, so stale panels piled up on
// screen. This hook is the one place that behavior lives now — pass the panel's
// ref, whether it's open, and what to do on dismiss.
//
//   const ref = useRef(null);
//   useDismiss(ref, open, () => setOpen(false));
//   return <div ref={ref}>…</div>;
//
// We listen on `mousedown` (not `click`) so the panel closes on press, before a
// click's target can be re-parented, and we ignore clicks on the trigger via the
// `ignoreRef` so the toggle button keeps working as a toggle.
export function useDismiss(ref, open, onClose, ignoreRef = null) {
  useEffect(() => {
    if (!open) return undefined;

    const onPointer = (event) => {
      const panel = ref.current;
      const ignore = ignoreRef?.current;
      if (panel && panel.contains(event.target)) return;
      if (ignore && ignore.contains(event.target)) return;
      onClose();
    };

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose, ignoreRef]);
}

export default useDismiss;
