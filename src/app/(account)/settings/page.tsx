import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { isBotConfigured } from '@/lib/discord-bot';
import { usernameAvailableAt } from '@/lib/account';
import DiscordLinkPanel from './DiscordLinkPanel';
import UsernamePanel from './UsernamePanel';
import PasswordPanel from './PasswordPanel';
import DangerZone from './DangerZone';

export const revalidate = 0;

export default async function SettingsPage() {
  const user = await currentUser();
  if (!user) redirect('/login?callbackUrl=/settings');

  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      username: true,
      discordUsername: true,
      discordLinkedAt: true,
      usernameChangedAt: true,
    },
  });

  const lockedUntil = usernameAvailableAt(record?.usernameChangedAt ?? null);

  return (
    <div className="container narrow-page">
      <div style={{ marginBottom: '2.5rem' }}>
        <h1 className="pixel page-title">Settings</h1>
        <p className="page-sub">Signed in as {user.name}.</p>
      </div>

      <section className="admin-section">
        <h2 className="admin-section-title">Username</h2>
        <UsernamePanel
          currentUsername={record?.username ?? user.name ?? ''}
          lockedUntil={lockedUntil ? lockedUntil.toISOString() : null}
        />
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Discord</h2>
        <p className="admin-section-sub">
          Link your Discord account so the community can tell who wrote a review.
        </p>

        <DiscordLinkPanel
          linkedUsername={record?.discordUsername ?? null}
          linkedAt={record?.discordLinkedAt ? record.discordLinkedAt.toISOString() : null}
          botConfigured={isBotConfigured()}
        />
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title">Password</h2>
        <p className="admin-section-sub">Change the password you sign in with.</p>
        <PasswordPanel />
      </section>

      <section className="admin-section">
        <h2 className="admin-section-title danger-title">Danger zone</h2>
        <DangerZone username={user.name ?? ''} />
      </section>
    </div>
  );
}
