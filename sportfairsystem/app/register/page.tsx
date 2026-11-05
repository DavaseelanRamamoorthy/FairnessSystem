"use client";

import Add from "@mui/icons-material/Add";
import DeleteOutline from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import FormLabel from "@mui/material/FormLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitMembership } from "@/src/db/membership";
import {
  BAT_PREFS,
  BOWL_PREFS,
  buildAnswers,
  emptyMembershipForm,
  fieldErrors,
  LABELS,
  membershipFormSchema,
  PLAYER_ROLES,
  RESPONSIBILITIES
} from "@/src/membership/form";
import { ErrorNote, money, Page, Section, useAction } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

type FormState = ReturnType<typeof emptyMembershipForm>;

function CheckList<T extends string>({
  label,
  options,
  value,
  onChange,
  error,
  helper
}: {
  label: string;
  options: readonly T[];
  value: T[];
  onChange: (next: T[]) => void;
  error?: string;
  helper?: string;
}) {
  return (
    <FormControl error={Boolean(error)} component="fieldset">
      <FormLabel component="legend">{label}</FormLabel>
      <FormGroup row>
        {options.map((option) => (
          <FormControlLabel
            key={option}
            label={LABELS[option]}
            control={
              <Checkbox
                checked={value.includes(option)}
                onChange={(event) =>
                  onChange(event.target.checked ? [...value, option] : value.filter((item) => item !== option))
                }
              />
            }
          />
        ))}
      </FormGroup>
      {(error || helper) && <FormHelperText>{error ?? helper}</FormHelperText>}
    </FormControl>
  );
}

