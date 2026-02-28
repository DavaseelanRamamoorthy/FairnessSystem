'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useMemo } from 'react';
import { cleanName } from './services/cleanName';
import { parseMatchFromBase64 } from "./services/pdfParser";
const currentTeamName = "Moonwalkers";
import { 
  Users, 
  BarChart3, 
  Plus, 
  ClipboardList, 
  Moon, 
  Sun,
  X, 
  Check, 
  Trash2, 
  Trophy, 
  ShieldCheck, 
  Sword, 
  Shield,
  ChevronRight,
  Scale,
  Award,
  Calendar,
  UserPlus,
  FileText,
  Loader2,
  Activity,
  SortAsc,
  Clock,
  ChevronDown,
  Palette,
  SortDesc,
  UserCheck,
  Target,
  UserMinus,
  AlertCircle,
  Coffee,
  Zap,
  Flame,
  Quote,
  LayoutGrid,
  MapPin,
  MessageSquare,
  Sparkles
} from 'lucide-react';

type ExtractedMatchData = {
  matchSummary: string;
  moonwalkersPlaying11: string[];
  moonwalkersTopPerformer: string;
  matchDate: string;
  opponentName: string;
  moonwalkersWhoBatted: { name: string; runs: number; strikeRate: string }[];
  moonwalkersWhoBowled: { name: string; overs: string; wickets: number }[];
  moonwalkersNoActivity: string[];
  matchResult: 'Won' | 'Lost';
};

const extractionPrompt = `Analyze this cricket scorecard PDF and return strict JSON with this exact schema: { "matchSummary": "string", "moonwalkersPlaying11": ["name"], "moonwalkersTopPerformer": "string", "matchDate": "YYYY-MM-DD", "opponentName": "string", "moonwalkersWhoBatted": [{"name": "string", "runs": number, "strikeRate": "string"}], "moonwalkersWhoBowled": [{"name": "string", "overs": "string", "wickets": number}], "moonwalkersNoActivity": ["string"], "matchResult": "Won" | "Lost" }. Only output raw JSON.`;

type Theme = {
  id: string;
  name: string;
  primary: string;
  textPrimary: string;
  textPrimaryDark: string;
  borderPrimary: string;
  accent: string;
  accentDark: string;
  navActive: string;
};

type Player = {
  id: string;
  name: string;
  dateAdded: number;
};

type Match = Record<string, any>;

const THEMES = {
  moonlight: {
    id: 'moonlight',
    name: 'Moonlight',
    primary: 'bg-indigo-600',
    textPrimary: 'text-indigo-600',
    textPrimaryDark: 'dark:text-indigo-400',
    borderPrimary: 'border-indigo-400',
    accent: 'bg-indigo-50',
    accentDark: 'dark:bg-indigo-900/20',
    navActive: 'text-indigo-500 dark:text-indigo-300'
  },
  midnight: {
    id: 'midnight',
    name: 'Midnight',
    primary: 'bg-slate-900',
    textPrimary: 'text-slate-900',
    textPrimaryDark: 'dark:text-slate-100',
    borderPrimary: 'border-slate-500',
    accent: 'bg-slate-100',
    accentDark: 'dark:bg-slate-800',
    navActive: 'text-slate-900 dark:text-slate-100'
  },
  emerald: {
    id: 'emerald',
    name: 'Emerald',
    primary: 'bg-emerald-600',
    textPrimary: 'text-emerald-600',
    textPrimaryDark: 'dark:text-emerald-400',
    borderPrimary: 'border-emerald-400',
    accent: 'bg-emerald-50',
    accentDark: 'dark:bg-emerald-900/20',
    navActive: 'text-emerald-500 dark:text-emerald-300'
  }
};

const parseModelJson = (text: string) => {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
  return JSON.parse(cleaned) as ExtractedMatchData;
};

