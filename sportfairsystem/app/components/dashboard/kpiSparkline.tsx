"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";

interface Props {
  data: number[];
  color: string;
}

export default function KpiSparkline({ data, color }: Props) {

  const chartData = data.map((v, i) => ({
    index: i,
    value: v
  }));

  return (

    <ResponsiveContainer width={100} height={40}>

      <LineChart data={chartData}>

        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={3}
          dot={false}
        />

      </LineChart>

    </ResponsiveContainer>

  );
}