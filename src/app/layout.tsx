import type { Metadata, Viewport } from 'next';
import './globals.css';
import { currentUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from '@/lib/site';
import { getNotifications, EMPTY_FEED } from '@/lib/notifications';
import { logout, markNotificationsRead } from './(account)/actions';
import NavBar from './NavBar';
import LinkDiscordBanner from './LinkDiscordBanner';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Your Trusted Skyblock Hub`,
    // Pages set their own title; this keeps the brand on the end of it.
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: `${SITE_NAME} — Your Trusted Skyblock Hub`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: 'en',
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — Your Trusted Skyblock Hub`,
    description: SITE_DESCRIPTION,
  },
};

// Discord tints an embed's left stripe with theme-color, so this is the brand
// gold rather than the page background.
export const viewport: Viewport = {
  themeColor: '#ffaa00',
  colorScheme: 'dark',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();

  // Both only asked when there is a session, so signed-out visitors still cost
  // no query. Run together rather than in sequence — neither needs the other.
  const [account, notifications] = user
    ? await Promise.all([
        prisma.user.findUnique({
          where: { id: user.id },
          // The team count rides along on a query that already runs, so the
          // navbar can hide the Teams link from the people it means nothing to
          // without costing a second round trip.
          select: { discordId: true, _count: { select: { teams: true } } },
        }),
        getNotifications(user.id),
      ])
    : [null, EMPTY_FEED];

  const discordLinked = user ? Boolean(account?.discordId) : true;
  const inTeam = Boolean(account?._count.teams);

  return (
    <html lang="en">
      <body>
        <NavBar
          user={user ? { name: user.name, role: user.role, inTeam } : null}
          logout={logout}
          notifications={notifications}
          markNotificationsRead={markNotificationsRead}
        />
        {user && !discordLinked && <LinkDiscordBanner />}

        <main className="main-content">
          {children}
        </main>

        <footer className="footer">
          <div className="container">
            <p className="pixel-brand">Better QOLHub</p>
            <p>© 2026 Better QOLHub. Built for the Skyblock community.</p>
            <p style={{ opacity: 0.6, marginTop: '0.5rem' }}>An extension of the Discord — vetted, transparent, always improving.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
