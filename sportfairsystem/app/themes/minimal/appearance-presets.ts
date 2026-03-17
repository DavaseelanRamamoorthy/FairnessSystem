"use client";

import type { ThemeOptions } from "./types";

export type AppearancePresetKey = "jersey" | "emerald" | "sunset" | "slate" | "volt-noir";

type PaletteRamp = {
  lighter: string;
  light: string;
  main: string;
  dark: string;
  darker: string;
  contrastText: string;
};

type AppearancePreset = {
  key: AppearancePresetKey;
  label: string;
  swatch: [string, string];
  header: {
    start: string;
    mid: string;
    end: string;
  };
  palette: {
    primary: PaletteRamp;
    secondary: PaletteRamp;
    info: PaletteRamp;
    success: PaletteRamp;
    warning: PaletteRamp;
    error: PaletteRamp;
  };
};

const appearancePresets: Record<AppearancePresetKey, AppearancePreset> = {
  jersey: {
    key: "jersey",
    label: "Jersey",
    swatch: ["#061230", "#E53935"],
    header: {
      start: "#061230",
      mid: "#0A1A49",
      end: "#102969"
    },
    palette: {
      primary: {
        lighter: "#D0ECFE",
        light: "#73BAFB",
        main: "#1877F2",
        dark: "#0C44AE",
        darker: "#042174",
        contrastText: "#FFFFFF"
      },
      secondary: {
        lighter: "#EFD6FF",
        light: "#C684FF",
        main: "#8E33FF",
        dark: "#5119B7",
        darker: "#27097A",
        contrastText: "#FFFFFF"
      },
      info: {
        lighter: "#CAFDF5",
        light: "#61F3F3",
        main: "#00B8D9",
        dark: "#006C9C",
        darker: "#003768",
        contrastText: "#FFFFFF"
      },
      success: {
        lighter: "#D3FCD2",
        light: "#77ED8B",
        main: "#22C55E",
        dark: "#118D57",
        darker: "#065E49",
        contrastText: "#FFFFFF"
      },
      warning: {
        lighter: "#FFF5CC",
        light: "#FFD666",
        main: "#FFAB00",
        dark: "#B76E00",
        darker: "#7A4100",
        contrastText: "#1C252E"
      },
      error: {
        lighter: "#FFE9D5",
        light: "#FFAC82",
        main: "#E53935",
        dark: "#B71D18",
        darker: "#7A0916",
        contrastText: "#FFFFFF"
      }
    }
  },
  emerald: {
    key: "emerald",
    label: "Emerald",
    swatch: ["#052E2B", "#22C55E"],
    header: {
      start: "#052E2B",
      mid: "#065F46",
      end: "#0F766E"
    },
    palette: {
      primary: {
        lighter: "#D0FAE5",
        light: "#6EE7B7",
        main: "#10B981",
        dark: "#047857",
        darker: "#064E3B",
        contrastText: "#FFFFFF"
      },
      secondary: {
        lighter: "#FEF3C7",
        light: "#FCD34D",
        main: "#F59E0B",
        dark: "#B45309",
        darker: "#78350F",
        contrastText: "#FFFFFF"
      },
      info: {
        lighter: "#CFFAFE",
        light: "#67E8F9",
        main: "#06B6D4",
        dark: "#0E7490",
        darker: "#164E63",
        contrastText: "#FFFFFF"
      },
      success: {
        lighter: "#DCFCE7",
        light: "#86EFAC",
        main: "#22C55E",
        dark: "#15803D",
        darker: "#14532D",
        contrastText: "#FFFFFF"
      },
      warning: {
        lighter: "#FEF3C7",
        light: "#FCD34D",
        main: "#F59E0B",
        dark: "#B45309",
        darker: "#78350F",
        contrastText: "#FFFFFF"
      },
      error: {
        lighter: "#FEE2E2",
        light: "#FCA5A5",
        main: "#EF4444",
        dark: "#B91C1C",
        darker: "#7F1D1D",
        contrastText: "#FFFFFF"
      }
    }
  },
  sunset: {
    key: "sunset",
    label: "Sunset",
    swatch: ["#4C1D3D", "#F97316"],
    header: {
      start: "#4C1D3D",
      mid: "#7C2D12",
      end: "#EA580C"
    },
    palette: {
      primary: {
        lighter: "#FCE7F3",
        light: "#F9A8D4",
        main: "#EC4899",
        dark: "#BE185D",
        darker: "#831843",
        contrastText: "#FFFFFF"
      },
      secondary: {
        lighter: "#FFEDD5",
        light: "#FDBA74",
        main: "#F97316",
        dark: "#C2410C",
        darker: "#7C2D12",
        contrastText: "#FFFFFF"
      },
      info: {
        lighter: "#E0F2FE",
        light: "#7DD3FC",
        main: "#0EA5E9",
        dark: "#0369A1",
        darker: "#0C4A6E",
        contrastText: "#FFFFFF"
      },
      success: {
        lighter: "#DCFCE7",
        light: "#86EFAC",
        main: "#22C55E",
        dark: "#15803D",
        darker: "#14532D",
        contrastText: "#FFFFFF"
      },
      warning: {
        lighter: "#FEF3C7",
        light: "#FCD34D",
        main: "#F59E0B",
        dark: "#B45309",
        darker: "#78350F",
        contrastText: "#FFFFFF"
      },
      error: {
        lighter: "#FEE2E2",
        light: "#FDA4AF",
        main: "#FB7185",
        dark: "#E11D48",
        darker: "#881337",
        contrastText: "#FFFFFF"
      }
    }
  },
  slate: {
    key: "slate",
    label: "Slate",
    swatch: ["#0F172A", "#475569"],
    header: {
      start: "#0F172A",
      mid: "#1E293B",
      end: "#334155"
    },
    palette: {
      primary: {
        lighter: "#E2E8F0",
        light: "#94A3B8",
        main: "#475569",
        dark: "#334155",
        darker: "#1E293B",
        contrastText: "#FFFFFF"
      },
      secondary: {
        lighter: "#E0E7FF",
        light: "#A5B4FC",
        main: "#6366F1",
        dark: "#4338CA",
        darker: "#312E81",
        contrastText: "#FFFFFF"
      },
      info: {
        lighter: "#DBEAFE",
        light: "#93C5FD",
        main: "#3B82F6",
        dark: "#1D4ED8",
        darker: "#1E3A8A",
        contrastText: "#FFFFFF"
      },
      success: {
        lighter: "#DCFCE7",
        light: "#86EFAC",
        main: "#22C55E",
        dark: "#15803D",
        darker: "#14532D",
        contrastText: "#FFFFFF"
      },
      warning: {
        lighter: "#FEF3C7",
        light: "#FCD34D",
        main: "#F59E0B",
        dark: "#B45309",
        darker: "#78350F",
        contrastText: "#FFFFFF"
      },
      error: {
        lighter: "#FEE2E2",
        light: "#FCA5A5",
        main: "#EF4444",
        dark: "#B91C1C",
        darker: "#7F1D1D",
        contrastText: "#FFFFFF"
      }
    }
  },
  "volt-noir": {
    key: "volt-noir",
    label: "Volt Noir",
    swatch: ["#0B0D14", "#F4A62A"],
    header: {
      start: "#0B0D14",
      mid: "#151922",
      end: "#2F3745"
    },
    palette: {
      primary: {
        lighter: "#FFEBC7",
        light: "#F8C96D",
        main: "#F4A62A",
        dark: "#C87C00",
        darker: "#7A4900",
        contrastText: "#FFFFFF"
      },
      secondary: {
        lighter: "#DDE3EF",
        light: "#A9B2C6",
        main: "#667085",
        dark: "#475467",
        darker: "#27303F",
        contrastText: "#FFFFFF"
      },
      info: {
        lighter: "#D9E8FF",
        light: "#8FB7F1",
        main: "#5C8DFF",
        dark: "#3457B5",
        darker: "#1B2D66",
        contrastText: "#FFFFFF"
      },
      success: {
        lighter: "#DBF6E3",
        light: "#8BE0A2",
        main: "#32B768",
        dark: "#1E7B47",
        darker: "#104929",
        contrastText: "#FFFFFF"
      },
      warning: {
        lighter: "#FFF1CF",
        light: "#F8D277",
        main: "#F4B63A",
        dark: "#BE840F",
        darker: "#7A5708",
        contrastText: "#1C252E"
      },
      error: {
        lighter: "#FFE3D6",
        light: "#FFB18E",
        main: "#F97316",
        dark: "#C2410C",
        darker: "#7C2D12",
        contrastText: "#FFFFFF"
      }
    }
  }
};

export const appearancePresetList = Object.values(appearancePresets);

export function getAppearancePreset(key: AppearancePresetKey) {
  return appearancePresets[key] ?? appearancePresets.jersey;
}

export function getAppearanceThemeOverrides(key: AppearancePresetKey): ThemeOptions {
  const preset = getAppearancePreset(key);

  return {
    colorSchemes: {
      light: {
        palette: {
          primary: preset.palette.primary,
          secondary: preset.palette.secondary,
          info: preset.palette.info,
          success: preset.palette.success,
          warning: preset.palette.warning,
          error: preset.palette.error
        }
      },
      dark: {
        palette: {
          primary: preset.palette.primary,
          secondary: preset.palette.secondary,
          info: preset.palette.info,
          success: preset.palette.success,
          warning: preset.palette.warning,
          error: preset.palette.error
        }
      }
    }
  };
}
