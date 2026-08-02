'use client';

import { useEffect, useRef, useState } from 'react';

export type RowMenuItem = {
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
};

/**
 * The per-row actions menu for the admin tables.
 *
 * Two things about it are deliberate rather than incidental:
 *
 * The panel is `position: fixed` and placed from the button's rect, because the
 * tables live inside `.table-scroll` (`overflow-x: auto`), which would clip an
 * absolutely positioned dropdown at the table's edge — and the actions column
 * is at that edge. Fixed escapes the clip, at the cost of not following the
 * page when it scrolls, so it closes on scroll instead of drifting.
 *
 * It holds only buttons. The dialogs the items open are rendered by the row,
 * outside this component: closing the menu unmounts everything inside it, and
 * an open <dialog> that gets unmounted takes the modal with it.
 */
export default function RowMenu({
  items,
  label = 'Actions',
}: {
  items: RowMenuItem[];
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      // Right-aligned to the button, so the panel grows leftwards and cannot
      // push the viewport wider.
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    const close = () => setOpen(false);

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    // Capture phase: the scroll that matters is the table's, which does not
    // bubble to window.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="row-menu-btn"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={label}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && pos && (
        <div
          ref={panelRef}
          className="row-menu"
          role="menu"
          style={{ top: pos.top, right: pos.right }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={`row-menu-item${item.danger ? ' row-menu-item-danger' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