export default function RegisterPage() {
  const session = useSession();
  const router = useRouter();
  const { season, member, application, user } = session;
  const [form, setForm] = useState<FormState>(() => {
    const previous = application?.answers as Partial<FormState> | undefined;
    return {
      ...emptyMembershipForm(),
      email: user?.email ?? "",
      display_name: member?.display_name ?? "",
      primary_roles: (member?.primary_roles ?? []) as FormState["primary_roles"],
      bat_hand: member?.bat_hand ?? "right",
      bowl_hand: member?.bowl_hand ?? "right",
      bat_pref: member?.bat_pref ?? "flexible",
      bowl_pref: member?.bowl_pref ?? "flexible",
      ...previous,
      consent: false
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { busy, error, run } = useAction();

  if (!season?.registration_open) {
    return (
      <Page title="Join the team">
        <Alert severity="info">Registration isn&apos;t open right now. Ask your organiser when it opens.</Alert>
      </Page>
    );
  }
  if (session.seasonMember && session.seasonMember.season_id === season.id && session.seasonMember.status !== "left") {
    return (
      <Page title="Join the team">
        <Alert severity="success">You&apos;re already in the squad for {season.year}.</Alert>
      </Page>
    );
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const text = (key: keyof FormState) => ({
    value: form[key] as string,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => set(key, event.target.value as never),
    error: Boolean(errors[key]),
    helperText: errors[key]
  });
  const select = (key: keyof FormState, label: string, options: readonly string[], labels?: Record<string, string>) => (
    <TextField select fullWidth label={label} {...text(key)}>
      {options.map((option) => (
        <MenuItem key={option} value={option}>
          {labels?.[option] ?? LABELS[option]}
        </MenuItem>
      ))}
    </TextField>
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = membershipFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    const kind = member ? "renewal" : "new";
    const ok = await run(() => submitMembership(season.id, kind, buildAnswers(parsed.data, season.starts_on), member?.id ?? null));
    if (ok) {
      session.refresh();
      router.replace("/");
    }
  };

  return (
    <Page
      title={`Join ${session.team?.name ?? "the team"} for ${season.year}`}
      subtitle={season.membership_fee > 0 ? `Annual membership is ${money(season.membership_fee)}.` : undefined}
    >
      <Stack component="form" spacing={3} onSubmit={submit} noValidate>
        <Section title="About you">
          <TextField label="Name your teammates use" required {...text("display_name")} />
          <TextField label="Full name" required {...text("full_name")} />
          <TextField label="Email" type="email" required {...text("email")} />
          <TextField label="Mobile number" type="tel" required {...text("phone")} />
          <TextField label="WhatsApp number, if different" type="tel" {...text("whatsapp")} />
        </Section>

        <Section title="Your cricket">
          <CheckList
            label="I am a"
            options={PLAYER_ROLES}
            value={form.primary_roles}
            onChange={(next) => set("primary_roles", next)}
            error={errors.primary_roles}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {select("bat_hand", "Batting hand", ["right", "left"], { right: "Right", left: "Left" })}
            {select("bowl_hand", "Bowling hand", ["right", "left"], { right: "Right", left: "Left" })}
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {select("bat_pref", "Where I like to bat", BAT_PREFS)}
            {select("bowl_pref", "When I like to bowl", BOWL_PREFS)}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            The planner keeps you in the batting band you choose, so choosing &quot;Lower order&quot; means you
            won&apos;t be moved up the order.
          </Typography>
        </Section>

        <Section title="Availability">
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            {select("match_pref", "Matches I prefer", ["flexible", "friendlies", "tournaments"], {
              flexible: "Flexible",
              friendlies: "Friendlies",
              tournaments: "Tournaments"
            })}
            {select("preferred_days", "Preferred days", ["flexible", "saturday", "sunday"], {
              flexible: "Flexible",
              saturday: "Saturday",
              sunday: "Sunday"
            })}
          </Stack>
          <TextField
            label="Available from"
            type="date"
            slotProps={{ inputLabel: { shrink: true } }}
            {...text("available_from")}
            helperText={errors.available_from ?? "Leave empty if you're available from the start of the season."}
          />
          <Stack spacing={1}>
            <Typography variant="subtitle2">Known long absences</Typography>
            {form.unavailability.map((gap, index) => (
              <Stack key={index} direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ alignItems: { sm: "center" } }}>
                <TextField
                  label="From"
                  type="date"
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={gap.from}
                  onChange={(event) =>
                    set("unavailability", form.unavailability.map((g, i) => (i === index ? { ...g, from: event.target.value } : g)))
                  }
                />
                <TextField
                  label="To"
                  type="date"
                  size="small"
                  slotProps={{ inputLabel: { shrink: true } }}
                  value={gap.to}
                  onChange={(event) =>
                    set("unavailability", form.unavailability.map((g, i) => (i === index ? { ...g, to: event.target.value } : g)))
                  }
                />
                <IconButton
                  aria-label="Remove this absence"
                  onClick={() => set("unavailability", form.unavailability.filter((_, i) => i !== index))}
                >
                  <DeleteOutline />
                </IconButton>
              </Stack>
            ))}
            {errors.unavailability && <FormHelperText error>{errors.unavailability}</FormHelperText>}
            <Button
              startIcon={<Add />}
              sx={{ alignSelf: "flex-start" }}
              onClick={() => set("unavailability", [...form.unavailability, { from: "", to: "" }])}
            >
              Add an absence
            </Button>
          </Stack>
        </Section>

        <Section title="Your other profiles">
          <Typography variant="body2" color="text.secondary">
            We use these to match you on team lists and scorecards, so enter them exactly as they appear there.
          </Typography>
          <TextField label="Name in Spond" required {...text("spond_name")} />
          <TextField label="Name in CricHeroes" required {...text("cricheroes_name")} />
          <TextField label="CricHeroes profile link" {...text("cricheroes_url")} />
          {!member && (
            <TextField
              label="Played for us before under another name?"
              {...text("previous_name")}
              helperText="So we can keep your match history."
            />
          )}
        </Section>

        <Section title="Helping the club">
          <CheckList
            label="I could help with"
            options={RESPONSIBILITIES}
            value={form.responsibilities_interest}
            onChange={(next) => set("responsibilities_interest", next)}
            helper="Optional. The organiser will talk to you first."
          />
          <TextField label="Anything else we should know?" multiline minRows={2} {...text("notes")} />
        </Section>

        {season.membership_fee > 0 && (
          <Section title="Payment">
            <TextField
              label="Payment reference"
              {...text("payment_reference")}
              helperText="If you've already paid, enter the PayPal or bank reference, or the word Cash. You can also add it later."
            />
          </Section>
        )}

        <Section>
          <FormControl error={Boolean(errors.consent)}>
            <FormControlLabel
              label="I agree to the club rules, and to the club storing these details to run the team. My contact details are only shared with the captains and the organiser."
              control={<Checkbox checked={form.consent} onChange={(event) => set("consent", event.target.checked)} />}
            />
            {errors.consent && <FormHelperText>{errors.consent}</FormHelperText>}
          </FormControl>
          {Object.keys(errors).length > 0 && <Alert severity="error">Please fix the highlighted fields.</Alert>}
          <ErrorNote message={error} />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            Send application
          </Button>
        </Section>
      </Stack>
    </Page>
  );
}
