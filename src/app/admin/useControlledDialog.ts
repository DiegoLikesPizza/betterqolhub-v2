'use client';

import { useEffect, useRef } from 'react';

/**
 * Drives a <dialog> from the row that owns it.
 *
 * `openToken` is a number that changes on every open request, rather than a
 * boolean. That is the whole point: a boolean desyncs the moment the dialog
 * closes without React noticing — the DOM `close` event does not bubble, so a
 * delegated handler misses it, and Escape then leaves the owner's state
 * convinced the dialog is still open. Selecting the same action again would set
 * the same value, React would bail out of the render, the effect would not
 * re-run, and the dialog could never be reopened.
 *
 * With a token, every request is a distinct value, so the effect always runs
 * and always reconciles the element to what was asked for. The close listener
 * below is still attached — it keeps the owner's state tidy — but correctness
 * no longer depends on it firing.
 */
export function useControlledDialog(openToken: number | null, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.addEventListener('close', onClose);
    return () => el.removeEventListener('close', onClose);
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (openToken !== null && !el.open) el.showModal();
    if (openToken === null && el.open) el.close();
  }, [openToken]);

  return ref;
}
