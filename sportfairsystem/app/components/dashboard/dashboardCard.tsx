"use client";

import { Card, Box, Typography, Stack } from "@mui/material";
import KpiSparkline from "./kpiSparkline";

interface Props {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color?: "primary" | "success" | "warning" | "secondary";
  trend?: number[];
}

const cardStyles = {
  primary: {
    gradient: "linear-gradient(135deg,#b7d5f6 0%,#1d7bf1 100%)",
    text: "#1d7bf1",
    iconBg: "#90bff5"
  },
  success: {
    gradient: "linear-gradient(135deg,#bfe8cd 0%,#2ecc71 100%)",
    text: "#277344",
    iconBg: "#8dd7a9"
  },
  warning: {
    gradient: "linear-gradient(135deg,#f8ddb4 0%,#f59e0b 100%)",
    text: "#875028",
    iconBg: "#f5c26c"
  },
  secondary: {
    gradient: "linear-gradient(135deg,#d6c8f3 0%,#8b5cf6 100%)",
    text: "#3e2f52",
    iconBg: "#b9a5ec"
  }
};

export default function DashboardCard({
  title,
  value,
  icon,
  color = "primary",
  trend = []
}: Props) {

  const style = cardStyles[color];

  return (

    <Card
      sx={{
        p: 3,
        borderRadius: 4,
        position: "relative",
        overflow: "hidden",
        background: style.gradient
      }}
    >

      {/* dotted pattern */}

      <Box
        sx={{
          position: "absolute",
          left: 0,
          bottom: 0,
          width: "60%",
          height: "100%",
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
          opacity: 0.4
        }}
      />

      <Stack spacing={1} sx={{ position: "relative" }}>

        <Typography
          variant="subtitle2"
          sx={{ color: style.text }}
        >
          {title}
        </Typography>

        <Typography
          variant="h4"
          sx={{ color: style.text, fontWeight: 700 }}
        >
          {value}
        </Typography>

      </Stack>

      {/* icon badge */}

      <Box
        sx={{
          position: "absolute",
          right: 16,
          top: 16,
          width: 48,
          height: 48,
          borderRadius: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: style.iconBg
        }}
      >
        {icon}
      </Box>

      {/* sparkline */}

      {trend.length > 0 && (

        <Box
          sx={{
            position: "absolute",
            right: 10,
            bottom: 10
          }}
        >
          <KpiSparkline
            data={trend}
            color={style.text}
          />
        </Box>

      )}

    </Card>

  );
}