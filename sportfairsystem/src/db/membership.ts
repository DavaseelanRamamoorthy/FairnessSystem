"use client";

import type { IdentitySource } from "@/src/import/nameMatching";
import type { IdentityInput, Responsibility, SeasonRole } from "@/src/membership/form";
import { fetchAll, supabase } from "./client";

export type Team = { id: string; name: string; currency: string };

export type Season = {
  id: string;
  team_id: string;
  year: number;
  starts_on: string;
  ends_on: string;
  membership_fee: number;
  registration_open: boolean;
  is_current: boolean;
  rules: Record<string, unknown>;
};

export type Member = {
  id: string;
  team_id: string;
  user_id: string | null;
  display_name: string;
  primary_roles: string[];
  is_wicketkeeper: boolean;
  bowls: boolean;
  bat_hand: "right" | "left" | null;
  bowl_hand: "right" | "left" | null;
  bat_pref: "top" | "middle" | "lower" | "flexible";
  bowl_pref: "powerplay" | "middle" | "death" | "flexible";
  merged_into: string | null;
};

export type SeasonMember = {
  id: string;
  season_id: string;
  member_id: string;
  role: SeasonRole;
  responsibilities: Responsibility[];
  status: "pending_payment" | "active" | "left";
  joined_on: string;
  left_on: string | null;
};

export type Application = {
  id: string;
  season_id: string;
  user_id: string;
  existing_member_id: string | null;
  kind: "new" | "renewal";
  answers: Record<string, unknown> & {
    display_name?: string;
    full_name?: string;
    email?: string;
    phone?: string;
    spond_name?: string;
    cricheroes_name?: string;
    cricheroes_url?: string;
    previous_name?: string;
    payment_reference?: string;
    notes?: string;
    primary_roles?: string[];
    responsibilities_interest?: string[];
    unavailability?: Array<{ from: string; to: string; reason?: string }>;
  };
  status: "applied" | "approved" | "rejected" | "withdrawn";
  decision_note: string | null;
  created_at: string;
};

export type Identity = {
  id: string;
  team_id: string;
  member_id: string;
  source: IdentitySource;
  external_id: string | null;
  display_name: string;
  name_key: string;
};

export type Due = {
  season_id: string;
  member_id: string;
  charge_id: string;
  kind: string;
  description: string;
  amount: number;
  currency: string;
  due_on: string | null;
  paid: number;
  outstanding: number;
  payer_reference: string | null;
};

export type Unavailability = { id: string; member_id: string; from_date: string; to_date: string; reason: string | null };
export type MemberContact = { member_id: string; email: string | null; phone: string | null; whatsapp: string | null };

// `select *` is not allowed on members: claim_token is deliberately hidden.
const MEMBER_COLUMNS =
  "id, team_id, user_id, display_name, primary_roles, is_wicketkeeper, bowls, bat_hand, bowl_hand, bat_pref, bowl_pref, merged_into";

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(name, args);
  if (error) throw new Error(error.message);
  return data as T;
}

function must<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

// ---------------------------------------------------------------- session

export async function loadTeam() {
  return must(await supabase().from("teams").select("id, name, currency").limit(1).maybeSingle()) as Team | null;
}

export async function loadCurrentSeason(teamId: string) {
  return must(
    await supabase().from("seasons").select("*").eq("team_id", teamId).eq("is_current", true).maybeSingle()
  ) as Season | null;
}

export async function loadMyMember(userId: string) {
  return must(
    await supabase().from("members").select(MEMBER_COLUMNS).eq("user_id", userId).maybeSingle()
  ) as Member | null;
}

export async function loadMySeasonRows(memberId: string) {
  return must(
    await supabase().from("season_members").select("*").eq("member_id", memberId).order("created_at", { ascending: false })
  ) as SeasonMember[];
}

export async function loadMyApplication(seasonId: string, userId: string) {
  return must(
    await supabase().from("membership_applications").select("*").eq("season_id", seasonId).eq("user_id", userId).maybeSingle()
  ) as Application | null;
}

export function bootstrapTeam(args: {
  teamName: string;
  year: number;
  startsOn: string;
  endsOn: string;
  fee: number;
  displayName: string;
}) {
  return rpc<string>("bootstrap_team", {
    p_team_name: args.teamName,
    p_year: args.year,
    p_starts_on: args.startsOn,
    p_ends_on: args.endsOn,
    p_membership_fee: args.fee,
    p_display_name: args.displayName
  });
}

// ---------------------------------------------------------------- applications

export function submitMembership(seasonId: string, kind: "new" | "renewal", answers: unknown, existingMemberId: string | null) {
  return rpc<string>("submit_membership", {
    p_season: seasonId,
    p_kind: kind,
    p_answers: answers,
    p_existing_member: existingMemberId
  });
}

export async function loadApplications(seasonId: string) {
  return must(
    await supabase()
      .from("membership_applications")
      .select("*")
      .eq("season_id", seasonId)
      .eq("status", "applied")
      .order("created_at")
  ) as Application[];
}

export function approveMembership(applicationId: string, memberId: string | null, identities: IdentityInput[]) {
  return rpc<string>("approve_membership", {
    p_application: applicationId,
    p_member: memberId,
    p_identities: identities
  });
}

export function rejectMembership(applicationId: string, note: string) {
  return rpc<void>("reject_membership", { p_application: applicationId, p_note: note });
}

