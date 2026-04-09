"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";
import { alpha, keyframes } from "@mui/material/styles";

import PaginationFooter from "@/app/components/common/PaginationFooter";
import { usePagination } from "@/app/hooks/usePagination";
import { formatDate } from "@/app/utils/formatDate";
import { sortSeasonLabelsDescending } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const MATCHES_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:matches";
const slideInFromRight = keyframes`
  from {
    opacity: 0;
    transform: translateX(24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

const slideInFromLeft = keyframes`
  from {
    opacity: 0;
    transform: translateX(-24px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
`;

type MatchRow = {
  id: string;
  match_date: string | null;
  opponent_name: string | null;
  result: string | null;
  result_summary?: string | null;
  match_code?: string | null;
};

type GroupOption = "none" | "month" | "week";

interface Props<T extends MatchRow> {
  rows: T[];
  selectedMatchId?: string;
  onSelectMatch: (match: T) => void;
  embedded?: boolean;
}

const resultOptions = ["All", "Won", "Lost", "Tie", "Draw", "Unknown"];
const groupOptions: { label: string; value: GroupOption }[] = [
  { label: "Weeks", value: "week" },
  { label: "Months", value: "month" },
  { label: "None", value: "none" },
];

function parseMatchDate(matchDate: string | null) {
  if (!matchDate) {
    return null;
  }

  const [year, month, day] = matchDate.split("-").map((value) => Number.parseInt(value, 10));

  if (!year || !month || !day) {
    return null;
  }

  return new Date(year, month - 1, day);
}

function getOrdinalLabel(value: number) {
  if (value % 100 >= 11 && value % 100 <= 13) {
    return `${value}th`;
  }

  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

function formatMonthLabel(matchDate: string | null) {
  const parsedDate = parseMatchDate(matchDate);

  if (!parsedDate) {
    return "Unknown Month";
  }

  return parsedDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });
}

function formatWeekLabel(matchDate: string | null) {
  const parsedDate = parseMatchDate(matchDate);

  if (!parsedDate) {
    return "Unknown Week";
  }

  const weekOfMonth = Math.floor((parsedDate.getDate() - 1) / 7) + 1;
  const monthLabel = parsedDate.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric"
  });

  return `${getOrdinalLabel(weekOfMonth)} week of ${monthLabel}`;
}

function getSeasonLabel(matchDate: string | null) {
  if (!matchDate) return "Unknown";

  const [year] = matchDate.split("-");

  return year ? year : "Unknown";
}

function getGroupLabel(matchDate: string | null, groupBy: GroupOption) {
  if (groupBy === "month") {
    return formatMonthLabel(matchDate);
  }

  if (groupBy === "week") {
    return formatWeekLabel(matchDate);
  }

  return "";
}

function getResultChipColor(result: string | null) {
  if (result === "Won") return "success" as const;
  if (result === "Lost") return "error" as const;
  if (result === "Tie") return "info" as const;
  if (result === "Draw") return "warning" as const;
  return "default" as const;
}

function getDisplayResult(match: MatchRow) {
  const rawResult = typeof match.result === "string" ? match.result.trim() : "";
  const normalizedResult = rawResult.toLowerCase();
  const summary = typeof match.result_summary === "string"
    ? match.result_summary.trim().toLowerCase()
    : "";

  if (normalizedResult === "won") {
    return { label: "Won", color: "success" as const };
  }

  if (normalizedResult === "lost") {
    return { label: "Lost", color: "error" as const };
  }

  if (normalizedResult === "tie" || summary.includes("tie")) {
    return { label: "Tie", color: "info" as const };
  }

  if (normalizedResult === "draw" || summary.includes("draw")) {
    return { label: "Draw", color: "warning" as const };
  }

  if (rawResult) {
    return { label: rawResult, color: getResultChipColor(rawResult) };
  }

  return { label: "Unknown", color: "default" as const };
}

export default function MatchesTable<T extends MatchRow>({
  rows,
  selectedMatchId,
  onSelectMatch,
  embedded = false
}: Props<T>) {
  const [resultFilter, setResultFilter] = useState("All");
  const [seasonFilter, setSeasonFilter] = useState(
    () => readStoredSeasonFilter(MATCHES_SEASON_STORAGE_KEY) ?? ""
  );
  const [groupBy, setGroupBy] = useState<GroupOption>("week");
  const [transitionDirection, setTransitionDirection] = useState<"next" | "previous">("next");
  const rowsPerPage = 3;

  const availableSeasonLabels = useMemo(
    () =>
      sortSeasonLabelsDescending(
        Array.from(new Set(rows.map((row) => getSeasonLabel(row.match_date))))
      ),
    [rows]
  );

  const seasonOptions = ["All Seasons", ...availableSeasonLabels];
  const effectiveSeasonFilter = seasonFilter === "All Seasons" || availableSeasonLabels.includes(seasonFilter)
    ? seasonFilter
    : availableSeasonLabels[0] || "All Seasons";

  useEffect(() => {
    if (seasonFilter) {
      storeSeasonFilter(MATCHES_SEASON_STORAGE_KEY, seasonFilter);
    }
  }, [seasonFilter]);

  const filteredRows = rows.filter((row) => {
    const result = getDisplayResult(row).label;
    const season = getSeasonLabel(row.match_date);

    const matchesResult = resultFilter === "All" || result === resultFilter;
    const matchesSeason = effectiveSeasonFilter === "All Seasons" || season === effectiveSeasonFilter;

    return matchesResult && matchesSeason;
  });

  const pagination = usePagination({
    items: filteredRows,
    pageSize: rowsPerPage,
    resetKeys: [resultFilter, effectiveSeasonFilter, groupBy]
  });
  const paginatedRows = pagination.paginatedItems;
  const visibleGroupLabels = useMemo(() => {
    if (groupBy === "none") {
      return [];
    }

    return Array.from(
      new Set(
        paginatedRows
          .map((match) => getGroupLabel(match.match_date, groupBy))
          .filter(Boolean)
      )
    );
  }, [groupBy, paginatedRows]);

  useEffect(() => {
    if (paginatedRows.length === 0) {
      return;
    }

    const selectedIsVisible = paginatedRows.some((row) => row.id === selectedMatchId);

    if (!selectedIsVisible) {
      onSelectMatch(paginatedRows[0]);
    }
  }, [onSelectMatch, paginatedRows, selectedMatchId]);

  const content = (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "minmax(180px, 0.7fr) minmax(0, 3.3fr)" },
        borderRadius: embedded ? 0 : 2.5,
        overflow: "hidden",
        border: embedded ? "none" : "1px solid",
        borderColor: "divider"
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderRight: { xs: "none", md: "1px solid" },
          borderBottom: { xs: "1px solid", md: "none" },
          borderColor: "divider",
          backgroundColor: (theme) => theme.palette.action.hover
        }}
      >
        <Stack spacing={1.25}>
          <Typography variant="overline" sx={{ letterSpacing: 1, fontWeight: 800, color: "text.secondary" }}>
            Filters
          </Typography>

          <FormControl size="small" fullWidth>
            <InputLabel id="match-result-filter-label">Result</InputLabel>
            <Select
              labelId="match-result-filter-label"
              label="Result"
              value={resultFilter}
              onChange={(event) => {
                setResultFilter(event.target.value);
              }}
            >
              {resultOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="match-season-filter-label">Season</InputLabel>
            <Select
              labelId="match-season-filter-label"
              label="Season"
              value={effectiveSeasonFilter}
              onChange={(event) => {
                setSeasonFilter(event.target.value);
              }}
            >
              {seasonOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" fullWidth>
            <InputLabel id="match-group-by-label">Group</InputLabel>
            <Select
              labelId="match-group-by-label"
              label="Group"
              value={groupBy}
              onChange={(event) => {
                setGroupBy(event.target.value as GroupOption);
              }}
            >
              {groupOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 1.5,
          py: 1.25,
          display: "flex",
          flexDirection: "column",
          gap: 0.6
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          flexWrap="wrap"
          alignItems="center"
          sx={{ px: 0.5, pb: 0.35 }}
        >
          <Typography variant="overline" sx={{ letterSpacing: 1, fontWeight: 800, color: "text.secondary" }}>
            Match List
          </Typography>

          {visibleGroupLabels.map((label) => (
            <Typography
              key={label}
              variant="overline"
              sx={{
                letterSpacing: 0.8,
                fontWeight: 800,
                color: "text.primary"
              }}
            >
              {label}
            </Typography>
          ))}
        </Stack>

        <Box sx={{ display: "flex", flexDirection: "column" }}>
          <Box
            key={`${pagination.currentPage}-${transitionDirection}`}
            sx={{
              pt: 0.35,
              pb: 0.75,
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(3, minmax(0, 1fr))"
              },
              gap: 1.35,
              alignContent: "start",
              animation: `${transitionDirection === "next" ? slideInFromRight : slideInFromLeft} 240ms cubic-bezier(0.22, 1, 0.36, 1)`
            }}
          >
            {paginatedRows.length === 0 && (
              <Box
                sx={{
                  px: 1.5,
                  py: 3,
                  gridColumn: "1 / -1"
                }}
              >
                <Typography color="text.secondary">
                  No matches found for the selected filters.
                </Typography>
              </Box>
            )}

            {paginatedRows.map((match) => {
              const isSelected = selectedMatchId === match.id;
              const displayResult = getDisplayResult(match);

              return (
                <Box key={match.id} sx={{ display: "contents" }}>
                  <Box
                    onClick={() => onSelectMatch(match)}
                    sx={{
                      minHeight: { xs: 88, md: 104 },
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      alignItems: "stretch",
                      gap: 1,
                      px: 1.35,
                      py: 1.15,
                      borderRadius: 3,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: isSelected ? "primary.main" : "divider",
                      bgcolor: (theme) => isSelected
                        ? alpha(theme.palette.primary.main, 0.14)
                        : alpha(theme.palette.common.white, 0.025),
                      boxShadow: isSelected
                        ? (theme) => `0 10px 24px ${alpha(theme.palette.primary.main, 0.14)}`
                        : "none",
                      transition: "background-color .24s ease, border-color .24s ease, transform .24s ease, box-shadow .24s ease",
                      "&:hover": {
                        bgcolor: (theme) => alpha(theme.palette.common.white, 0.045),
                        transform: "translateY(-2px)"
                      }
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 0.75
                      }}
                    >
                      <Stack spacing={0.4} sx={{ minWidth: 0, flex: 1 }}>
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 700,
                            color: "text.secondary",
                            whiteSpace: "nowrap",
                            letterSpacing: 0.3
                          }}
                        >
                          {match.match_date ? formatDate(match.match_date) : "-"}
                        </Typography>

                        <Typography
                          variant="body2"
                          sx={{
                            fontWeight: 800,
                            lineHeight: 1.2,
                            fontSize: "0.98rem",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis"
                          }}
                        >
                          {match.opponent_name || "Unknown Opponent"}
                        </Typography>
                      </Stack>

                      <Chip
                        label={displayResult.label}
                        color={displayResult.color}
                        size="small"
                        sx={{
                          flexShrink: 0,
                          fontWeight: 800,
                          height: 28
                        }}
                      />
                    </Box>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        opacity: 0.9,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: 600
                      }}
                    >
                      {match.match_code || "-"}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ pt: 0.25 }}>
            <PaginationFooter
              pageStart={pagination.pageStart}
              pageEnd={pagination.pageEnd}
              totalCount={pagination.totalCount}
              hasPreviousPage={pagination.hasPreviousPage}
              hasNextPage={pagination.hasNextPage}
              onPrevious={() => {
                setTransitionDirection("previous");
                pagination.goToPreviousPage();
              }}
              onNext={() => {
                setTransitionDirection("next");
                pagination.goToNextPage();
              }}
              sx={{
                minHeight: 40,
                px: 0,
                py: 0.65,
                mt: 0.2
              }}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );

  if (embedded) {
    return content;
  }

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 3,
        display: "flex",
        flexDirection: "column",
        p: { xs: 1.25, md: 1.5 }
      }}
    >
      {content}
    </Paper>
  );
}
