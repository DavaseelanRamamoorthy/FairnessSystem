"use client";

interface DashboardCardProps {
  winRate: string | number;
}

export default function DashboardCard({ winRate }: DashboardCardProps) {
  return (
    <div className="bg-indigo-600 text-white p-8 rounded-3xl text-center">
      <p className="text-xs uppercase opacity-70">Win Ratio</p>
      <p className="text-6xl font-black mt-2">{winRate}%</p>
    </div>
  );
}