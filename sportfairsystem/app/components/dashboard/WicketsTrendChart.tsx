"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

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
  wickets: number;
}

interface Props {
  data: ChartData[];
}

type TickRendererProps = {
  x?: number | string;
  y?: number | string;
  payload?: {
    value?: string;
    payload?: ChartData;
  };
};

type TooltipRendererProps = {
  active?: boolean;
  payload?: ReadonlyArray<{
    payload: ChartData;
    value: number;
  }>;
};

export default function WicketsTrendChart({ data }: Props) {
  const renderTick = ({ x, y, payload }: TickRendererProps) => {
    if ((typeof x !== "number" && typeof x !== "string")
      || (typeof y !== "number" && typeof y !== "string")
      || !payload?.payload) {
      return null;
    }

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill="#102a5c"
          fontSize="12"
          fontWeight="700"
        >
          <tspan x="0">{payload.payload.match}</tspan>
          <tspan x="0" dy="18" fontSize="11" fontWeight="500" fill="#52627a">
            {payload.payload.matchLabel}
          </tspan>
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
          {point.match}
        </Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: "#ef4444" }}>
          Wickets: {point.wickets}
        </Typography>
      </Box>
    );
  };

  return (
    <Box sx={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height={300} minWidth={0} debounce={50}>

        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 16 }}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="match" height={68} interval={0} tick={renderTick} />

          <YAxis />

          <Tooltip content={renderTooltip} />

          <Line
            type="monotone"
            dataKey="wickets"
            stroke="#ef4444"
            strokeWidth={3}
          />

        </LineChart>

      </ResponsiveContainer>
    </Box>
  );
}
