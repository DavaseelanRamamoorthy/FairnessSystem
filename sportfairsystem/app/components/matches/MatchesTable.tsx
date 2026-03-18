"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Box,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from "@mui/material";

import PaginationFooter from "@/app/components/common/PaginationFooter";
import { usePagination } from "@/app/hooks/usePagination";
import { formatDate } from "@/app/utils/formatDate";
import { sortSeasonLabelsDescending } from "@/app/utils/seasonSelection";
import { readStoredSeasonFilter, storeSeasonFilter } from "@/app/utils/seasonFilterStorage";

const MATCHES_SEASON_STORAGE_KEY = "sportfairsystem:season-filter:matches";

type MatchRow = {
  id: string;
  match_date: string | null;
  opponent_name: string | null;
  result: string | null;
  result_summary?: string | null;
  match_code?: string | null;
};

type GroupOption = "none" | "season" | "result";

interface Props<T extends MatchRow> {
  rows: T[];
  selectedMatchId?: string;
  onSelectMatch: (match: T) => void;
}

const resultOptions = ["All", "Won", "Lost", "Tie", "Draw", "Unknown"];
const groupOptions: { label: string; value: GroupOption }[] = [
  { label: "None", value: "none" },
  { label: "Result", value: "result" },
  { label: "Season", value: "season" }
];

function getSeasonLabel(matchDate: string | null) {
  if (!matchDate) return "Unknown";

  const [year] = matchDate.split("-");

  return year ? year : "Unknown";
}

function getGroupLabel(match: MatchRow, groupBy: GroupOption) {
  if (groupBy === "season") return getSeasonLabel(match.match_date);
  if (groupBy === "result") return getDisplayResult(match).label;
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
  onSelectMatch
}: Props<T>) {

  const [resultFilter, setResultFilter] = useState("All");
  const [seasonFilter, setSeasonFilter] = useState(
    () => readStoredSeasonFilter(MATCHES_SEASON_STORAGE_KEY) ?? ""
  );
  const [groupBy, setGroupBy] = useState<GroupOption>("none");
  const rowsPerPage = 10;

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

    const matchesResult =
      resultFilter === "All" || result === resultFilter;

    const matchesSeason =
      effectiveSeasonFilter === "All Seasons" || season === effectiveSeasonFilter;

    return matchesResult && matchesSeason;
  });

  const pagination = usePagination({
    items: filteredRows,
    pageSize: rowsPerPage,
    resetKeys: [resultFilter, effectiveSeasonFilter, groupBy]
  });
  const paginatedRows = pagination.paginatedItems;

  useEffect(() => {
    if (paginatedRows.length === 0) {
      return;
    }

    const selectedIsVisible = paginatedRows.some((row) => row.id === selectedMatchId);

    if (!selectedIsVisible) {
      onSelectMatch(paginatedRows[0]);
    }
  }, [onSelectMatch, paginatedRows, selectedMatchId]);

  return (
    <Paper
      variant="outlined"
      sx={{
        overflow: "hidden",
        borderRadius: 3,
        height: "100%",
        display: "flex",
        flexDirection: "column"
      }}
    >

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ p: 2 }}
      >

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
          <InputLabel id="match-group-by-label">Group By</InputLabel>
          <Select
            labelId="match-group-by-label"
            label="Group By"
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

      <Divider />

      <Box
        sx={{
          px: 2,
          py: 1.5,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0
        }}
      >

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1.1fr 1.4fr 0.8fr",
            gap: 1.5,
            px: 1.5,
            pb: 1
          }}
        >

          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Date
          </Typography>

          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Opponent
          </Typography>

          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Result
          </Typography>

        </Box>

        <Divider />

        <Stack spacing={0.25} sx={{ pt: 1, flex: 1, minHeight: 0 }}>

          {paginatedRows.length === 0 && (
            <Box sx={{ px: 1.5, py: 3 }}>
              <Typography color="text.secondary">
                No matches found for the selected filters.
              </Typography>
            </Box>
          )}

          {paginatedRows.map((match, index) => {
            const currentGroupLabel = getGroupLabel(match, groupBy);
            const previousGroupLabel =
              index > 0
                ? getGroupLabel(paginatedRows[index - 1], groupBy)
                : "";
            const showGroupHeader =
              groupBy !== "none" && currentGroupLabel !== previousGroupLabel;
            const isSelected = selectedMatchId === match.id;
            const displayResult = getDisplayResult(match);

            return (
              <Box key={match.id}>

                {showGroupHeader && (
                  <Box sx={{ px: 1.5, pt: index === 0 ? 0 : 1, pb: 0.25 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontWeight: 700,
                        letterSpacing: 0.8,
                        textTransform: "uppercase"
                      }}
                    >
                      {currentGroupLabel}
                    </Typography>
                  </Box>
                )}

                <Box
                  onClick={() => onSelectMatch(match)}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1.1fr 1.4fr 0.8fr",
                    gap: 1.5,
                    alignItems: "center",
                    px: 1.5,
                    py: 0.875,
                    borderRadius: 2,
                    cursor: "pointer",
                    bgcolor: isSelected ? "action.selected" : "transparent",
                    transition: "background-color .2s ease, transform .2s ease",
                    "&:hover": {
                      bgcolor: "action.hover"
                    }
                  }}
                >

                  <Typography variant="body2" color="text.secondary">
                    {match.match_date ? formatDate(match.match_date) : "-"}
                  </Typography>

                  <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis"
                      }}
                    >
                      {match.opponent_name || "Unknown Opponent"}
                    </Typography>

                    {match.match_code && (
                      <Typography variant="caption" color="text.secondary">
                        {match.match_code}
                      </Typography>
                    )}
                  </Stack>

                  <Box>
                    <Chip
                      label={displayResult.label}
                      color={displayResult.color}
                      size="small"
                    />
                  </Box>

                </Box>

              </Box>
            );
          })}

        </Stack>

      </Box>

      <Divider />

      <PaginationFooter
        pageStart={pagination.pageStart}
        pageEnd={pagination.pageEnd}
        totalCount={pagination.totalCount}
        hasPreviousPage={pagination.hasPreviousPage}
        hasNextPage={pagination.hasNextPage}
        onPrevious={pagination.goToPreviousPage}
        onNext={pagination.goToNextPage}
        sx={{
          minHeight: 48,
          px: 2,
          py: 0.5
        }}
      />

    </Paper>
  );

}
