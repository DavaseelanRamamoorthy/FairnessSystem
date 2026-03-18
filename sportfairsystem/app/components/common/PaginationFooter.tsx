"use client";

import { Button, Stack, Typography } from "@mui/material";
import { SxProps, Theme } from "@mui/material/styles";

type PaginationFooterProps = {
  pageStart: number;
  pageEnd: number;
  totalCount: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  sx?: SxProps<Theme>;
};

export default function PaginationFooter({
  pageStart,
  pageEnd,
  totalCount,
  hasPreviousPage,
  hasNextPage,
  onPrevious,
  onNext,
  sx
}: PaginationFooterProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={sx}
    >
      <Typography variant="body2" color="text.secondary">
        {pageStart}-{pageEnd} of {totalCount}
      </Typography>

      <Stack direction="row" spacing={1}>
        <Button size="small" variant="outlined" onClick={onPrevious} disabled={!hasPreviousPage}>
          Previous
        </Button>

        <Button size="small" variant="outlined" onClick={onNext} disabled={!hasNextPage}>
          Next
        </Button>
      </Stack>
    </Stack>
  );
}