export function claimMember(token: string) {
  return rpc<string>("claim_member", { p_token: token });
}

// ---------------------------------------------------------------- members

export function loadMembers(teamId: string) {
  return fetchAll<Member>((from, to) =>
    supabase()
      .from("members")
      .select(MEMBER_COLUMNS)
      .eq("team_id", teamId)
      .is("merged_into", null)
      .order("display_name")
      .range(from, to)
      .overrideTypes<Member[], { merge: false }>()
  );
}

export async function loadMember(memberId: string) {
  return must(await supabase().from("members").select(MEMBER_COLUMNS).eq("id", memberId).maybeSingle()) as Member | null;
}

export function loadSeasonMembers(seasonId: string) {
  return fetchAll<SeasonMember>((from, to) =>
    supabase()
      .from("season_members")
      .select("*")
      .eq("season_id", seasonId)
      .range(from, to)
      .overrideTypes<SeasonMember[], { merge: false }>()
  );
}

export function loadIdentities(teamId: string) {
  return fetchAll<Identity>((from, to) =>
    supabase()
      .from("member_identities")
      .select("*")
      .eq("team_id", teamId)
      .range(from, to)
      .overrideTypes<Identity[], { merge: false }>()
  );
}

export function addMember(teamId: string, displayName: string, identities: IdentityInput[]) {
  return rpc<string>("add_member", { p_team: teamId, p_display_name: displayName, p_identities: identities });
}

export function addToSeason(memberId: string) {
  return rpc<string>("add_to_season", { p_member: memberId });
}

export function setMemberRole(seasonMemberId: string, role: SeasonRole, responsibilities: Responsibility[]) {
  return rpc<void>("set_member_role", {
    p_season_member: seasonMemberId,
    p_role: role,
    p_responsibilities: responsibilities
  });
}

export function leaveTeam(memberId: string) {
  return rpc<void>("leave_team", { p_member: memberId });
}

export function linkIdentity(memberId: string, source: IdentitySource, externalId: string | null, displayName: string) {
  return rpc<void>("link_identity", {
    p_member: memberId,
    p_source: source,
    p_external_id: externalId,
    p_display_name: displayName
  });
}

export function unlinkIdentity(identityId: string) {
  return rpc<void>("unlink_identity", { p_identity: identityId });
}

export function mergeMembers(keepId: string, dropId: string) {
  return rpc<void>("merge_members", { p_keep: keepId, p_drop: dropId });
}

export function memberClaimToken(memberId: string) {
  return rpc<string>("member_claim_token", { p_member: memberId });
}

// ---------------------------------------------------------------- profile

export function updateMyProfile(teamId: string, profile: Record<string, unknown>) {
  return rpc<void>("update_my_profile", { p_team: teamId, p_profile: profile });
}

export async function loadContact(memberId: string) {
  return must(
    await supabase().from("member_private").select("member_id, email, phone, whatsapp").eq("member_id", memberId).maybeSingle()
  ) as MemberContact | null;
}

export async function loadUnavailability(memberId: string) {
  return must(
    await supabase().from("unavailability").select("*").eq("member_id", memberId).order("from_date")
  ) as Unavailability[];
}

export async function addUnavailability(memberId: string, fromDate: string, toDate: string, reason: string) {
  must(
    await supabase()
      .from("unavailability")
      .insert({ member_id: memberId, from_date: fromDate, to_date: toDate, reason: reason || null })
  );
}

export async function removeUnavailability(id: string) {
  must(await supabase().from("unavailability").delete().eq("id", id));
}

// ---------------------------------------------------------------- season

export async function updateSeason(seasonId: string, patch: Partial<Pick<Season, "registration_open" | "membership_fee" | "starts_on" | "ends_on">>) {
  must(await supabase().from("seasons").update(patch).eq("id", seasonId));
}

export function createSeason(teamId: string, year: number, startsOn: string, endsOn: string, fee: number, rules: unknown) {
  return rpc<string>("create_season", {
    p_team: teamId,
    p_year: year,
    p_starts_on: startsOn,
    p_ends_on: endsOn,
    p_membership_fee: fee,
    p_rules: rules
  });
}

// ---------------------------------------------------------------- dues

export function loadDues(seasonId: string) {
  return fetchAll<Due>((from, to) =>
    supabase()
      .from("v_member_dues")
      .select("*")
      .eq("season_id", seasonId)
      .range(from, to)
      .overrideTypes<Due[], { merge: false }>()
  );
}

export async function loadMyDues(seasonId: string, memberId: string) {
  return must(
    await supabase().from("v_member_dues").select("*").eq("season_id", seasonId).eq("member_id", memberId)
  ) as Due[];
}

export function submitPaymentReference(chargeId: string, reference: string) {
  return rpc<void>("submit_payment_reference", { p_charge: chargeId, p_reference: reference });
}

export function recordPayment(args: {
  chargeId: string;
  amount: number;
  currency: string;
  amountEur: number;
  method: string;
  reference: string;
  paidOn: string;
  receivedBy: string | null;
}) {
  return rpc<string>("record_payment", {
    p_charge: args.chargeId,
    p_amount: args.amount,
    p_currency: args.currency,
    p_amount_eur: args.amountEur,
    p_method: args.method,
    p_reference: args.reference,
    p_paid_on: args.paidOn,
    p_received_by: args.receivedBy
  });
}
