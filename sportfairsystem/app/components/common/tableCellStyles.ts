import { SxProps, Theme } from "@mui/material/styles";

export const numericTableCellSx: SxProps<Theme> = {
  textAlign: "center",
  fontVariantNumeric: "tabular-nums"
};

export const numericTableHeadCellSx: SxProps<Theme> = {
  ...numericTableCellSx
};
