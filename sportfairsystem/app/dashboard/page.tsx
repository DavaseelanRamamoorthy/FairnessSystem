"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import NextLink from "next/link";
import EmojiEventsOutlined from "@mui/icons-material/EmojiEventsOutlined";
import SportsBaseballOutlined from "@mui/icons-material/SportsBaseballOutlined";
import SportsCricketOutlined from "@mui/icons-material/SportsCricketOutlined";
import TrendingUpOutlined from "@mui/icons-material/TrendingUpOutlined";
import { useCallback, useMemo, useState } from "react";
import { bannerSelectSx, StatTile, TileGrid } from "@/src/ui/brand";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { loadDashboard } from "@/src/db/dashboard";
import { headToHead, leaders, seasonResults, top, totals, type Leader } from "@/src/fairness/dashboard";
import { formatMatchDate, oversText } from "@/src/ui/fixtureLabels";
import { ErrorNote, Loading, NoAccess, Page, Section, useLoad } from "@/src/ui/kit";
import { useSession } from "@/src/ui/session";

// Categorical slots 1-3 of the validated reference palette (light / dark steps).
const SERIES = {
  light: { won: "#2a78d6", lost: "#eb6834", tied: "#1baf7a" },
  dark: { won: "#3987e5", lost: "#d95926", tied: "#199e70" }
};

