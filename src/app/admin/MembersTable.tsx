'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';
import { setUserRole } from './actions';
import Pager, { pageSlice, pageCount } from './Pager';
import SetDiscordDialog from './SetDiscordDialog';
import RowMenu from './RowMenu';

type Member = {
  id: string;
  username: string;
  role: string;
  reviewCount: number;
  createdAt: string;
  discordUsername: string | null;
  discordLinkedAt: string | null;
  discordLinkedByAdmin: boolean;
};

type SortKey = 'newest' | 'oldest' | 'name' | 'reviews';

export default function MembersTable({
  members,
  viewerId,
}: {
  members: Member[];
  viewerId: string;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('ALL');
  const [sort, setSort] = useState<SortKey>('newest');
  const [page, setPage] = useState(1);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = members.filter((m) => {
      if (filter === 'ADMIN' && m.role !== 'ADMIN') return false;
      if (filter === 'LINKED' && !m.discordUsername) return false;
      if (filter === 'UNLINKED' && m.discordUsername) return false;
      if (!q) return true;
      return (
        m.username.toLowerCase().includes(q) ||
        (m.discordUsername ?? '').toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'name':
          return a.username.localeCompare(b.username);
        case 'reviews':
          return b.reviewCount - a.reviewCount;
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [members, query, filter, sort]);

  const currentPage = Math.min(page, pageCount(visible.length));
  const rows = pageSlice(visible, currentPage);

  function update<T>(setter: (v: T) => void) {
    return (value: T) => {
      setter(value);
      setPage(1);
    };
  }

  const linked = members.filter((m) => m.discordUsername).length;

  return (
    <div>
      <div className="table-toolbar">
        <input
          type="search"
          className="form-input toolbar-search"
          placeholder="Search username or Discord…"
          value={query}
          onChange={(e) => update(setQuery)(e.target.value)}
          aria-label="Search members"
        />

        <select
          className="form-input toolbar-select"
          value={filter}
          onChange={(e) => update(setFilter)(e.target.value)}
          aria-label="Filter members"
        >
          <option value="ALL">All members</option>
          <option value="ADMIN">Admins only</option>
          <option value="LINKED">Discord linked</option>
          <option value="UNLINKED">Not linked</option>
        </select>

        <select
          className="form-input toolbar-select"
          value={sort}
          onChange={(e) => update(setSort as (v: string) => void)(e.target.value)}
          aria-label="Sort members"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A–Z</option>
          <option value="reviews">Most reviews</option>
        </select>

        <span className="toolbar-stat">
          {linked}/{members.length} linked
        </span>
      </div>

      {visible.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)' }}>No members match those filters.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Discord</th>
                  <th>Role</th>
                  <th>Reviews</th>
                  <th>Joined</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((member) => (
                  <MemberRow key={member.id} member={member} isSelf={member.id === viewerId} />
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={currentPage} total={visible.length} onPage={setPage} noun="member" />
        </>
      )}
    </div>
  );
}

function MemberRow({ member, isSelf }: { member: Member; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Held by the row rather than the dialog, so closing the menu cannot unmount
  // an open modal.
  const [discordToken, setDiscordToken] = useState<number | null>(null);
  const openDiscord = useCallback(() => setDiscordToken((n) => (n ?? 0) + 1), []);
  const closeDiscord = useCallback(() => setDiscordToken(null), []);
  const isAdmin = member.role === 'ADMIN';

  return (
    <tr>
      <td>
        {member.username}
        {isSelf && <span className="table-muted"> (you)</span>}
        {error && <div className="table-error">{error}</div>}
      </td>
      <td>
        {member.discordUsername ? (
          <span
            className="discord-linked"
            title={
              member.discordLinkedAt
                ? `${member.discordLinkedByAdmin ? 'Set by an admin, not verified' : 'Verified'} ${new Date(member.discordLinkedAt).toLocaleDateString()}`
                : undefined
            }
          >
            {member.discordLinkedByAdmin ? '~' : '✓'} {member.discordUsername}
          </span>
        ) : (
          // Not an error state — just a member who cannot post reviews yet.
          <span className="discord-unlinked">Not linked</span>
        )}
      </td>
      <td>
        <span className={`role-pill ${isAdmin ? 'role-admin' : ''}`}>{member.role}</span>
      </td>
      <td>{member.reviewCount}</td>
      <td className="table-muted">{new Date(member.createdAt).toLocaleDateString()}</td>
      <td className="col-actions">
        <RowMenu
          label={`Actions for ${member.username}`}
          items={[
            {
              label: member.discordUsername ? 'Edit Discord link' : 'Link Discord',
              onSelect: openDiscord,
            },
            {
              // Self-demotion is blocked server-side too; disabling it here just
              // avoids offering an action that will always fail.
              label: isAdmin ? 'Revoke admin' : 'Make admin',
              disabled: pending || (isSelf && isAdmin),
              onSelect: () => {
                setError(null);
                startTransition(async () => {
                  try {
                    await setUserRole(member.id, !isAdmin);
                  } catch {
                    setError('Could not change role.');
                  }
                });
              },
            },
          ]}
        />

        {/* Outside the menu on purpose — see RowMenu. */}
        <SetDiscordDialog
          userId={member.id}
          username={member.username}
          discordUsername={member.discordUsername}
          linkedByAdmin={member.discordLinkedByAdmin}
          openToken={discordToken}
          onClose={closeDiscord}
        />
      </td>
    </tr>
  );
}
