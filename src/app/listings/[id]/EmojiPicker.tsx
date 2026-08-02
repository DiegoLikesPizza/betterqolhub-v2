'use client';

import { useEffect, useRef, useState } from 'react';
import { UNICODE_EMOJI, emojiToken, emojiUrl, type CustomEmoji } from '@/lib/emoji';

/** Roughly the panel's width, used to keep it on screen near the right edge. */
const PANEL_WIDTH = 340;
const MARGIN = 8;

export default function EmojiPicker({
  customEmoji,
  onPick,
}: {
  customEmoji: CustomEmoji[];
  onPick: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Positioned as `fixed` from the trigger's rect rather than `absolute` inside
  // it. The review form now lives in a <dialog> whose body scrolls, and any
  // ancestor with overflow other than visible clips an absolutely positioned
  // child — the panel would have been cut off at the dialog's edge. Fixed
  // elements escape that, which is the same reason the admin row menu does it.
  function place() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAt({
      top: rect.bottom + MARGIN,
      left: Math.max(MARGIN, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - MARGIN)),
    });
  }

  // Close on outside click and on Escape — expected of any popover.
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      // Stopped here so Escape closes the picker without also closing the
      // dialog it now sits inside.
      if (e.key === 'Escape' && open) {
        e.stopPropagation();
        setOpen(false);
      }
    }
    // A fixed panel does not travel with its trigger, so it closes rather than
    // hanging in the wrong place.
    function onMove() {
      setOpen(false);
    }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onMove);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matchingCustom = q
    ? customEmoji.filter((e) => e.name.toLowerCase().includes(q))
    : customEmoji;

  return (
    <div className="emoji-picker-root" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="emoji-trigger"
        aria-expanded={open}
        aria-label="Insert emoji"
        onClick={() => {
          if (!open) place();
          setOpen((v) => !v);
        }}
      >
        😀
      </button>

      {open && at && (
        <div
          ref={panelRef}
          className="emoji-panel"
          role="dialog"
          aria-label="Emoji picker"
          style={{ top: at.top, left: at.left }}
        >
          <input
            type="text"
            className="form-input emoji-search"
            placeholder="Search server emoji…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />

          <div className="emoji-scroll">
            {matchingCustom.length > 0 && (
              <section>
                <h4 className="emoji-group">Server emoji</h4>
                <div className="emoji-grid">
                  {matchingCustom.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="emoji-cell"
                      title={`:${e.name}:`}
                      onClick={() => onPick(emojiToken(e))}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={emojiUrl(e.id, e.animated)} alt={`:${e.name}:`} loading="lazy" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {customEmoji.length === 0 && (
              <p className="emoji-empty">
                No server emoji available — the bot may be offline.
              </p>
            )}

            {/* Unicode groups are not filtered by the search box, which searches
                emoji *names* and only custom emoji have those. */}
            {!q &&
              UNICODE_EMOJI.map((group) => (
                <section key={group.group}>
                  <h4 className="emoji-group">{group.group}</h4>
                  <div className="emoji-grid">
                    {group.emoji.map((char) => (
                      <button
                        key={char}
                        type="button"
                        className="emoji-cell emoji-cell-unicode"
                        onClick={() => onPick(char)}
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
          </div>

          <p className="emoji-foot">
            Any emoji works — paste or use your system picker (Win + . / Ctrl + Cmd + Space).
          </p>
        </div>
      )}
    </div>
  );
}