function LeaderTable({ title, rows, value, valueLabel, extra, showMatches = true }: {
  title: string;
  rows: Leader[];
  value: (l: Leader) => string | number | null;
  valueLabel: string;
  extra?: { label: string; get: (l: Leader) => string | number | null };
  showMatches?: boolean;
}) {
  return (
    <Section title={title}>
      {rows.length === 0 ? (
        <Typography color="text.secondary">Not enough matches yet.</Typography>
      ) : (
        <TableContainer>
          <Table size="small" aria-label={title}>
            <TableHead>
              <TableRow>
                <TableCell>Player</TableCell>
                <TableCell align="right">{valueLabel}</TableCell>
                {extra && <TableCell align="right">{extra.label}</TableCell>}
                {showMatches && <TableCell align="right">Matches</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((l, i) => (
                <TableRow key={l.memberId}>
                  <TableCell>
                    <Typography component="span" color="text.secondary" sx={{ mr: 1, fontVariantNumeric: "tabular-nums" }}>
                      {i + 1}
                    </Typography>
                    <Box component={NextLink} href={`/players/${l.memberId}`} sx={{ color: "inherit" }}>
                      {l.name}
                    </Box>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                    {value(l) ?? "–"}
                  </TableCell>
                  {extra && (
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {extra.get(l) ?? "–"}
                    </TableCell>
                  )}
                  {showMatches && (
                    <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {l.matches}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Section>
  );
}

export default function DashboardPage() {
  const { team, seasonMember } = useSession();
  const theme = useTheme();
  const colors = SERIES[theme.palette.mode];
  const teamId = team?.id ?? "";
  const load = useCallback(() => loadDashboard(teamId), [teamId]);
  const { data, error, loading } = useLoad(load);
  const [year, setYear] = useState<"all" | number>("all");

  const view = useMemo(() => {
    if (!data) return null;
    const inYear = <T extends { season_year: number }>(rows: T[]) => (year === "all" ? rows : rows.filter((r) => r.season_year === year));
    const fixtures = inYear(data.fixtures);
    const perSeason = seasonResults(fixtures);
    const players = leaders(inYear(data.stats), data.names);
    const minInnings = year === "all" ? 10 : 5;
    const minBalls = year === "all" ? 120 : 60;
    return {
      perSeason,
      total: totals(perSeason),
      players: players.filter((p) => p.matches > 0).length,
      runs: top(players, "runs", 10),
      wickets: top(players, "wickets", 10),
      average: top(players, "average", 5, { min: (l) => l.innings >= minInnings }),
      strikeRate: top(players, "strikeRate", 5, { min: (l) => l.innings >= minInnings }),
      economy: top(players, "economy", 5, { min: (l) => l.ballsBowled >= minBalls, ascending: true }),
      appearances: top(players, "matches", 5),
      h2h: headToHead(fixtures).slice(0, 12),
      recent: fixtures.filter((f) => f.status === "played").slice(-8).reverse(),
      minInnings,
      minOvers: minBalls / 6
    };
  }, [data, year]);

  if (!team || !seasonMember || seasonMember.status === "left") return <NoAccess />;
  if (loading) return <Loading />;
  if (error || !data || !view) return <ErrorNote message={error ?? "Couldn't load the dashboard."} />;

  const t = view.total;
  const label = year === "all" ? `${data.years[0]}–${data.years[data.years.length - 1]}` : String(year);

  return (
    <Page
      title="Team Dashboard"
      subtitle={`${label} · from imported CricHeroes scorecards. Covers matches whose scorecard has been imported.`}
      actions={
        <TextField
          select
          size="small"
          id="dashboard-season"
          label="Season"
          value={year}
          onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}
          sx={bannerSelectSx}
        >
          <MenuItem value="all">All seasons</MenuItem>
          {[...data.years].reverse().map((y) => (
            <MenuItem key={y} value={y}>
              {y}
            </MenuItem>
          ))}
        </TextField>
      }
    >
      <TileGrid>
        <StatTile color="navy" icon={<SportsCricketOutlined />} label="Matches played" value={t.played} caption={t.abandoned ? `+${t.abandoned} abandoned` : "Imported scorecards"} />
        <StatTile color="green" icon={<TrendingUpOutlined />} label="Win ratio" value={t.winRate !== null ? `${t.winRate}%` : "–"} caption={`${t.won} won · ${t.lost} lost · ${t.tied} tied`} />
        <StatTile color="orange" icon={<EmojiEventsOutlined />} label="Top run scorer" value={view.runs[0]?.name ?? "–"} caption={view.runs[0] ? `${view.runs[0].runs.toLocaleString("en-GB")} runs` : undefined} />
        <StatTile color="red" icon={<SportsBaseballOutlined />} label="Top wicket taker" value={view.wickets[0]?.name ?? "–"} caption={view.wickets[0] ? `${view.wickets[0].wickets} wickets` : undefined} />
      </TileGrid>
      <Typography variant="body2" color="text.secondary">
        {view.players} players used.
      </Typography>

      {year === "all" && (
        <Section title="Results by season">
          <Box sx={{ width: "100%", height: 260 }} role="img" aria-label="Won, lost and tied matches per season">
            <ResponsiveContainer>
              <BarChart data={view.perSeason} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
                <CartesianGrid vertical={false} stroke={theme.palette.divider} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: theme.palette.action.hover }}
                  contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
                  labelStyle={{ color: theme.palette.text.primary, fontWeight: 700 }}
                  itemStyle={{ color: theme.palette.text.primary }}
                />
                <Legend wrapperStyle={{ color: theme.palette.text.secondary, fontSize: 13 }} />
                <Bar dataKey="won" isAnimationActive={false} name="Won" stackId="r" fill={colors.won} stroke={theme.palette.background.paper} strokeWidth={2} />
                <Bar dataKey="lost" isAnimationActive={false} name="Lost" stackId="r" fill={colors.lost} stroke={theme.palette.background.paper} strokeWidth={2} />
                <Bar dataKey="tied" isAnimationActive={false} name="Tied" stackId="r" fill={colors.tied} stroke={theme.palette.background.paper} strokeWidth={2} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Box>
          <TableContainer>
            <Table size="small" aria-label="Results by season">
              <TableHead>
                <TableRow>
                  <TableCell>Season</TableCell>
                  <TableCell align="right">Played</TableCell>
                  <TableCell align="right">Won</TableCell>
                  <TableCell align="right">Lost</TableCell>
                  <TableCell align="right">Tied</TableCell>
                  <TableCell align="right">Win rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {view.perSeason.map((r) => (
                  <TableRow key={r.year} hover sx={{ cursor: "pointer" }} onClick={() => setYear(r.year)}>
                    <TableCell>{r.year}</TableCell>
                    <TableCell align="right">{r.played}</TableCell>
                    <TableCell align="right">{r.won}</TableCell>
                    <TableCell align="right">{r.lost}</TableCell>
                    <TableCell align="right">{r.tied}</TableCell>
                    <TableCell align="right">{r.played ? `${Math.round((r.won / r.played) * 100)}%` : "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
      )}

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, "& > *": { minWidth: 0 } }}>
        <LeaderTable title="Most runs" rows={view.runs} value={(l) => l.runs} valueLabel="Runs" extra={{ label: "Best", get: (l) => l.highScore }} />
        <LeaderTable title="Most wickets" rows={view.wickets} value={(l) => l.wickets} valueLabel="Wkts" extra={{ label: "Overs", get: (l) => oversText(l.ballsBowled) }} />
        <LeaderTable title={`Best batting average (${view.minInnings}+ innings)`} rows={view.average} value={(l) => l.average} valueLabel="Avg" extra={{ label: "Runs", get: (l) => l.runs }} />
        <LeaderTable title={`Best strike rate (${view.minInnings}+ innings)`} rows={view.strikeRate} value={(l) => l.strikeRate} valueLabel="SR" extra={{ label: "Runs", get: (l) => l.runs }} />
        <LeaderTable title={`Best economy (${view.minOvers}+ overs)`} rows={view.economy} value={(l) => l.economy?.toFixed(2) ?? null} valueLabel="Econ" extra={{ label: "Wkts", get: (l) => l.wickets }} />
        <LeaderTable title="Most matches" rows={view.appearances} value={(l) => l.matches} valueLabel="Matches" showMatches={false} />
      </Box>

      <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, "& > *": { minWidth: 0 } }}>
        <Section title="Against each opponent">
          <TableContainer>
            <Table size="small" aria-label="Results against each opponent">
              <TableHead>
                <TableRow>
                  <TableCell>Opponent</TableCell>
                  <TableCell align="right">P</TableCell>
                  <TableCell align="right">W</TableCell>
                  <TableCell align="right">L</TableCell>
                  <TableCell align="right">T</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {view.h2h.map((h) => (
                  <TableRow key={h.opponent}>
                    <TableCell>{h.opponent}</TableCell>
                    <TableCell align="right">{h.played}</TableCell>
                    <TableCell align="right">{h.won}</TableCell>
                    <TableCell align="right">{h.lost}</TableCell>
                    <TableCell align="right">{h.tied || ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Section>
        <Section title="Latest results">
          <Stack spacing={1.5}>
            {view.recent.map((f) => (
              <Stack key={f.id} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
                <Chip
                  size="small"
                  label={f.result === "won" ? "Won" : f.result === "lost" ? "Lost" : f.result === "tied" ? "Tied" : "–"}
                  sx={{ minWidth: 52, fontWeight: 700 }}
                  variant={f.result === "won" || f.result === "lost" ? "filled" : "outlined"}
                  color={f.result === "won" ? "success" : f.result === "lost" ? "error" : "default"}
                />
                <Box sx={{ minWidth: 0 }}>
                  <Box component={NextLink} href={`/fixtures/${f.id}`} sx={{ color: "inherit", fontWeight: 600 }}>
                    vs {f.opponent}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {formatMatchDate(f.match_date)} · {f.result_summary ?? ""}
                  </Typography>
                </Box>
              </Stack>
            ))}
          </Stack>
        </Section>
      </Box>
    </Page>
  );
}
