"use client";

import { Box, Card, Stack, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import KpiSparkline from "./kpiSparkline";

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "primary" | "success" | "warning" | "secondary";
  trend?: number[];
  layout?: "metric" | "leader";
}

const cardStyles = {
  primary: {
    topGradient: "linear-gradient(135deg, #2F6FED 0%, #5B5FEF 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#F6F8FF",
    footerText: "#3E4CC9",
    footerLabel: "Official team fixtures"
  },
  success: {
    topGradient: "linear-gradient(135deg, #16A34A 0%, #22C55E 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#EFFBF3",
    footerText: "#15803D",
    footerLabel: "Current team success rate"
  },
  warning: {
    topGradient: "linear-gradient(135deg, #F59E0B 0%, #FF7A00 100%)",
    topTint: "rgba(255,255,255,0.12)",
    iconBg: "rgba(255,255,255,0.2)",
    valueColor: "#FFFFFF",
    footerBg: "#FFF6E8",
    footerText: "#C56A00",
    footerLabel: "Current leading batter"
  },
  secondary: {
    topGradient: "linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)",
    topTint: "rgba(255,255,255,0.1)",
    iconBg: "rgba(255,255,255,0.18)",
    valueColor: "#FFFFFF",
    footerBg: "#F5EEFF",
    footerText: "#7C3AED",
    footerLabel: "Current leading bowler"
  }
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
  const style = cardStyles[color];
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
        borderColor: "transparent"
      }}
    >
      <Box
        sx={{
          minHeight: 120,
          flex: 1,
          px: 2.5,
          py: 2.25,
          color: "#FFFFFF",
          background: style.topGradient,
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
              `radial-gradient(circle at top right, ${style.topTint}, transparent 28%)`,
              `linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 100%)`
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
                  bgcolor: style.iconBg,
                  flexShrink: 0
                }}
              >
                {icon}
              </Box>

              <Typography
                variant="overline"
                sx={{
                  color: alpha("#FFFFFF", 0.82),
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
                color: style.valueColor,
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
          bgcolor: style.footerBg,
          borderTop: "1px solid",
          borderColor: alpha(style.footerText, 0.12)
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            color: style.footerText
          }}
        >
          {style.footerLabel}
        </Typography>
      </Box>
    </Card>
  );
}
