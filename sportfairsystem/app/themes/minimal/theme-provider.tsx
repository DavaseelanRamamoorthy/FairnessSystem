"use client";

import type { ThemeProviderProps as MuiThemeProviderProps } from "@mui/material/styles";

import CssBaseline from "@mui/material/CssBaseline";
import GlobalStyles from "@mui/material/GlobalStyles";
import { ThemeProvider as ThemeVarsProvider } from "@mui/material/styles";

import { createTheme } from "./create-theme";
import { useSettings } from "@/app/context/SettingsContext";
import { getAppearancePreset, getAppearanceThemeOverrides } from "./appearance-presets";

import type {} from "./extend-theme-types";
import type { ThemeOptions } from "./types";

// ----------------------------------------------------------------------

export type ThemeProviderProps = Partial<MuiThemeProviderProps> & {
  themeOverrides?: ThemeOptions;
};

export function ThemeProvider({ themeOverrides, children, ...other }: ThemeProviderProps) {
  const { resolvedThemeMode, appearancePreset } = useSettings();
  const preset = getAppearancePreset(appearancePreset);
  const theme = createTheme({
    defaultColorScheme: resolvedThemeMode,
    themeOverrides: {
      ...getAppearanceThemeOverrides(appearancePreset),
      ...themeOverrides,
    },
  });

  return (
    <ThemeVarsProvider disableTransitionOnChange theme={theme} {...other}>
      <CssBaseline />
      <GlobalStyles
        styles={{
          ":root": {
            "--app-header-start": preset.header.start,
            "--app-header-mid": preset.header.mid,
            "--app-header-end": preset.header.end,
            "--app-accent-main": preset.palette.primary.main,
            "--app-accent-dark": preset.palette.primary.dark,
            "--app-accent-soft": preset.palette.primary.lighter,
            "--app-danger-main": preset.palette.error.main,
            "--app-danger-soft": preset.palette.error.lighter,
            "--app-warning-main": preset.palette.warning.main,
            "--app-warning-soft": preset.palette.warning.lighter,
          },
          "html[data-density='compact'] .MuiButton-root": {
            minHeight: 34,
            paddingTop: 6,
            paddingBottom: 6,
          },
          "html[data-density='compact'] .MuiIconButton-root": {
            padding: 6,
          },
          "html[data-density='compact'] .MuiToggleButton-root": {
            minHeight: 38,
          },
          "html[data-density='compact'] .MuiInputBase-root": {
            minHeight: 40,
          },
          "html[data-density='compact'] .MuiTableCell-root": {
            paddingTop: 10,
            paddingBottom: 10,
          },
          "html[data-density='compact'] .MuiAccordionSummary-root": {
            minHeight: "48px !important",
          },
          "html[data-density='compact'] .MuiAccordionSummary-content": {
            margin: "8px 0 !important",
          },
          "html[data-density='compact'] .MuiCardContent-root": {
            padding: 16,
          },
          "html[data-density='compact'] .MuiListItemButton-root": {
            minHeight: 40,
          },
          "html[data-density='compact'] .MuiChip-root": {
            height: 26,
          },
        }}
      />
      {children}
    </ThemeVarsProvider>
  );
}
