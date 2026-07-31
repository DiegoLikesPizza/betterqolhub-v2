'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';

const DISMISS_KEY = 'qolhub:hide-discord-reminder';

// localStorage is external state, so it is read with useSyncExternalStore
// rather than mirrored into useState from an effect — that pattern causes a
// second render pass on every mount and is what the cascading-render lint rule
// is warning about.
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Also react to another tab dismissing it.
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

function getSnapshot(): boolean {
  return window.localStorage.getItem(DISMISS_KEY) === '1';
}

// Treated as dismissed while rendering on the server: the banner then appears
// after hydration for those who have not dismissed it. The opposite default
// would flash a banner at everyone who already dismissed it.
function getServerSnapshot(): boolean {
  return true;
}

function dismiss(): void {
  window.localStorage.setItem(DISMISS_KEY, '1');
  listeners.forEach((l) => l());
}

/**
 * Shown to signed-in members who have not linked Discord — without it they
 * cannot review anything, which is otherwise only discoverable by trying.
 * Dismissible, because a nudge that reappears on every navigation is noise.
 */
export default function LinkDiscordBanner() {
  const pathname = usePathname();
  const hidden = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // No point nagging on the page that fixes it.
  if (hidden || pathname === '/settings') return null;

  return (
    <div className="link-banner" role="status">
      <span className="link-banner-text">
        Link your Discord in{' '}
        <Link href="/settings" className="link-banner-link">
          Account settings
        </Link>{' '}
        to post reviews.
      </span>
      <button
        type="button"
        className="link-banner-close"
        aria-label="Dismiss reminder"
        onClick={dismiss}
      >
        ✕
      </button>
    </div>
  );
}
