'use client';

import { useEffect, useRef, useState } from 'react';
import { UNICODE_EMOJI, emojiToken, emojiUrl, type CustomEmoji } from '@/lib/emoji';

export default function EmojiPicker({
  customEmoji,
  onPick,
}: {
  customEmoji: CustomEmoji[];
  onPick: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click and on Escape — expected of any popover.
  useEffect(() => {
    if (!open) return;

    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const q = query.trim().toLowerCase();
  const matchingCustom = q
    ? customEmoji.filter((e) => e.name.toLowerCase().includes(q))
    : customEmoji;

  return (
    <div className="emoji-picker-root" ref={rootRef}>
      <button
        type="button"
        className="emoji-trigger"
        aria-expanded={open}
        aria-label="Insert emoji"
        onClick={() => setOpen((v) => !v)}
      >
        😀
      </button>

      {open && (
        <div className="emoji-panel" role="dialog" aria-label="Emoji picker">
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
