'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useEffect } from 'react';
import { parseMatchFromBase64 } from "./services/pdfParser";
import { supabase } from "@/app/services/supabaseClient";
import {
  BarChart3, Plus, ClipboardList, Moon, Sun,
  Trophy, X, Loader2
} from 'lucide-react';

const currentTeamName = "Moonwalkers";
const normalizeName = (name: string) =>
  name
    .replace(/\(.*?\)/g, '')  // remove (c), (wk), (RHB)
    .replace(/\s+/g, ' ')     // remove extra spaces
    .trim()
    .toLowerCase();

type Match = Record<string, any>;

const App = () => {
  const [view, setView] = useState('dashboard');
  const [matches, setMatches] = useState<Match[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [previewMatch, setPreviewMatch] = useState<any | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // =========================
  // LOAD MATCHES
  // =========================
  const loadMatchesFromDB = async () => {
    const { data } = await supabase
      .from("matches")
      .select("*")
      .order("match_date", { ascending: false });

    setMatches(data || []);
  };

  useEffect(() => {
    loadMatchesFromDB();
  }, []);

  // =========================
  // TOAST AUTO HIDE
  // =========================
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // =========================
  // FILE UPLOAD (PARSE ONLY)
  // =========================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const base64 = reader.result.split(',')[1];
      if (!base64) return;

      setIsProcessing(true);

      const parsed = await parseMatchFromBase64(base64, currentTeamName);

      if (!parsed) {
        setIsProcessing(false);
        return;
      }

      setPreviewMatch(parsed);
      setIsProcessing(false);
    };

    reader.readAsDataURL(file);
  };

  // =========================
  // SAVE MATCH (ALL INSERTS)
  // =========================
  const handleSaveMatch = async () => {
    if (!previewMatch) return;
    console.log("DEBUG PLAYING11 DATA:", previewMatch.innings);
    setIsProcessing(true);

    const { data: teamData } = await supabase
      .from("teams")
      .select("id")
      .eq("name", currentTeamName)
      .single();

    if (!teamData) {
      setIsProcessing(false);
      return;
    }

    // Duplicate check
    const { data: existingMatch } = await supabase
      .from("matches")
      .select("id")
      .eq("match_date", previewMatch.matchDate)
      .eq("team_a", previewMatch.teamA)
      .eq("team_b", previewMatch.teamB)
      .maybeSingle();

    if (existingMatch) {
      setToastMessage("This match already exists in the system.");
      setIsProcessing(false);
      return;
    }

    // 1️⃣ Insert match
    const { data: insertedMatch } = await supabase
      .from("matches")
      .insert([
        {
          team_id: teamData.id,
          match_date: previewMatch.matchDate,
          opponent_name:
            previewMatch.teamA === currentTeamName
              ? previewMatch.teamB
              : previewMatch.teamA,
          team_a: previewMatch.teamA,
          team_b: previewMatch.teamB,
          winner: previewMatch.winner,
          result: previewMatch.matchResult
        }
      ])
      .select()
      .single();

    if (!insertedMatch) {
      setIsProcessing(false);
      return;
    }

    // 2️⃣ Insert innings
    const inningsToInsert = previewMatch.innings.map((inn: any) => ({
      match_id: insertedMatch.id,
      team_name: inn.teamName,
      runs: inn.runs,
      wickets: inn.wickets,
      overs: inn.overs,
      extras: inn.extras ?? 0
    }));

    const { data: insertedInnings } = await supabase
      .from("innings")
      .insert(inningsToInsert)
      .select();

    if (!insertedInnings) {
      setIsProcessing(false);
      return;
    }

    // 3️⃣ Insert Batting
    for (let i = 0; i < insertedInnings.length; i++) {
      const inningsRow = insertedInnings[i];
      const parsedInnings = previewMatch.innings[i];

      if (!parsedInnings.battingStats) continue;

      const battingRows = parsedInnings.battingStats.map((b: any) => ({
        innings_id: inningsRow.id,
        player_name: normalizeName(b.player_name),
        runs: b.runs,
        balls: b.balls,
        fours: b.fours,
        sixes: b.sixes,
        strike_rate: b.strike_rate
      }));

      await supabase.from("batting_stats").insert(battingRows);
    }

    // 4️⃣ Insert bowling
    for (let i = 0; i < insertedInnings.length; i++) {
      const inningsRow = insertedInnings[i];
      const parsedInnings = previewMatch.innings[i];

      if (!parsedInnings.bowlingStats) continue;

      const bowlingRows = parsedInnings.bowlingStats.map((b: any) => ({
        innings_id: inningsRow.id,
        player_name: normalizeName(b.player_name),
        overs: b.overs,
        maidens: b.maidens,
        runs: b.runs,
        wickets: b.wickets,
        economy: b.economy
      }));

      await supabase.from("bowling_stats").insert(bowlingRows);
    }

    // 5️⃣ Insert FOW
    for (let i = 0; i < insertedInnings.length; i++) {
      const inningsRow = insertedInnings[i];
      const parsedInnings = previewMatch.innings[i];

      if (!parsedInnings.fallOfWickets) continue;

      const fowRows = parsedInnings.fallOfWickets.map((f: any) => ({
        innings_id: inningsRow.id,
        score: f.score,
        wicket_number: f.wicket_number,
        batsman: normalizeName(f.batsman),
        over: f.over
      }));

      await supabase.from("fall_of_wickets").insert(fowRows);
    }

    // 6️⃣ Insert Players (for playing11)
    for (let i = 0; i < previewMatch.innings.length; i++) {
      const inn = previewMatch.innings[i];

      if (!inn.playing11) continue;

      // Find opponent innings
      const opponentInnings = previewMatch.innings.find(
        (other: any) => other.teamName !== inn.teamName
      );

      const battingNames =
        inn.battingStats?.map((b: any) =>
          normalizeName(b.player_name)
        ) || [];

      const bowlingNames =
        opponentInnings?.bowlingStats?.map((b: any) =>
          normalizeName(b.player_name)
        ) || [];

      const playerRows = inn.playing11.map((player: string) => {
        const normalizedPlayer = normalizeName(player);

        return {
          match_id: insertedMatch.id,
          team_name: inn.teamName,
          player_name: normalizedPlayer,
          did_bat: battingNames.includes(normalizedPlayer),
          did_bowl: bowlingNames.includes(normalizedPlayer)
        };
      });

      await supabase.from("match_players").insert(playerRows);
    }

     

    setToastMessage("Match saved successfully.");
    setPreviewMatch(null);
    await loadMatchesFromDB();
    setIsProcessing(false);
  };

  // =========================
  // DASHBOARD
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
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">

        {/* HEADER */}
        <div className="bg-white dark:bg-slate-900 p-6 border-b flex justify-between items-center">
          <h1 className="text-xl font-bold uppercase dark:text-white">
            Moonwalkers
          </h1>
          <button onClick={() => setIsDarkMode(!isDarkMode)}>
            {isDarkMode ? <Sun size={18}/> : <Moon size={18}/>}
          </button>
        </div>

        <main className="max-w-md mx-auto p-6 space-y-6">

          {/* PREVIEW */}
          {previewMatch && (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-slate-900 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6 space-y-6">

                {/* HEADER */}
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold dark:text-white">
                    Match Preview
                  </h2>
                  <button
                    onClick={() => setPreviewMatch(null)}
                    className="text-slate-400 hover:text-red-500"
                  >
                    <X />
                  </button>
                </div>

                {/* MATCH SUMMARY */}
                <div className="space-y-1">
                  <p className="font-bold text-lg dark:text-white"> 
                    {previewMatch.teamA} vs {previewMatch.teamB}
                  </p>
                  <p className="text-sm text-slate-400">
                    Date: {previewMatch.matchDate}
                  </p>
                  <p className="text-sm">
                    Winner: <strong>{previewMatch.winner}</strong>
                  </p>
                </div>

                {/* INNINGS */}
                {previewMatch.innings.map((inn: any, index: number) => (
                  <div key={index} className="border-t pt-4 space-y-4">

                    {/* Innings Summary */}
                    <div>
                      <p className="font-semibold dark:text-white">
                        {inn.teamName}
                      </p>
                      <p className="text-sm text-slate-500">
                        {inn.runs}/{inn.wickets} ({inn.overs} ov)
                      </p>
                      <p className="text-xs text-slate-400">
                        Extras: {inn.extras}
                      </p>
                    </div>

                    {/* Batting */}
                    {inn.battingStats && (
                      <div>
                        <h4 className="text-sm font-bold mb-2 dark:text-white">
                          Batting
                        </h4>
                        <div className="space-y-1 text-xs">
                          {inn.battingStats.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span>{b.player_name}</span>
                              <span>
                                {b.runs} ({b.balls}) • {b.fours}x4 • {b.sixes}x6 • SR {b.strike_rate}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Bowling */}
                    {inn.bowlingStats && (
                      <div>
                        <h4 className="text-sm font-bold mt-3 mb-2 dark:text-white">
                          Bowling
                        </h4>
                        <div className="space-y-1 text-xs">
                          {inn.bowlingStats.map((b: any, i: number) => (
                            <div key={i} className="flex justify-between">
                              <span>{b.player_name}</span>
                              <span>
                                {b.overs}-{b.maidens}-{b.runs}-{b.wickets} • Eco {b.economy}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Fall of Wickets */}
                    {inn.fallOfWickets && inn.fallOfWickets.length > 0 && (
                      <div>
                        <h4 className="text-sm font-bold mt-3 mb-2 dark:text-white">
                          Fall of Wickets
                        </h4>
                        <div className="space-y-1 text-xs">
                          {inn.fallOfWickets.map((f: any, i: number) => (
                            <div key={i}>
                              {f.score}-{f.wicket_number} ({f.batsman}, {f.over} ov)
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                ))}

                {/* ACTION BUTTONS */}
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    onClick={() => setPreviewMatch(null)}
                    className="px-4 py-2 rounded-lg bg-slate-200 dark:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveMatch}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white"
                  >
                    Save Match
                  </button>
                </div>

              </div>
            </div>
          )}

          {/* DASHBOARD */}
          {view === "dashboard" && (
            <div className="bg-indigo-600 text-white p-8 rounded-3xl text-center">
              <p className="text-xs uppercase opacity-70">Win Ratio</p>
              <p className="text-6xl font-black mt-2">{winRate}%</p>
            </div>
          )}

          {/* MATCH HISTORY */}
          {view === "matches" && (
            <>
              <h2 className="text-xs font-bold uppercase text-slate-400">
                Match History
              </h2>

              {matches.map(match => (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className="bg-white dark:bg-slate-900 p-5 rounded-2xl border flex justify-between items-center cursor-pointer"
                >
                  <div>
                    <p className="text-xs text-slate-400">
                      {match.match_date}
                    </p>
                    <p className="font-bold uppercase dark:text-white">
                      vs {match.opponent_name}
                    </p>
                  </div>
                  {match.result === "Won" ?
                    <Trophy className="text-emerald-500" size={20}/> :
                    <X className="text-rose-500" size={20}/>
                  }
                </div>
              ))}
            </>
          )}
        </main>

        {/* NAV */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t flex justify-around py-4">
          <button onClick={() => setView("dashboard")}><BarChart3/></button>
          <button onClick={() => setView("matches")}><ClipboardList/></button>
          <label className="cursor-pointer">
            <input type="file" hidden accept="application/pdf" onChange={handleFileUpload}/>
            <Plus size={28}/>
          </label>
        </nav>

        {/* MATCH DETAIL MODAL */}
        {selectedMatch && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center">
            <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl w-80">
              <h2 className="font-bold text-lg">
                {selectedMatch.team_a} vs {selectedMatch.team_b}
              </h2>
              <p>Date: {selectedMatch.match_date}</p>
              <p>Result: {selectedMatch.result}</p>
              <button
                onClick={() => setSelectedMatch(null)}
                className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* TOAST */}
        {toastMessage && (
          <div className="fixed top-6 right-6 bg-black text-white px-4 py-3 rounded-lg shadow-lg">
            {toastMessage}
          </div>
        )}

        {/* LOADER */}
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