const App = () => {
  const [view, setView] = useState('planner');
  const [activeTheme, setActiveTheme] = useState<Theme>(THEMES.moonlight);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [teamLogo, setTeamLogo] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([
    { id: '1', name: 'ANIR', dateAdded: Date.now() },
    { id: '2', name: 'DAVASEELAN', dateAdded: Date.now() - 100000 },
    { id: '3', name: 'GAURAV PATIL', dateAdded: Date.now() - 200000 },
    { id: '4', name: 'HARI KUMAR', dateAdded: Date.now() - 300000 },
    { id: '5', name: 'IMAAD KHAN', dateAdded: Date.now() - 400000 }
  ]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedQueue, setExtractedQueue] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [squadSort, setSquadSort] = useState('name-asc'); 
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 5);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') return;
        const base64 = reader.result.split(',')[1];
        if (!base64) return;
        extractMatchData(base64);
      };
      reader.readAsDataURL(file);
    });

    e.target.value = '';
  };

  
  const [parsedMatch, setParsedMatch] = useState<any | null>(null);
const extractMatchData = async (base64Data: string) => {
 try {
    setIsProcessing(true);

    const parsed = await parseMatchFromBase64(
      base64Data,
      currentTeamName
    );

    console.log("FINAL MATCH DATA:", parsed);

    setParsedMatch(parsed);

  } catch (err) {
    console.error("PDF Parsing Error:", err);
  } finally {
    setIsProcessing(false);
  }
};

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setTeamLogo(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const addToSquad = (playerName: string) => {
    const cleaned = cleanName(playerName);
    setPlayers(prev => {
      if (prev.some(p => cleanName(p.name) === cleaned)) return prev;
      return [...prev, { id: Date.now().toString() + Math.random(), name: cleaned, dateAdded: Date.now() }];
    });
  };

  const confirmMatch = (tempId: string) => {
    const data = extractedQueue.find(item => item.tempId === tempId);
    if (!data) return;
    const newMatchObj = {
      ...data, 
      id: `match-${Date.now()}`, 
      opponent: data.opponentName, 
      date: data.matchDate,
      fullStats: { 
        batted: data.moonwalkersWhoBatted, 
        bowled: data.moonwalkersWhoBowled, 
        noActivity: data.moonwalkersNoActivity || [], 
        topPerformer: data.moonwalkersTopPerformer, 
        summary: data.matchSummary, 
        playing11: data.moonwalkersPlaying11 
      },
      batting: data.moonwalkersWhoBatted.map((p: any) => cleanName(p.name)),
      bowling: data.moonwalkersWhoBowled.map((p: any) => cleanName(p.name)),
      fielding: data.moonwalkersPlaying11.map((n: any) => cleanName(n)), 
      matchResult: data.matchResult
    };
    setMatches(prev => [...prev, newMatchObj]);
    setExtractedQueue(prev => prev.filter(item => item.tempId !== tempId));
    setView('matches');
  };

  const playerStats = useMemo(() => {
    return players.map(player => {
      const pName = cleanName(player.name);
      const breakdown = matches.map((match: any) => {
        const playedFielding = match.fielding?.some((n: any) => cleanName(n) === pName);
        const batted = match.fullStats.batted.find((b: any) => cleanName(b.name) === pName);
        const bowled = match.fullStats.bowled.find((b: any) => cleanName(b.name) === pName);
        let pts = 0;
        if (batted) pts++;
        if (bowled) pts++;
        if (playedFielding) pts++;
        return { 
          matchId: match.id, 
          opponent: match.opponent, 
          points: Math.min(3, pts), 
          date: match.date, 
          result: match.matchResult, 
          played: playedFielding 
        };
      });
      return { 
        ...player, 
        totalPoints: breakdown.reduce((s, m) => s + m.points, 0), 
        totalPlayed: breakdown.filter(m => m.played).length, 
        matchBreakdown: breakdown 
      };
    });
  }, [players, matches]);

  const Header = () => (
    <div className="bg-white dark:bg-slate-900 p-6 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 transition-colors">
      <div className="flex justify-between items-center max-w-md mx-auto">
        <div className="flex items-center gap-4">
          <input type="file" id="logo-upload" className="hidden" accept="image/*" onChange={handleLogoUpload} />
          <label htmlFor="logo-upload" className={`w-12 h-12 ${activeTheme.primary} rounded-xl flex items-center justify-center text-white cursor-pointer overflow-hidden shadow-md`}>
            {teamLogo ? <img src={teamLogo} alt="Team" className="w-full h-full object-cover" /> : <ShieldCheck size={24} />}
          </label>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight leading-none">Moonwalkers</h1>
            <p className={`text-[10px] font-medium ${activeTheme.textPrimary} ${activeTheme.textPrimaryDark} uppercase tracking-widest mt-1`}>Official Team Portal</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowThemePicker(!showThemePicker)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-slate-200/50 dark:border-slate-700/50"><Palette size={18} /></button>
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-slate-400 border border-slate-200/50 dark:border-slate-700/50">{isDarkMode ? <Sun size={18} /> : <Moon size={18} />}</button>
        </div>
      </div>
      {showThemePicker && (
        <div className="absolute top-20 right-6 bg-white dark:bg-slate-800 p-2 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 z-50">
          {Object.values(THEMES).map(t => (
            <button key={t.id} onClick={() => {setActiveTheme(t); setShowThemePicker(false);}} className="flex items-center gap-2 p-2 w-full hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg text-[10px] font-bold uppercase tracking-widest dark:text-white">
              <div className={`w-3 h-3 rounded-full ${t.primary}`} /> {t.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const MatchDetailPanel = ({ data, onClose, title, players, onAddPlayer, activeTheme }: { data: Match; onClose: () => void; title: string; players: Player[]; onAddPlayer: (name: string) => void; activeTheme: Theme }) => {
    const isTemp = !!data.tempId;
    const stats = isTemp ? data : data.fullStats;
    
    const playing11 = stats.moonwalkersPlaying11 || stats.playing11 || [];
    const batted = stats.moonwalkersWhoBatted || stats.batted || [];
    const bowled = stats.moonwalkersWhoBowled || stats.bowled || [];
    const topPerformer = stats.moonwalkersTopPerformer || stats.topPerformer;
    const matchSummary = data.matchSummary || stats.summary;

    const inactivePlayers = useMemo(() => {
        const activeNames = new Set([
            ...batted.map((p: any) => cleanName(p.name)),
            ...bowled.map((p: any) => cleanName(p.name))
        ]);
        return playing11.filter((name: any) => !activeNames.has(cleanName(name)));
    }, [playing11, batted, bowled]);

    const unlistedPlayers = playing11.filter((name: any) => !players.some((p: any) => cleanName(p.name) === cleanName(name)));

    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] overflow-hidden max-h-[92vh] flex flex-col shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] border border-white/10">
          <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900/50 backdrop-blur-xl">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{title}</h3>
              <p className="text-sm font-bold dark:text-white uppercase truncate max-w-[200px]">vs {data.opponentName || data.opponent}</p>
            </div>
            <button onClick={onClose} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all active:scale-90"><X size={20} className="dark:text-slate-400" /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-12 bg-slate-50/30 dark:bg-slate-950/20">
            {matchSummary && (
              <section className="relative">
                <div className="bg-white dark:bg-slate-800 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
                  <div className="p-8">
                    <div className="flex justify-between items-start mb-6">
                      <Quote size={32} className="text-slate-100 dark:text-slate-700" />
                      <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${data.matchResult === 'Won' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30' : 'bg-rose-100 text-rose-600 dark:bg-rose-900/30'}`}>
                        {data.matchResult}
                      </span>
                    </div>
                    <div className="relative">
                      <p className="text-lg font-medium text-slate-700 dark:text-slate-200 leading-relaxed indent-8 first-letter:text-4xl first-letter:font-black first-letter:float-left first-letter:mr-3 first-letter:text-indigo-500">
                        {matchSummary}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {topPerformer && (
                <section className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-400 to-orange-500 rounded-[2rem] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                    <div className="relative bg-white dark:bg-slate-800 rounded-[2rem] overflow-hidden border border-amber-100 dark:border-amber-900/30 shadow-2xl">
                        <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="bg-white/20 backdrop-blur-md p-3 rounded-2xl border border-white/20 shadow-inner">
                                    <Trophy size={28} className="text-white drop-shadow-lg" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-white/70 uppercase tracking-[0.2em] leading-none mb-1">Man of the Match</p>
                                    <p className="text-xl font-black text-white uppercase tracking-tight leading-none drop-shadow-md">
                                        {cleanName(topPerformer)}
                                    </p>
                                </div>
                            </div>
                            <Award size={48} className="text-white/20 absolute -right-2 top-0 rotate-12" />
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-xl flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                             <p className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Unanimous MVP Selection</p>
                        </div>
                    </div>
                </section>
            )}

            <div className="grid grid-cols-1 gap-8">
                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase text-indigo-500 tracking-[0.3em] flex items-center gap-3">
                            <Sword size={16} /> The Batters
                        </h4>
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{batted.length} Entries</span>
                    </div>
                    
                    {batted.length > 0 ? (
                    <div className="space-y-3">
                        {batted.map((p: any, idx: any) => (
                        <div key={`bat-${idx}`} className="group relative bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-indigo-50 dark:bg-indigo-900/30 w-12 h-12 rounded-2xl flex items-center justify-center text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                        <Zap size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{p.strikeRate ?? '-'} SR</p>
                                        <p className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{cleanName(p.name)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter leading-none">{p.runs ?? '-'}</p>
                                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Runs Scored</p>
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    ) : (
                        <EmptyState message="No Batting Stats Found" icon={<Sword className="opacity-20" />} />
                    )}
                </section>

                <section className="space-y-4">
                    <div className="flex items-center justify-between px-2">
                        <h4 className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.3em] flex items-center gap-3">
                            <Target size={16} /> The Attack
                        </h4>
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-600">{bowled.length} Entries</span>
                    </div>
                    
                    {bowled.length > 0 ? (
                    <div className="space-y-3">
                        {bowled.map((p: any, idx: any) => (
                        <div key={`bowl-${idx}`} className="group relative bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm hover:shadow-xl transition-all hover:-translate-y-1">
                            <div className="flex justify-between items-center relative z-10">
                                <div className="flex items-center gap-4">
                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 w-12 h-12 rounded-2xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                                        <Flame size={20} />
                                    </div>
                                    <div>
                                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1.5">{p.overs ?? '-'} Overs</p>
                                        <p className="text-[13px] font-black text-slate-800 dark:text-white uppercase tracking-tight">{cleanName(p.name)}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter leading-none">{p.wickets ?? '-'}</p>
                                    <p className="text-[8px] font-bold text-slate-300 uppercase tracking-widest mt-1">Wickets</p>
                                </div>
                            </div>
                        </div>
                        ))}
                    </div>
                    ) : (
                        <EmptyState message="No Bowling Stats Found" icon={<Target className="opacity-20" />} />
                    )}
                </section>
            </div>

            <div className="space-y-10 pb-10">
                {inactivePlayers.length > 0 && (
                    <section className="space-y-3 px-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest flex items-center gap-2">
                            <Coffee size={14} /> Reserved / No Action
                        </h4>
                        <div className="flex flex-wrap gap-2">
                            {inactivePlayers.map((name: any, idx: any) => (
                                <span key={idx} className="px-3 py-2 bg-white dark:bg-slate-800 rounded-2xl text-[9px] font-bold uppercase text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800 shadow-sm">
                                    {cleanName(name)}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {unlistedPlayers.length > 0 && (
                <section className="space-y-4 px-2">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                        <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">New Talent Sync</h4>
                        <span className="text-[8px] font-bold text-slate-300 uppercase">Awaiting Registration</span>
                    </div>
                    <div className="space-y-2">
                        {unlistedPlayers.map((name: any, idx: any) => (
                            <div key={idx} className="flex justify-between items-center py-2">
                                <div className="flex flex-col">
                                    <span className="text-xs font-bold uppercase dark:text-slate-300 tracking-tight">{cleanName(name)}</span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Not in system</span>
                                </div>
                                <button 
                                    onClick={(e) => { e.preventDefault(); onAddPlayer(name); }}
                                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-indigo-500 hover:text-white dark:hover:bg-indigo-600 transition-all rounded-xl text-[9px] font-black uppercase tracking-widest dark:text-slate-400"
                                >
                                    Add Player
                                </button>
                            </div>
                        ))}
                    </div>
                </section>
                )}
            </div>
          </div>

          <div className="p-8 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800/50 backdrop-blur-xl">
            {isTemp ? (
              <button onClick={() => confirmMatch(data.tempId)} className={`w-full ${activeTheme.primary} text-white py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] shadow-[0_12px_24px_-8px_rgba(79,70,229,0.5)] active:scale-[0.98] transition-all flex items-center justify-center gap-3`}>
                <Check size={18} /> Authenticate & Log Match
              </button>
            ) : (
              <button onClick={onClose} className="w-full bg-slate-100 dark:bg-slate-800 dark:text-slate-300 py-5 rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] hover:bg-slate-200 dark:hover:bg-slate-700 transition-all">
                Dismiss Report
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const EmptyState = ({ message, icon }: { message: string; icon: React.ReactNode }) => (
    <div className="p-12 text-center bg-white dark:bg-slate-800/30 rounded-[2rem] border-2 border-dashed border-slate-100 dark:border-slate-800/50">
        <div className="w-16 h-16 bg-slate-50 dark:bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
            {icon}
        </div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{message}</p>
    </div>
  );

  return (
    <div className={isDarkMode ? 'dark' : ''}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Lexend+Deca:wght@400;700;900&display=swap');
        * { font-family: 'Plus Jakarta Sans', sans-serif; }
        h1, h2, h3, h4, .font-heavy { font-family: 'Lexend Deca', sans-serif; }
      `}</style>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-36 transition-colors">
        <Header />
        <main className="max-w-md mx-auto p-6">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <div className={`${activeTheme.primary} rounded-[2.5rem] p-10 text-white shadow-2xl text-center relative overflow-hidden group`}>
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000"></div>
                <p className="text-[10px] font-black uppercase opacity-60 tracking-[0.3em]">Season Success Ratio</p>
                <p className="text-8xl font-black tracking-tighter mt-2 font-heavy">{matches.length > 0 ? (matches.filter(m => m.matchResult === 'Won').length / matches.length * 100).toFixed(0) : 0}%</p>
                <div className="mt-6 flex justify-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-white/40"></div>
                    <div className="w-1 h-1 rounded-full bg-white/40"></div>
                    <div className="w-1 h-1 rounded-full bg-white/40"></div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center shadow-lg transition-all hover:scale-105">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Campaigns</p>
                   <p className="text-4xl font-black dark:text-white font-heavy">{matches.length}</p>
                </div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 text-center shadow-lg transition-all hover:scale-105">
                   <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Activity Score</p>
                   <p className="text-4xl font-black dark:text-white font-heavy">{(playerStats.reduce((a,b) => a+b.totalPoints,0) / (players.length * matches.length || 1)).toFixed(1)}</p>
                </div>
              </div>
            </div>
          )}

          {view === 'matches' && (
            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-6 px-2">Historical Log</h2>
              {matches.map(m => (
                <div key={m.id} onClick={() => setSelectedMatch(m)} className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:border-indigo-500/50 hover:shadow-2xl transition-all active:scale-[0.98] group">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${m.matchResult === 'Won' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500' : 'bg-rose-50 dark:bg-rose-900/20 text-rose-500'} flex items-center justify-center`}>
                        {m.matchResult === 'Won' ? <Trophy size={20} /> : <X size={20} />}
                    </div>
                    <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">{m.date}</p>
                        <h3 className="text-sm font-black dark:text-white uppercase tracking-tight group-hover:text-indigo-500 transition-colors">vs {m.opponent}</h3>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-200 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              ))}
              {matches.length === 0 && <EmptyState message="The match archive is empty" icon={<Clock size={28} />} />}
            </div>
          )}

          {view === 'planner' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="py-20 text-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
                 <Sparkles size={48} className="mx-auto text-slate-200 dark:text-slate-800 mb-6" />
                 <h2 className="text-lg font-black dark:text-white uppercase tracking-tight mb-2">Planner Reset</h2>
                 <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Ready for your next campaign instructions</p>
               </div>
            </div>
          )}

          {view === 'squad' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-6 px-2">
                <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em]">Active Roster</h2>
                <button onClick={() => setSquadSort(squadSort === 'name-asc' ? 'name-desc' : 'name-asc')} className="text-slate-400 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"><SortAsc size={18} /></button>
              </div>
              {playerStats.sort((a,b) => squadSort === 'name-asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)).map(p => (
                <div key={p.id} className="bg-white dark:bg-slate-900 p-5 rounded-[2rem] border border-slate-100 dark:border-slate-800 flex justify-between items-center group shadow-md transition-all hover:shadow-xl">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${activeTheme.primary} rounded-2xl flex items-center justify-center text-white text-[12px] font-black shadow-lg`}>{p.name.charAt(0)}</div>
                    <span className="text-sm font-bold uppercase dark:text-slate-200 tracking-tight">{p.name}</span>
                  </div>
                  <button onClick={() => setPlayers(players.filter(x => x.id !== p.id))} className="p-3 text-slate-200 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-all active:scale-90"><Trash2 size={18} /></button>
                </div>
              ))}
            </div>
          )}

          {view === 'fairness' && (
            <div className="space-y-4">
              <h2 className="text-[10px] font-black uppercase text-slate-400 tracking-[0.4em] mb-6 px-2">Performance Audit</h2>
              {playerStats.sort((a,b) => b.totalPoints - a.totalPoints).map((p, idx) => (
                <div key={p.id} className={`bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 overflow-hidden transition-all shadow-lg ${expandedPlayerId === p.id ? 'ring-2 ring-indigo-500/20' : ''}`}>
                  <div className="p-6 flex justify-between items-center cursor-pointer active:bg-slate-50 dark:active:bg-slate-800 transition-colors" onClick={() => setExpandedPlayerId(expandedPlayerId === p.id ? null : p.id)}>
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white text-[12px] ${idx === 0 ? 'bg-amber-500 shadow-amber-500/40 shadow-lg' : activeTheme.primary}`}>{idx + 1}</div>
                        <div>
                            <p className="text-sm font-black uppercase dark:text-white tracking-tight">{p.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.totalPlayed} Matches Played</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-5">
                        <div className="text-right">
                            <span className={`text-xl font-black ${activeTheme.textPrimary}`}>{p.totalPoints}</span>
                            <p className="text-[8px] text-slate-300 font-black uppercase tracking-widest leading-none">Pts</p>
                        </div>
                        <ChevronDown size={18} className={`text-slate-300 transition-transform duration-300 ${expandedPlayerId === p.id ? 'rotate-180 text-indigo-500' : ''}`} />
                    </div>
                  </div>
                  {expandedPlayerId === p.id && (
                    <div className="px-6 pb-6 pt-2 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-950/20">
                      {p.matchBreakdown.length === 0 ? (
                        <p className="text-[9px] text-slate-400 font-black uppercase text-center py-4 tracking-widest italic">No match data found</p>
                      ) : (
                          <div className="space-y-2">
                             {p.matchBreakdown.map((mb, i) => (
                                <div key={i} className="flex justify-between items-center p-3 bg-white dark:bg-slate-900 rounded-2xl text-[10px] font-bold uppercase tracking-widest border border-slate-100 dark:border-slate-800 shadow-sm">
                                    <span className="text-slate-500 dark:text-slate-400">vs {mb.opponent}</span>
                                    <span className={`font-black ${activeTheme.textPrimaryDark}`}>+{mb.points}</span>
                                </div>
                            ))}
                          </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-slate-100 dark:border-slate-800 px-6 py-4 flex justify-around items-end z-40 transition-all">
          <NavBtn label="Dashboard" active={view === 'dashboard'} activeTheme={activeTheme} icon={<BarChart3 size={24} />} onClick={() => setView('dashboard')} />
          <NavBtn label="Matches" active={view === 'matches'} activeTheme={activeTheme} icon={<ClipboardList size={24} />} onClick={() => setView('matches')} />
          <NavBtn label="Planner" active={view === 'planner'} activeTheme={activeTheme} icon={<LayoutGrid size={24} />} onClick={() => setView('planner')} />
          
          <div className="relative -top-8 group">
            <input type="file" id="pdf-upload" className="hidden" accept="application/pdf" multiple onChange={handleFileUpload} />
            <label htmlFor="pdf-upload" className={`w-16 h-16 ${activeTheme.primary} rounded-[2rem] flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 hover:scale-110 active:scale-95 transition-all cursor-pointer border-4 border-white dark:border-slate-900`}>
                <Plus size={28} />
            </label>
            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl">
               Add Match
            </div>
          </div>
          
          <NavBtn label="Squad" active={view === 'squad'} activeTheme={activeTheme} icon={<Users size={24} />} onClick={() => setView('squad')} />
          <NavBtn label="Audit" active={view === 'fairness'} activeTheme={activeTheme} icon={<Scale size={24} />} onClick={() => setView('fairness')} />
        </nav>

        {isProcessing && (
            <div className="fixed inset-0 bg-slate-950/90 z-[200] flex flex-col items-center justify-center text-white backdrop-blur-xl">
                <div className="relative">
                    <div className="absolute inset-0 bg-indigo-500 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                    <Loader2 className="animate-spin text-indigo-500 relative z-10" size={64} />
                </div>
                <p className="text-[11px] font-black uppercase tracking-[0.5em] mt-8 text-indigo-400 animate-pulse">Decrypting PDF Data</p>
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-2">Moonwalker Intel Engine</p>
            </div>
        )}
        
        {extractedQueue.length > 0 && (
          <MatchDetailPanel 
            data={extractedQueue[0]} 
            onClose={() => setExtractedQueue(prev => prev.slice(1))} 
            title="Extraction Verification" 
            players={players}
            onAddPlayer={addToSquad}
            activeTheme={activeTheme}
          />
        )}
        
        {selectedMatch && (
          <MatchDetailPanel 
            data={selectedMatch} 
            onClose={() => setSelectedMatch(null)} 
            title="Intel Summary" 
            players={players}
            onAddPlayer={addToSquad}
            activeTheme={activeTheme}
          />
        )}
      </div>
    </div>
  );
};

const NavBtn = ({ active, activeTheme, icon, onClick, label }: { active: boolean; activeTheme: Theme; icon: React.ReactElement; onClick: () => void; label: string }) => (
  <button 
    onClick={onClick} 
    className={`p-4 transition-all rounded-3xl relative group ${active ? `${activeTheme.navActive} scale-110` : 'text-slate-400 dark:text-slate-600 hover:text-slate-500'}`}
  >
    {/* Tooltip */}
    <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-800 dark:bg-slate-700 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap shadow-xl transform translate-y-2 group-hover:translate-y-0">
        {label}
        {/* Tooltip Arrow */}
        <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45"></div>
    </div>

    {React.cloneElement(icon, { strokeWidth: active ? 2.5 : 2 } as any)}
    {active && <div className={`w-1 h-1 ${activeTheme.primary} rounded-full mx-auto mt-1`} />}
  </button>
);

export default App;
