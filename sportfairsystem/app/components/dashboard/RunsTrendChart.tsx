"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  match: string;
  matchLabel: string;
  runs: number;
}

interface Props {
  data: ChartData[];
}

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
    value: number;
  }>;
};

export default function RunsTrendChart({ data }: Props) {
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
        <Typography variant="body2" fontWeight={700} color="primary.main">
          Runs: {point.runs}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 28 }}>
          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="match" height={56} interval={0} tick={renderTick} />

          <YAxis />

          <Tooltip content={renderTooltip} />

          <Line
            type="monotone"
            dataKey="runs"
            stroke="#1976d2"
            strokeWidth={3}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
