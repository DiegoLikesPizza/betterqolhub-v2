'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Navigation between the admin pages.
 *
 * Reads like tabs, behaves like links: each one is a real route, so the browser
 * back button, refreshing and bookmarking all work, and each page loads only its
 * own data. `usePathname` is the only reason this is a client component.
 */
const TABS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/traffic', label: 'Traffic' },
  { href: '/admin/listings', label: 'Listings' },
  { href: '/admin/modpacks', label: 'Modpacks' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/reviews', label: 'Reviews' },
] as const;

export default function AdminTabs() {
  const pathname = usePathname();

  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {TABS.map((tab) => {
        // Overview owns exactly /admin; the others own their subtree, so a
        // deeper page would still light up its own tab.
        const active =
          tab.href === '/admin' ? pathname === '/admin' : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`admin-tab ${active ? 'admin-tab-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
