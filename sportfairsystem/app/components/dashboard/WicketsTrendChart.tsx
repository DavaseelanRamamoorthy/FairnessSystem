"use client";

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
    <ResponsiveContainer width="100%" height={300}>

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
  );
}