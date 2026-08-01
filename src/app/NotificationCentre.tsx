'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  NOTIFICATION_BADGE_MAX,
  type NotificationFeed,
} from '@/lib/notifications';

/**
 * The bell in the navbar.
 *
 * The feed is resolved on the server and passed in, like the session is — the
 * panel does no fetching of its own, so opening it costs nothing and the badge
 * is correct on first paint rather than popping in after hydration.
 */
export default function NotificationCentre({
  feed,
  markRead,
}: {
  feed: NotificationFeed;
  markRead: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);

  // Opening is what marks them read, so the count clears the moment they have
  // actually been seen rather than on a timer or on next navigation.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && feed.unread > 0) {
      startTransition(async () => {
        try {
          await markRead();
        } catch {
          // A failed write only means the badge shows again next load.
        }
      });
    }
  }

  // Click-outside and Escape, so the panel behaves like every other dropdown.
  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const badge =
    feed.unread > NOTIFICATION_BADGE_MAX
      ? `${NOTIFICATION_BADGE_MAX}+`
      : String(feed.unread);

  return (
    <div className="notif" ref={wrapRef}>
      <button
        type="button"
        className="notif-bell"
        onClick={toggle}
        aria-expanded={open}
        aria-label={
          feed.unread > 0
            ? `Notifications, ${feed.unread} unread`
            : 'Notifications'
        }
      >
        {/* Drawn as a glyph rather than an SVG so it costs no extra request,
            matching how the burger menu is done. */}
        <span className="notif-icon" aria-hidden="true">🔔</span>
        {feed.unread > 0 && <span className="notif-badge">{badge}</span>}
      </button>

      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">Notifications</div>

          {feed.items.length === 0 ? (
            <p className="notif-empty">
              Follow a listing and its developer&rsquo;s announcements show up here.
            </p>
          ) : (
            <ul className="notif-list">
              {feed.items.map((n) => (
                <li key={n.id} className={`notif-item${n.unread ? ' notif-item-unread' : ''}`}>
                  <Link href={`/listings/${n.listingId}`} onClick={() => setOpen(false)}>
                    <span className="notif-listing">{n.listingName}</span>
                    <span className="notif-body">{n.body}</span>
                    <time className="notif-time" dateTime={n.createdAt}>
                      {new Date(n.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
