import { z } from "zod";

export const PLAYER_ROLES = ["batter", "bowler", "all_rounder", "wicket_keeper"] as const;
export const RESPONSIBILITIES = ["treasurer", "kit_manager", "ground_booking", "scouting"] as const;
export const SEASON_ROLES = ["player", "vice_captain", "captain", "organiser"] as const;
export const BAT_PREFS = ["flexible", "top", "middle", "lower"] as const;
export const BOWL_PREFS = ["flexible", "powerplay", "middle", "death"] as const;

export type Responsibility = (typeof RESPONSIBILITIES)[number];
export type SeasonRole = (typeof SEASON_ROLES)[number];

export const LABELS: Record<string, string> = {
  batter: "Batter",
  bowler: "Bowler",
  all_rounder: "All-rounder",
  wicket_keeper: "Wicketkeeper",
  treasurer: "Treasurer",
  kit_manager: "Kit manager",
  ground_booking: "Ground booking",
  scouting: "Scouting",
  player: "Player",
  vice_captain: "Vice-captain",
  captain: "Captain",
  organiser: "Organiser",
  flexible: "Flexible",
  top: "Top order",
  middle: "Middle",
  lower: "Lower order",
  powerplay: "Powerplay",
  death: "Death overs",
  pending_payment: "Payment due",
  active: "Active",
  left: "Left the team",
  applied: "Waiting for approval",
  approved: "Approved",
  rejected: "Not approved",
  right: "Right",
  left_hand: "Left",
  spond: "Spond",
  cricheroes: "CricHeroes",
  app_account: "App account",
  sheet: "Club sheet",
  pdf: "PDF scorecard",
  manual: "Added by hand"
};

const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

export const unavailabilitySchema = z
  .object({ from: dateText, to: dateText, reason: z.string().trim().optional() })
  .refine((gap) => gap.to >= gap.from, { message: "The end date is before the start date" });

export const membershipFormSchema = z.object({
  display_name: z.string().trim().min(2, "Enter the name your teammates use"),
  full_name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().min(6, "Enter your phone number"),
  whatsapp: z.string().trim().optional(),
  primary_roles: z.array(z.enum(PLAYER_ROLES)).min(1, "Pick at least one role"),
  bat_hand: z.enum(["right", "left"]),
  bowl_hand: z.enum(["right", "left"]),
  bat_pref: z.enum(BAT_PREFS),
  bowl_pref: z.enum(BOWL_PREFS),
  match_pref: z.enum(["flexible", "friendlies", "tournaments"]),
  preferred_days: z.enum(["flexible", "saturday", "sunday"]),
  available_from: dateText.or(z.literal("")),
  unavailability: z.array(unavailabilitySchema),
  responsibilities_interest: z.array(z.enum(RESPONSIBILITIES)),
  spond_name: z.string().trim().min(1, "Enter your name as it appears in Spond"),
  cricheroes_name: z.string().trim().min(1, "Enter your CricHeroes name"),
  cricheroes_url: z.string().trim().optional(),
  previous_name: z.string().trim().optional(),
  payment_reference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  consent: z.literal(true, { error: "You must accept to join" })
});

export type MembershipForm = z.infer<typeof membershipFormSchema>;

export function emptyMembershipForm(): Omit<MembershipForm, "consent"> & { consent: boolean } {
  return {
    display_name: "",
    full_name: "",
    email: "",
    phone: "",
    whatsapp: "",
    primary_roles: [],
    bat_hand: "right",
    bowl_hand: "right",
    bat_pref: "flexible",
    bowl_pref: "flexible",
    match_pref: "flexible",
    preferred_days: "flexible",
    available_from: "",
    unavailability: [],
    responsibilities_interest: [],
    spond_name: "",
    cricheroes_name: "",
    cricheroes_url: "",
    previous_name: "",
    payment_reference: "",
    notes: "",
    consent: false
  };
}

function dayBefore(date: string) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Turns the form into the stored application. Bowling and keeping flags come
 * from the chosen roles, and a late "available from" date becomes an
 * unavailability period so no owed credit builds up before the player arrives.
 */
export function buildAnswers(form: MembershipForm, seasonStartsOn: string) {
  const unavailability = [...form.unavailability];
  if (form.available_from && form.available_from > seasonStartsOn) {
    unavailability.unshift({
      from: seasonStartsOn,
      to: dayBefore(form.available_from),
      reason: "Not available until this date"
    });
  }
  return {
    ...form,
    unavailability,
    is_wicketkeeper: form.primary_roles.includes("wicket_keeper"),
    bowls: form.primary_roles.includes("bowler") || form.primary_roles.includes("all_rounder")
  };
}

/** Reads the numeric player id from a full CricHeroes profile link. */
export function parseCricHeroesId(url: string | null | undefined): string | null {
  return url?.match(/player-profile\/(\d+)/)?.[1] ?? null;
}

export type IdentityInput = { source: "spond" | "cricheroes"; external_id: string | null; display_name: string };

/** The names an organiser confirms when approving an application. */
export function identitiesFromAnswers(answers: {
  spond_name?: string;
  cricheroes_name?: string;
  cricheroes_url?: string;
}): IdentityInput[] {
  const identities: IdentityInput[] = [];
  if (answers.spond_name?.trim()) {
    identities.push({ source: "spond", external_id: null, display_name: answers.spond_name.trim() });
  }
  if (answers.cricheroes_name?.trim()) {
    identities.push({
      source: "cricheroes",
      external_id: parseCricHeroesId(answers.cricheroes_url),
      display_name: answers.cricheroes_name.trim()
    });
  }
  return identities;
}

/** First problem per field, keyed by field name, for showing under inputs. */
export function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
}
