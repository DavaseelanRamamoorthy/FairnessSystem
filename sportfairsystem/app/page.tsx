'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo, useEffect } from 'react';
import { cleanName } from './services/cleanName';
import { parseMatchFromBase64 } from "./services/pdfParser";
import { supabase } from "@/app/services/supabaseClient";
import {
  Users, BarChart3, Plus, ClipboardList, Moon, Sun, X, Check,
  Trash2, Trophy, ShieldCheck, Sword, ChevronRight, Scale,
  Award, Loader2, SortAsc, Clock, ChevronDown,
  Palette, Target, Coffee, Zap, Flame,
  Quote, LayoutGrid, Sparkles
} from 'lucide-react';

const currentTeamName = "Moonwalkers";

type Player = {
  id: string;
  name: string;
  dateAdded: number;
};

type Match = Record<string, any>;

const App = () => {

  const [view, setView] = useState('planner');
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // =========================
  // LOAD MATCHES FROM DB
  // =========================

  const loadMatchesFromDB = async () => {
    const { data, error } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false });

    if (error) {
      console.error("Load matches error:", error.message);
    } else {
      setMatches(data || []);
    }
  };

  useEffect(() => {
    loadMatchesFromDB();
  }, []);

  // =========================
  // PDF UPLOAD
  // =========================

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;

      const base64 = reader.result.split(',')[1];
      if (!base64) return;

      try {
        setIsProcessing(true);

        const parsed = await parseMatchFromBase64(
          base64,
          currentTeamName
        );
// Console.log the full parsed object for debugging
        console.log("===== FULL PARSED OBJECT =====");
        console.log(JSON.stringify(parsed, null, 2));

        // 🔥 ADD THIS BELOW
        console.log("===== BATTING STATS BY INNINGS =====");
        parsed.innings.forEach((inn: any, index: number) => {
          console.log(`Innings ${index + 1} - ${inn.teamName}`);
          console.log(inn.battingStats);
        });

        if (!parsed) return;

        // Fetch team ID
        const { data: teamData } = await supabase
          .from("teams")
          .select("id")
          .eq("name", currentTeamName)
          .single();

        if (!teamData) return;

        // 🔍 Check duplicate
        const { data: existingMatch } = await supabase
          .from("matches")
          .select("id")
          .eq("match_date", parsed.matchDate)
          .eq("team_a", parsed.teamA)
          .eq("team_b", parsed.teamB)
          .maybeSingle();

        if (existingMatch) {
          console.log("This match already exists in database.");
          setIsProcessing(false);
          return;
        }else{
          console.log("No duplicate found, proceeding to insert.");
        }

        // Insert match
        // 1️⃣ Insert match and return inserted row
        const { data: insertedMatch, error: matchError } = await supabase
          .from("matches")
          .insert([
            {
              team_id: teamData.id,
              match_date: parsed.matchDate,
              opponent_name:
                parsed.teamA === currentTeamName
                  ? parsed.teamB
                  : parsed.teamA,
              team_a: parsed.teamA,
              team_b: parsed.teamB,
              winner: parsed.winner,
              result: parsed.matchResult
            }
          ])
          .select()
          .single();

          if (matchError || !insertedMatch) {
            console.error("Match insert failed:", matchError);
            return;
          }

          // 2️⃣ Insert innings
          const inningsToInsert = parsed.innings.map((inn: any) => ({
            match_id: insertedMatch.id,
            team_name: inn.teamName,
            runs: inn.runs,
            wickets: inn.wickets,
            overs: inn.overs,
           // extras: 0 // temporary default until we parse extras properly
            extras: inn.extras ?? 0 // use parsed extras if available, otherwise default to 0
          }));

          // ============================
          // INSERT INNINGS (RETURN ROWS)
          // ============================

          const { data: insertedInnings, error: inningsError } = await supabase
            .from("innings")
            .insert(inningsToInsert)
            .select();

          if (inningsError || !insertedInnings) {
            console.error("Innings insert failed:", inningsError);
            return;
          }

          // ============================
          // INSERT BATTING STATS
          // ============================

          for (let i = 0; i < insertedInnings.length; i++) {
            const inningsRow = insertedInnings[i];
            const parsedInnings = parsed.innings[i];

            if (!parsedInnings.battingStats) continue;

            const battingRows = parsedInnings.battingStats.map((b: any) => ({
              innings_id: inningsRow.id,
              player_name: b.player_name,
              runs: b.runs,
              balls: b.balls,
              fours: b.fours,
              sixes: b.sixes,
              strike_rate: b.strike_rate
            }));

            const { error: battingError } = await supabase
              .from("batting_stats")
              .insert(battingRows);

            if (battingError) {
              console.error("Batting insert failed:", battingError);
            }
          }

        await loadMatchesFromDB();

      } catch (err) {
        console.error("PDF Parsing Error:", err);
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsDataURL(file);
  };

  // =========================
  // SIMPLE DASHBOARD STATS
  // =========================

  const winRate = useMemo(() => {
    if (matches.length === 0) return 0;
    const wins = matches.filter(m => m.result === "Won").length;
    return ((wins / matches.length) * 100).toFixed(0);
  }, [matches]);

  // =========================
  // UI
  // =========================

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 transition-colors">

        {/* HEADER */}
        <div className="bg-white dark:bg-slate-900 p-6 border-b dark:border-slate-800 flex justify-between items-center">
          <h1 className="text-xl font-bold dark:text-white uppercase">
            Moonwalkers
          </h1>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
          >
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        </div>

        <main className="max-w-md mx-auto p-6 space-y-6">

          {view === "dashboard" && (
            <>
              <div className="bg-indigo-600 text-white p-8 rounded-3xl text-center">
                <p className="text-xs uppercase tracking-widest opacity-70">
                  Win Ratio
                </p>
                <p className="text-6xl font-black mt-2">{winRate}%</p>
              </div>
            </>
          )}

          {view === "matches" && (
            <>
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
                Match History
              </h2>

              {matches.map(match => (
                <div
                  key={match.id}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border dark:border-slate-800 flex justify-between items-center"
                >
                  <div>
                    <p className="text-xs text-slate-400">
                      {match.match_date}
                    </p>
                    <p className="font-bold uppercase dark:text-white">
                      vs {match.opponent_name}
                    </p>
                  </div>
                  {match.result === "Won" ? (
                    <Trophy className="text-emerald-500" size={20}/>
                  ) : (
                    <X className="text-rose-500" size={20}/>
                  )}
                </div>
              ))}

              {matches.length === 0 && (
                <p className="text-center text-slate-400 text-sm">
                  No matches found
                </p>
              )}
            </>
          )}

        </main>

        {/* NAV */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t dark:border-slate-800 flex justify-around py-4">
          <button onClick={() => setView("dashboard")}>
            <BarChart3 />
          </button>

          <button onClick={() => setView("matches")}>
            <ClipboardList />
          </button>

          <label className="cursor-pointer">
            <input
              type="file"
              accept="application/pdf"
              hidden
              onChange={handleFileUpload}
            />
            <Plus size={28}/>
          </label>
        </nav>

        {isProcessing && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center text-white">
            <Loader2 className="animate-spin" size={48}/>
          </div>
        )}

      </div>
    </div>
  );
};

export default App;