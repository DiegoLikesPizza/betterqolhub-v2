'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Role } from '@prisma/client';
import NotificationCentre from './NotificationCentre';
import type { NotificationFeed } from '@/lib/notifications';

type NavUser = { name?: string | null; role: Role } | null;

// Client component so the current route can be highlighted and the mobile menu
// can open; the session is resolved on the server and passed in, and `logout` is
// a server action.
export default function NavBar({
  user,
  logout,
  notifications,
  markNotificationsRead,
}: {
  user: NavUser;
  logout: () => Promise<void>;
  notifications: NotificationFeed;
  markNotificationsRead: () => Promise<void>;
}) {
  const pathname = usePathname();

  /**
   * Below ~720px the row cannot hold logo + six links + account controls: it
   * needs about 560px at the smallest font sizes, so on a phone the logo and
   * "Sign out" wrapped onto two lines and the bar looked broken. Under that
   * width the links move into a drop-down panel instead.
   */
  const [open, setOpen] = useState(false);

  // Closing on navigation is done by the links themselves rather than by an
  // effect watching the pathname — no effect, no state update during render.
  const close = () => setOpen(false);

  // "/" must match exactly or it would light up on every page; the others match
  // their subtree so /listings/<id> still highlights Listings.
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  const cls = (href: string) => `navbar-link${isActive(href) ? ' active' : ''}`;

  const primaryLinks = (
    <>
      <li><Link href="/" className={cls('/')} onClick={close}>Home</Link></li>
      <li><Link href="/listings" className={cls('/listings')} onClick={close}>Listings</Link></li>
      <li><Link href="/modpacks" className={cls('/modpacks')} onClick={close}>Modpacks</Link></li>
      <li>
        <a
          href="https://discord.gg/E56QxrW9Jt"
          target="_blank"
          rel="noreferrer"
          className="navbar-link"
          onClick={close}
        >
          Discord
        </a>
      </li>
      {user?.role === 'ADMIN' && (
        <li><Link href="/admin" className={cls('/admin')} onClick={close}>Admin</Link></li>
      )}
    </>
  );

  const accountLinks = user ? (
    <>
      <li className="navbar-notif">
        <NotificationCentre feed={notifications} markRead={markNotificationsRead} />
      </li>
      <li>
        <Link
          href="/settings"
          className={`navbar-user${isActive('/settings') ? ' active' : ''}`}
          onClick={close}
        >
          {user.name}
        </Link>
      </li>
      <li>
        <form action={logout}>
          <button type="submit" className="navbar-link navbar-signout">Sign out</button>
        </form>
      </li>
    </>
  ) : (
    <>
      <li><Link href="/login" className={cls('/login')} onClick={close}>Sign in</Link></li>
      <li>
        <Link
          href="/register"
          className={`navbar-link navbar-cta${isActive('/register') ? ' active' : ''}`}
          onClick={close}
        >
          Join
        </Link>
      </li>
    </>
  );

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <Link href="/" className="navbar-logo" onClick={close}>
          <span>Better QOLHub</span>
        </Link>

        <ul className="navbar-menu navbar-primary">{primaryLinks}</ul>
        <ul className="navbar-menu navbar-account">{accountLinks}</ul>

        <button
          type="button"
          className="navbar-toggle"
          aria-expanded={open}
          aria-controls="navbar-mobile"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((v) => !v)}
        >
          {/* Drawn from spans rather than an icon font or SVG sprite, so it
              inherits colour and needs no extra request. */}
          <span className={`navbar-burger${open ? ' navbar-burger-open' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="navbar-mobile" id="navbar-mobile">
          <ul className="navbar-mobile-menu">{primaryLinks}</ul>
          <ul className="navbar-mobile-menu navbar-mobile-account">{accountLinks}</ul>
        </div>
      )}
    </nav>
  );
}
