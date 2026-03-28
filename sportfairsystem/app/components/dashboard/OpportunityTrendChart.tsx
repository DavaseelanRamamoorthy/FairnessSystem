"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

type ChartData = {
  match: string;
  matchLabel: string;
  score: number;
  plannedStatus: string;
  actualStatus: string;
};

type Props = {
  data: ChartData[];
};

type TickRendererProps = {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
  };
};

type TooltipRendererProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload: ChartData;
  }>;
};

export default function OpportunityTrendChart({ data }: Props) {
  const theme = useTheme();

  const renderTick = ({ x, y, payload }: TickRendererProps) => {
    if ((typeof x !== "number" && typeof x !== "string")
      || (typeof y !== "number" && typeof y !== "string")
      || !payload?.value) {
      return null;
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill={theme.palette.text.primary}
          fontSize="12"
          fontWeight="700"
        >
          <tspan x="0">{payload.value}</tspan>
        </text>
      </g>
    );
  };

  const renderTooltip = ({
    active,
    payload
  }: TooltipRendererProps) => {
    if (!active || !payload?.length) {
      return null;
    }

    const point = payload[0]?.payload;

    if (!point) {
      return null;
    }

    return (
      <Box
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          px: 2,
          py: 1.5,
          boxShadow: 3
        }}
      >
        <Typography variant="body2" fontWeight={700} color="text.primary">
          {point.matchLabel}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Planned: {point.plannedStatus}
        </Typography>
        <Typography variant="body2" sx={{ color: theme.palette.info.main, fontWeight: 700 }}>
          Actual: {point.actualStatus}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="match" height={56} interval={0} tick={renderTick} />
          <YAxis domain={[0, 3]} ticks={[0, 1, 2, 3]} />
          <Tooltip content={renderTooltip} cursor={false} />
          <Bar dataKey="score" fill={theme.palette.info.main} radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
