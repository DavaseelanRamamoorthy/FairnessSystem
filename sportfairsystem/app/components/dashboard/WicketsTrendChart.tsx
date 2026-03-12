"use client";

import Box from "@mui/material/Box";

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
  wickets: number;
}

interface Props {
  data: ChartData[];
}

export default function WicketsTrendChart({ data }: Props) {

  return (
    <Box sx={{ width: "100%", minWidth: 0, height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">

        <LineChart data={data}>

          <CartesianGrid strokeDasharray="3 3" />

          <XAxis dataKey="match" />

          <YAxis />

          <Tooltip />

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
