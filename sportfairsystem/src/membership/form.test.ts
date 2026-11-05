import { describe, expect, it } from "vitest";
import {
  buildAnswers,
  emptyMembershipForm,
  fieldErrors,
  identitiesFromAnswers,
  membershipFormSchema,
  parseCricHeroesId,
  type MembershipForm
} from "./form";

const valid: MembershipForm = {
  ...emptyMembershipForm(),
  display_name: "Pete",
  full_name: "Pete Example",
  email: "pete@example.test",
  phone: "+49 1234567",
  primary_roles: ["all_rounder"],
  spond_name: "Pete E",
  cricheroes_name: "Pete",
  consent: true
};

describe("membership form", () => {
  it("accepts a complete form", () => {
    expect(membershipFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires consent, a role, and the outside names", () => {
    const result = membershipFormSchema.safeParse({
      ...valid,
      consent: false,
      primary_roles: [],
      spond_name: " "
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = fieldErrors(result.error);
      expect(Object.keys(errors).sort()).toEqual(["consent", "primary_roles", "spond_name"]);
    }
  });

  it("rejects a leave period that ends before it starts", () => {
    const result = membershipFormSchema.safeParse({
      ...valid,
      unavailability: [{ from: "2027-07-10", to: "2027-07-01" }]
    });
    expect(result.success).toBe(false);
  });
});

describe("buildAnswers", () => {
  it("derives bowling and keeping from the roles", () => {
    expect(buildAnswers(valid, "2027-04-01")).toMatchObject({ bowls: true, is_wicketkeeper: false });
    const keeper = buildAnswers({ ...valid, primary_roles: ["batter", "wicket_keeper"] }, "2027-04-01");
    expect(keeper).toMatchObject({ bowls: false, is_wicketkeeper: true });
  });

  it("turns a late start into unavailability up to the day before", () => {
    const answers = buildAnswers({ ...valid, available_from: "2027-06-01" }, "2027-04-01");
    expect(answers.unavailability[0]).toMatchObject({ from: "2027-04-01", to: "2027-05-31" });
  });

  it("adds nothing when available from the start", () => {
    expect(buildAnswers({ ...valid, available_from: "2027-04-01" }, "2027-04-01").unavailability).toEqual([]);
  });
});

describe("identities", () => {
  it("reads the id from a full profile link only", () => {
    expect(parseCricHeroesId("https://cricheroes.in/player-profile/1134459/Anir")).toBe("1134459");
    expect(parseCricHeroesId("https://chshare.link/player/qPM792")).toBeNull();
    expect(parseCricHeroesId(undefined)).toBeNull();
  });

  it("builds the Spond and CricHeroes names to confirm", () => {
    expect(
      identitiesFromAnswers({
        spond_name: " Anir C ",
        cricheroes_name: "Anir",
        cricheroes_url: "https://cricheroes.com/player-profile/42/x"
      })
    ).toEqual([
      { source: "spond", external_id: null, display_name: "Anir C" },
      { source: "cricheroes", external_id: "42", display_name: "Anir" }
    ]);
  });
});
