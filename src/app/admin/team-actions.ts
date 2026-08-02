'use server';

import { revalidatePath } from 'next/cache';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin, requireUser } from '@/lib/authz';
import { requireTeamLead, teamAccessFor } from '@/lib/team-access';
import { isTeamRole, teamNameProblem, type TeamRoleKey } from '@/lib/teams';

export type TeamState = { ok?: boolean; message?: string } | undefined;

function revalidateTeams(): void {
  revalidatePath('/admin', 'layout');
  revalidatePath('/teams', 'layout');
  // Team membership decides who may post on a listing and who may not review it.
  revalidatePath('/listings', 'layout');
}

export async function createTeam(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, message: 'Admin access required.' };

  const name = String(formData.get('name') ?? '').trim();
  const problem = teamNameProblem(name);
  if (problem) return { ok: false, message: problem };

  const leadUsername = String(formData.get('leadUsername') ?? '').trim();
  let leadId: string | null = null;

  if (leadUsername) {
    const lead = await prisma.user.findUnique({
      where: { username: leadUsername },
      select: { id: true, discordId: true },
    });
    if (!lead) return { ok: false, message: `No member called “${leadUsername}”.` };
    // The same bar reviews already clear. Announcements go out under this
    // account's name, so it has to be one that was verified over Discord.
    if (!lead.discordId) {
      return { ok: false, message: `“${leadUsername}” has not linked a Discord account yet.` };
    }
    leadId = lead.id;
  }

  await prisma.team.create({
    data: {
      name,
      members: leadId ? { create: { userId: leadId, role: 'LEAD' } } : undefined,
    },
  });

  revalidateTeams();
  return { ok: true, message: leadId ? `Created ${name} with ${leadUsername} as lead.` : `Created ${name}.` };
}

export async function renameTeam(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const teamId = String(formData.get('teamId') ?? '').trim();
  if (!teamId) return { ok: false, message: 'Missing team.' };

  // A lead may rename their own team; an admin may rename any.
  const user = await requireTeamLead(teamId).catch(() => null);
  if (!user) return { ok: false, message: 'Only a team lead or an admin can rename a team.' };

  const name = String(formData.get('name') ?? '').trim();
  const problem = teamNameProblem(name);
  if (problem) return { ok: false, message: problem };

  await prisma.team.update({ where: { id: teamId }, data: { name } });
  revalidateTeams();
  return { ok: true, message: 'Renamed.' };
}

export async function deleteTeam(teamId: string): Promise<void> {
  await requireAdmin();
  // Listings survive: the relation is SetNull, so deleting a team unclaims its
  // listings rather than taking them down with it.
  await prisma.team.delete({ where: { id: teamId } });
  revalidateTeams();
}

export type MemberState = { ok?: boolean; message?: string } | undefined;

export async function addTeamMember(_prev: MemberState, formData: FormData): Promise<MemberState> {
  const teamId = String(formData.get('teamId') ?? '').trim();
  if (!teamId) return { ok: false, message: 'Missing team.' };

  const actor = await requireTeamLead(teamId).catch(() => null);
  if (!actor) return { ok: false, message: 'Only a team lead or an admin can add members.' };

  const username = String(formData.get('username') ?? '').trim();
  const role = String(formData.get('role') ?? 'MEMBER');
  if (!username) return { ok: false, message: 'Enter a username.' };
  if (!isTeamRole(role)) return { ok: false, message: 'Pick a valid role.' };

  const user = await prisma.user.findUnique({
    where: { username },
    select: { id: true, discordId: true },
  });
  if (!user) return { ok: false, message: `No member called “${username}”.` };
  if (!user.discordId) {
    return { ok: false, message: `“${username}” has not linked a Discord account yet.` };
  }

  try {
    await prisma.teamMember.create({
      data: { teamId, userId: user.id, role: role as TeamRoleKey },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return { ok: false, message: `${username} is already on this team.` };
    }
    throw error;
  }

  revalidateTeams();
  return { ok: true, message: `Added ${username}.` };
}

export async function setTeamMemberRole(
  teamId: string,
  userId: string,
  role: string
): Promise<TeamState> {
  const actor = await requireTeamLead(teamId).catch(() => null);
  if (!actor) return { ok: false, message: 'Only a team lead or an admin can change roles.' };
  if (!isTeamRole(role)) return { ok: false, message: 'Pick a valid role.' };

  // Demoting the last lead would leave a team nobody can manage — its members
  // could still post, but no one could add or remove anyone without an admin.
  if (role !== 'LEAD') {
    const leads = await prisma.teamMember.count({ where: { teamId, role: 'LEAD' } });
    const target = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId } },
      select: { role: true },
    });
    if (target?.role === 'LEAD' && leads <= 1) {
      return { ok: false, message: 'A team needs at least one lead. Promote someone else first.' };
    }
  }

  await prisma.teamMember.update({
    where: { teamId_userId: { teamId, userId } },
    data: { role: role as TeamRoleKey },
  });

  revalidateTeams();
  return { ok: true };
}

export async function removeTeamMember(teamId: string, userId: string): Promise<TeamState> {
  const actor = await requireTeamLead(teamId).catch(() => null);
  if (!actor) return { ok: false, message: 'Only a team lead or an admin can remove members.' };

  const target = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    select: { role: true },
  });
  if (!target) return { ok: true };

  if (target.role === 'LEAD') {
    const leads = await prisma.teamMember.count({ where: { teamId, role: 'LEAD' } });
    if (leads <= 1) {
      return { ok: false, message: 'A team needs at least one lead. Promote someone else first.' };
    }
  }

  await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  revalidateTeams();
  return { ok: true };
}

/** Leaving is always allowed — except for the last lead, who would strand the team. */
export async function leaveTeam(teamId: string): Promise<TeamState> {
  const user = await requireUser();
  const access = await teamAccessFor(user, teamId);
  if (!access.isMember) return { ok: true };

  return removeTeamMemberAsSelf(teamId, user.id, access.isLead);
}

async function removeTeamMemberAsSelf(
  teamId: string,
  userId: string,
  isLead: boolean
): Promise<TeamState> {
  if (isLead) {
    const leads = await prisma.teamMember.count({ where: { teamId, role: 'LEAD' } });
    if (leads <= 1) {
      return {
        ok: false,
        message: 'You are the last lead. Promote someone else before leaving.',
      };
    }
  }
  await prisma.teamMember.deleteMany({ where: { teamId, userId } });
  revalidateTeams();
  return { ok: true, message: 'You left the team.' };
}

export type SetTeamState = { ok?: boolean; message?: string } | undefined;

/** Assigns a listing to a team, or unclaims it. Admin only. */
export async function setListingTeam(
  _prev: SetTeamState,
  formData: FormData
): Promise<SetTeamState> {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) return { ok: false, message: 'Admin access required.' };

  const listingId = String(formData.get('listingId') ?? '').trim();
  const teamId = String(formData.get('teamId') ?? '').trim();
  if (!listingId) return { ok: false, message: 'Missing listing.' };

  if (!teamId) {
    await prisma.listing.update({ where: { id: listingId }, data: { teamId: null } });
    revalidateTeams();
    revalidatePath(`/listings/${listingId}`);
    return { ok: true, message: 'Listing unclaimed.' };
  }

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: { name: true },
  });
  if (!team) return { ok: false, message: 'That team no longer exists.' };

  await prisma.listing.update({ where: { id: listingId }, data: { teamId } });

  revalidateTeams();
  revalidatePath(`/listings/${listingId}`);
  return { ok: true, message: `Assigned to ${team.name}.` };
}
