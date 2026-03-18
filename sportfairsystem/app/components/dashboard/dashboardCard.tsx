"use client";

import { Box, Card, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

import KpiSparkline from "./kpiSparkline";

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "primary" | "success" | "warning" | "secondary";
  trend?: number[];
  layout?: "metric" | "leader";
}

const footerLabels = {
  primary: "Official team fixtures",
  success: "Current team success rate",
  warning: "Current leading batter",
  secondary: "Current leading bowler"
};

function getDisplayValue(value: string | number) {
  if (typeof value === "number") {
    return String(value);
  }

  return value;
}

export default function DashboardCard({
  title,
  value,
  icon,
  color = "primary",
  trend = [],
  layout = "metric"
}: Props) {
  const theme = useTheme();
  const paletteColor = theme.palette[color];
  const isDarkMode = theme.palette.mode === "dark";
  const iconColor = alpha(theme.palette.common.white, isDarkMode ? 0.96 : 0.98);
  const displayValue = getDisplayValue(value);
  const isMetric = layout === "metric";

  return (
    <Card
      variant="outlined"
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        borderRadius: 3,
        borderColor: alpha(paletteColor.main, isDarkMode ? 0.24 : 0.14),
        backgroundColor: "background.paper"
      }}
    >
      <Box
        sx={{
          minHeight: 120,
          flex: 1,
          px: 2.5,
          py: 2.25,
          color: "common.white",
          background: `linear-gradient(135deg, ${paletteColor.dark} 0%, ${paletteColor.main} 55%, ${alpha(paletteColor.light, isDarkMode ? 0.92 : 1)} 100%)`,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          justifyContent: isMetric ? "space-between" : "flex-start",
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: [
              `radial-gradient(circle at top right, ${alpha(theme.palette.common.white, isDarkMode ? 0.12 : 0.18)}, transparent 28%)`,
              `linear-gradient(90deg, transparent 0%, ${alpha(theme.palette.common.white, 0.06)} 100%)`
            ].join(", ")
          }
        }}
      >
        <Stack
          sx={{
            position: "relative",
            zIndex: 1,
            height: "100%",
            justifyContent: "space-between"
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1.5}
          >
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: alpha(theme.palette.common.white, isDarkMode ? 0.16 : 0.2),
                  flexShrink: 0
                }}
              >
                <Box
                  sx={{
                    color: iconColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    "& .MuiSvgIcon-root": {
                      color: `${iconColor} !important`,
                      fontSize: 22
                    }
                  }}
                >
                  {icon}
                </Box>
              </Box>

              <Typography
                variant="overline"
                sx={{
                  color: alpha(theme.palette.common.white, 0.82),
                  letterSpacing: 1.2,
                  lineHeight: 1.2
                }}
              >
                {title}
              </Typography>
            </Stack>

            {trend.length > 0 && (
              <Box sx={{ pt: 0.5, opacity: 0.95, flexShrink: 0 }}>
                <KpiSparkline data={trend} color="rgba(255,255,255,0.92)" />
              </Box>
            )}
          </Stack>

          <Box
            sx={{
              minHeight: 52,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 0.5
            }}
          >
            <Typography
              sx={{
                fontWeight: 800,
                lineHeight: 1,
                color: "common.white",
                textAlign: "center",
                width: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textTransform: isMetric ? "none" : "uppercase",
                fontSize: isMetric
                  ? "clamp(2.2rem, 3vw, 3rem)"
                  : "clamp(1.5rem, 1.8vw, 2rem)"
              }}
            >
              {displayValue}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          bgcolor: isDarkMode
            ? alpha(theme.palette.background.paper, 0.92)
            : theme.palette.common.white,
          borderTop: "1px solid",
          borderColor: isDarkMode
            ? alpha(theme.palette.common.white, 0.08)
            : alpha(theme.palette.text.primary, 0.08)
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: isDarkMode
              ? theme.palette.text.secondary
              : theme.palette.text.primary
          }}
        >
          {footerLabels[color]}
        </Typography>
      </Box>
    </Card>
  );
}
