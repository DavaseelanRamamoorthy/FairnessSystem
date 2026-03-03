"use client";

import { Moon, Sun } from "lucide-react";

interface HeaderProps {
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  teamName: string;
}

export default function Header({
  isDarkMode,
  onToggleDarkMode,
  teamName
}: HeaderProps) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 border-b flex justify-between items-center">
      <h1 className="text-xl font-bold uppercase dark:text-white">
        {teamName}
      </h1>

      <button onClick={onToggleDarkMode}>
        {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </div>
  );
}