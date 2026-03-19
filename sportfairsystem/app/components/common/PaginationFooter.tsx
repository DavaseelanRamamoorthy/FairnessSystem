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
      direction={{ xs: "column", sm: "row" }}
      alignItems={{ xs: "stretch", sm: "center" }}
      justifyContent="space-between"
      spacing={2}
      sx={sx}
    >
      <Typography variant="body2" color="text.secondary" textAlign={{ xs: "center", sm: "left" }}>
        {pageStart}-{pageEnd} of {totalCount}
      </Typography>

      <Stack
        direction="row"
        spacing={1}
        justifyContent={{ xs: "space-between", sm: "flex-start" }}
        sx={{ width: { xs: "100%", sm: "auto" } }}
      >
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
