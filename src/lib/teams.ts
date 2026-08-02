// Development teams.
//
// A team is who is allowed to speak for a listing. It replaced a single
// `Listing.ownerId`: a studio is rarely one person, and the one person it was
// could not hand anything over without an admin.
//
// Two roles rather than per-member permission flags. Every check stays a single
// comparison and the UI stays a dropdown, and a third role can be added later
// without deciding retroactively what an existing flag set meant.
//
// Kept free of Prisma imports so client components can use the labels — the
// database-facing helpers live in src/lib/team-access.ts.

export const TEAM_ROLES = [
  {
    key: 'LEAD',
    label: 'Lead',
    blurb: 'Can manage members and everything a developer can do.',
  },
  {
    key: 'MEMBER',
    label: 'Developer',
    blurb: 'Can post announcements and propose listing changes.',
  },
] as const;

export type TeamRoleKey = (typeof TEAM_ROLES)[number]['key'];

export function isTeamRole(value: unknown): value is TeamRoleKey {
  return typeof value === 'string' && TEAM_ROLES.some((r) => r.key === value);
}

export function teamRoleLabel(role: string): string {
  return TEAM_ROLES.find((r) => r.key === role)?.label ?? role;
}

export const MAX_TEAM_NAME_LENGTH = 60;

export function teamNameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'A team needs a name.';
  if (trimmed.length > MAX_TEAM_NAME_LENGTH) {
    return `Team names are limited to ${MAX_TEAM_NAME_LENGTH} characters.`;
  }
  return null;
}
