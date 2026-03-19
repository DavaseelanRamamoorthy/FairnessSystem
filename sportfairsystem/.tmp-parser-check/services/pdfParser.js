"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMatchFromBase64 = parseMatchFromBase64;
exports.parseMatchFromPageTexts = parseMatchFromPageTexts;
const matchTextNormalization_1 = require("./matchTextNormalization");
const TEAM_NAME_PATTERN = String.raw `[A-Za-z0-9][A-Za-z0-9\s().&'/-]{0,79}`;
const OVERS_PATTERN = String.raw `\d+(?:\.\d+)?`;
const INNINGS_LABEL_PATTERN = String.raw `(?:1st|2nd|3rd|4th)\s+Innings`;
const PDF_LINE_Y_TOLERANCE = 2;
const PDF_SMALL_GAP_THRESHOLD = 6;
const PDF_WIDE_GAP_THRESHOLD = 28;
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getKnownTeamNames(teamNames) {
    return Array.from(new Set(teamNames
        .map((teamName) => (0, matchTextNormalization_1.normalizeMatchWhitespace)(teamName ?? ""))
        .filter(Boolean)));
}
function buildInningsHeaderPattern(teamNames) {
    const knownTeamNames = getKnownTeamNames(teamNames);
    const teamPattern = knownTeamNames.length > 0
        ? knownTeamNames
            .sort((first, second) => second.length - first.length)
            .map((teamName) => escapeRegex(teamName))
            .join("|")
        : TEAM_NAME_PATTERN;
    return String.raw `(?:${teamPattern})\s+\d+\/\d+\s+\(${OVERS_PATTERN}\s+Ov\.?\)\s*\(${INNINGS_LABEL_PATTERN}\)`;
}
function extractInningsTeamName(block, teamNames) {
    const normalizedBlock = (0, matchTextNormalization_1.normalizeMatchWhitespace)(block);
    const knownTeamNames = getKnownTeamNames(teamNames);
    const explicitMatch = knownTeamNames.find((teamName) => normalizedBlock.startsWith(`${teamName} `));
    if (explicitMatch) {
        return explicitMatch;
    }
    const fallbackMatch = block.match(new RegExp(String.raw `^(${TEAM_NAME_PATTERN})\s+\d+\/\d+\s+\(${OVERS_PATTERN}\s+Ov\.?\)\s*\(${INNINGS_LABEL_PATTERN}\)`, "i"));
    return fallbackMatch ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(fallbackMatch[1]) : null;
}
function uniquePlayerNames(names) {
    const seen = new Set();
    const uniqueNames = [];
    names.forEach((name) => {
        const normalizedName = (0, matchTextNormalization_1.normalizeLooseTextKey)(name ?? "");
        if (!normalizedName || seen.has(normalizedName)) {
            return;
        }
        seen.add(normalizedName);
        uniqueNames.push((0, matchTextNormalization_1.stripNameAnnotations)(name ?? ""));
    });
    return uniqueNames;
}
function parseBattingDismissal(body) {
    const normalizedBody = (0, matchTextNormalization_1.normalizeMatchWhitespace)(body);
    const groupedNameMatch = normalizedBody.match(/^(.+?(?:\([^)]*\))+)\s+(.+)$/);
    if (groupedNameMatch) {
        return {
            rawName: (0, matchTextNormalization_1.normalizeMatchWhitespace)(groupedNameMatch[1]),
            dismissal: (0, matchTextNormalization_1.normalizeMatchWhitespace)(groupedNameMatch[2])
        };
    }
    const dismissalIndex = normalizedBody.search(/\s+(?:not out|b\s|c\s|lbw\b|st\s|run out\b|retired\b|hit wicket\b|absent hurt\b)/i);
    if (dismissalIndex !== -1) {
        return {
            rawName: (0, matchTextNormalization_1.normalizeMatchWhitespace)(normalizedBody.slice(0, dismissalIndex)),
            dismissal: (0, matchTextNormalization_1.normalizeMatchWhitespace)(normalizedBody.slice(dismissalIndex))
        };
    }
    return {
        rawName: normalizedBody,
        dismissal: "not out"
    };
}
function getBattingStyleFromRawName(rawName) {
    const annotationMatches = Array.from(rawName.matchAll(/\(([^()]*)\)/g));
    const battingStyle = annotationMatches.at(-1)?.[1]?.trim() ?? "";
    return battingStyle || null;
}
function extractTeamsFromFirstPage(firstPageText) {
    const lines = firstPageText
        .split(/\r?\n/)
        .map((line) => (0, matchTextNormalization_1.normalizeMatchWhitespace)(line))
        .filter(Boolean);
    const matchLineIndex = lines.findIndex((line, index) => {
        return line === "Match" && lines[index - 1] === "Match Details";
    });
    if (matchLineIndex === -1) {
        return {
            teamA: null,
            teamB: null
        };
    }
    const candidateLines = [];
    for (const line of lines.slice(matchLineIndex + 1)) {
        if (/^(Ground|Date|Match Result|Toss|Total|Result|Best Performances|Match Officials)\b/i.test(line)) {
            break;
        }
        candidateLines.push(line);
    }
    const singleLine = (0, matchTextNormalization_1.normalizeMatchWhitespace)(candidateLines.join(" "));
    const singleLineMatch = singleLine.match(/^(.*?)\s*vs\s*(.+)$/i);
    if (singleLineMatch) {
        return {
            teamA: (0, matchTextNormalization_1.normalizeMatchWhitespace)(singleLineMatch[1]),
            teamB: (0, matchTextNormalization_1.normalizeMatchWhitespace)(singleLineMatch[2])
        };
    }
    if (candidateLines.length >= 2) {
        const firstLine = candidateLines[0];
        const secondLine = candidateLines[1];
        const firstLineVsMatch = firstLine.match(/^(.*?)(?:\s*vs)\s*$/i);
        if (firstLineVsMatch) {
            return {
                teamA: (0, matchTextNormalization_1.normalizeMatchWhitespace)(firstLineVsMatch[1]),
                teamB: (0, matchTextNormalization_1.normalizeMatchWhitespace)(secondLine)
            };
        }
        if (/^vs$/i.test(firstLine) && candidateLines[2]) {
            return {
                teamA: (0, matchTextNormalization_1.normalizeMatchWhitespace)(secondLine),
                teamB: (0, matchTextNormalization_1.normalizeMatchWhitespace)(candidateLines[2])
            };
        }
    }
    return {
        teamA: null,
        teamB: null
    };
}
function extractWinner(resultSummary, fullText) {
    const summaryWinnerMatch = resultSummary?.match(/^(.+?)\s+won by\b/i);
    if (summaryWinnerMatch) {
        return (0, matchTextNormalization_1.normalizeMatchWhitespace)(summaryWinnerMatch[1]);
    }
    const resultMatch = fullText.match(/Result\s+([A-Za-z0-9\s().&'/-]+?)\s+won by/i);
    return resultMatch ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(resultMatch[1]) : null;
}
function normalizePdfToken(value) {
    return value.replace(/\s+/g, " ").trim();
}
function getPdfItemX(item) {
    return Array.isArray(item.transform) && typeof item.transform[4] === "number"
        ? item.transform[4]
        : null;
}
function getPdfItemY(item) {
    return Array.isArray(item.transform) && typeof item.transform[5] === "number"
        ? item.transform[5]
        : null;
}
function getPdfItemWidth(item, text) {
    return typeof item.width === "number" && Number.isFinite(item.width)
        ? item.width
        : Math.max(text.length * 3, 1);
}
function buildPageTextFromPdfItems(items) {
    const lines = [];
    let currentLine = "";
    let currentY = null;
    let currentRightEdge = null;
    const pushCurrentLine = () => {
        const normalizedLine = currentLine.trimEnd();
        if (normalizedLine) {
            lines.push(normalizedLine);
        }
        currentLine = "";
        currentY = null;
        currentRightEdge = null;
    };
    items.forEach((item) => {
        const text = normalizePdfToken(String(item.str ?? ""));
        if (!text) {
            if (item.hasEOL) {
                pushCurrentLine();
            }
            return;
        }
        const x = getPdfItemX(item);
        const y = getPdfItemY(item);
        const width = getPdfItemWidth(item, text);
        const startsNewLine = currentLine.length > 0
            && y !== null
            && currentY !== null
            && Math.abs(y - currentY) > PDF_LINE_Y_TOLERANCE;
        if (startsNewLine) {
            pushCurrentLine();
        }
        let separator = "";
        if (currentLine.length > 0) {
            if (x !== null && currentRightEdge !== null) {
                const gap = x - currentRightEdge;
                if (gap > PDF_WIDE_GAP_THRESHOLD) {
                    separator = "    ";
                }
                else if (gap > PDF_SMALL_GAP_THRESHOLD) {
                    separator = " ";
                }
            }
            else {
                separator = " ";
            }
        }
        currentLine = `${currentLine}${separator}${text}`;
        currentY = y ?? currentY ?? 0;
        currentRightEdge = x !== null
            ? x + width
            : (currentRightEdge ?? 0) + separator.length + width;
        if (item.hasEOL) {
            pushCurrentLine();
        }
    });
    pushCurrentLine();
    return lines.join("\n");
}
function parseBattingStats(block) {
    const battingSectionMatch = block.match(/No\s+Batsman\s+Status\s+R\s+B\s+M\s+4s\s+6s\s+SR\s+([\s\S]+?)\s+Extras:/i);
    if (!battingSectionMatch) {
        return [];
    }
    const battingSection = battingSectionMatch[1];
    const battingLines = battingSection
        .split(/\r?\n/)
        .map((line) => (0, matchTextNormalization_1.normalizeMatchWhitespace)(line))
        .filter((line) => /^\d+\s+/.test(line));
    if (battingLines.length > 0) {
        const parsedRows = battingLines.flatMap((line) => {
            const rowMatch = line.match(/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)$/);
            if (!rowMatch) {
                return [];
            }
            const battingPosition = parseInt(rowMatch[1], 10);
            const runsValue = parseInt(rowMatch[3], 10);
            const balls = parseInt(rowMatch[4], 10);
            const minutes = parseInt(rowMatch[5], 10);
            const fours = parseInt(rowMatch[6], 10);
            const sixes = parseInt(rowMatch[7], 10);
            const strikeRate = parseFloat(rowMatch[8]);
            if (Number.isNaN(battingPosition)
                || Number.isNaN(runsValue)
                || Number.isNaN(balls)
                || Number.isNaN(minutes)
                || Number.isNaN(fours)
                || Number.isNaN(sixes)
                || Number.isNaN(strikeRate)) {
                return [];
            }
            const parsedDismissal = parseBattingDismissal(rowMatch[2]);
            if (!parsedDismissal.rawName) {
                return [];
            }
            return [{
                    player_name: (0, matchTextNormalization_1.stripNameAnnotations)(parsedDismissal.rawName),
                    batting_position: battingPosition,
                    batting_style: getBattingStyleFromRawName(parsedDismissal.rawName),
                    isCaptain: (0, matchTextNormalization_1.hasCaptainMarker)(parsedDismissal.rawName),
                    isWicketKeeper: (0, matchTextNormalization_1.hasWicketKeeperMarker)(parsedDismissal.rawName),
                    dismissal: parsedDismissal.dismissal || "not out",
                    runs: runsValue,
                    balls,
                    minutes,
                    fours,
                    sixes,
                    strike_rate: strikeRate
                }];
        });
        if (parsedRows.length > 0) {
            return parsedRows;
        }
    }
    const rowRegex = /(\d+)\s+(.+?)(?=\s+\d+\s+[A-Za-z]|\s*$)/g;
    const battingStats = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(battingSection)) !== null) {
        const row = `${rowMatch[1]} ${rowMatch[2]}`.trim();
        const tokens = row.split(/\s+/);
        const battingPosition = parseInt(tokens.shift() ?? "", 10);
        const strikeRate = parseFloat(tokens.pop() ?? "");
        const sixes = parseInt(tokens.pop() ?? "", 10);
        const fours = parseInt(tokens.pop() ?? "", 10);
        const minutes = parseInt(tokens.pop() ?? "", 10);
        const balls = parseInt(tokens.pop() ?? "", 10);
        const runsValue = parseInt(tokens.pop() ?? "", 10);
        if (Number.isNaN(battingPosition)
            || Number.isNaN(strikeRate)
            || Number.isNaN(sixes)
            || Number.isNaN(fours)
            || Number.isNaN(minutes)
            || Number.isNaN(balls)
            || Number.isNaN(runsValue)
            || tokens.length === 0) {
            continue;
        }
        const dismissalTokens = [];
        while (tokens.length > 0 && !tokens[tokens.length - 1].includes("(")) {
            dismissalTokens.unshift(tokens.pop() ?? "");
        }
        const dismissal = (0, matchTextNormalization_1.normalizeMatchWhitespace)(dismissalTokens.join(" "));
        const battingStyleToken = tokens.pop() ?? "";
        const rawName = (0, matchTextNormalization_1.normalizeMatchWhitespace)(tokens.join(" "));
        if (!rawName) {
            continue;
        }
        battingStats.push({
            player_name: (0, matchTextNormalization_1.stripNameAnnotations)(rawName),
            batting_position: battingPosition,
            batting_style: battingStyleToken ? battingStyleToken.replace(/[()]/g, "") : null,
            isCaptain: (0, matchTextNormalization_1.hasCaptainMarker)(rawName),
            isWicketKeeper: (0, matchTextNormalization_1.hasWicketKeeperMarker)(rawName),
            dismissal: dismissal || "not out",
            runs: runsValue,
            balls,
            minutes,
            fours,
            sixes,
            strike_rate: strikeRate
        });
    }
    return battingStats;
}
function parseBowlingStats(block) {
    const bowlingSectionMatch = block.match(/No\s+Bowler\s+O\s+M\s+R\s+W\s+0s\s+4s\s+6s\s+WD\s+NB\s+ECO\s+([\s\S]+?)(?=Fall of Wickets|Yet To Bat|To Bat|Did Not Bat|$)/i);
    if (!bowlingSectionMatch) {
        return [];
    }
    const bowlingSection = bowlingSectionMatch[1];
    const rowRegex = /(\d+)\s+(.+?)\s+(\d+(?:\.\d+)?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)/g;
    const bowlingStats = [];
    let rowMatch;
    while ((rowMatch = rowRegex.exec(bowlingSection)) !== null) {
        bowlingStats.push({
            player_name: (0, matchTextNormalization_1.stripNameAnnotations)(rowMatch[2]),
            overs: parseFloat(rowMatch[3]),
            maidens: parseInt(rowMatch[4], 10),
            runs: parseInt(rowMatch[5], 10),
            wickets: parseInt(rowMatch[6], 10),
            dot_balls: parseInt(rowMatch[7], 10),
            fours_conceded: parseInt(rowMatch[8], 10),
            sixes_conceded: parseInt(rowMatch[9], 10),
            wides: parseInt(rowMatch[10], 10),
            no_balls: parseInt(rowMatch[11], 10),
            economy: parseFloat(rowMatch[12])
        });
    }
    return bowlingStats;
}
function extractCompetitionName(matchTitle) {
    if (!matchTitle) {
        return null;
    }
    const competitionMatch = matchTitle.match(/\(([^)]+)\)\s*$/);
    return competitionMatch ? competitionMatch[1].trim() : null;
}
function countVsOccurrences(value) {
    return (value.match(/\bvs\b/gi) ?? []).length;
}
function buildMatchTitle(rawTitle, teamA, teamB) {
    const normalizedRawTitle = rawTitle ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(rawTitle) : null;
    const competitionName = extractCompetitionName(normalizedRawTitle);
    if (!teamA || !teamB) {
        return normalizedRawTitle;
    }
    const canonicalTitle = competitionName
        ? `${teamA} vs ${teamB} (${competitionName})`
        : `${teamA} vs ${teamB}`;
    if (!normalizedRawTitle) {
        return canonicalTitle;
    }
    const normalizedTitleKey = (0, matchTextNormalization_1.normalizeLooseTextKey)(normalizedRawTitle);
    const teamAKey = (0, matchTextNormalization_1.normalizeLooseTextKey)(teamA);
    const teamBKey = (0, matchTextNormalization_1.normalizeLooseTextKey)(teamB);
    const hasTeamA = normalizedTitleKey.includes(teamAKey);
    const hasTeamB = normalizedTitleKey.includes(teamBKey);
    const vsCount = countVsOccurrences(normalizedRawTitle);
    if (!hasTeamA || !hasTeamB || vsCount !== 1) {
        return canonicalTitle;
    }
    return normalizedRawTitle;
}
function extractResultSummary(firstPageText) {
    const summaryBoundaryMatch = firstPageText.match(/\s(Best Performances|Match Officials)\b/i);
    const summaryBoundaryIndex = summaryBoundaryMatch?.index ?? firstPageText.length;
    const summarySection = firstPageText.slice(0, summaryBoundaryIndex);
    const resultMatches = Array.from(summarySection.matchAll(/(?:^|\s)Result\s+/gi));
    const lastResultMatch = resultMatches.at(-1);
    if (!lastResultMatch || lastResultMatch.index === undefined) {
        return null;
    }
    const resultStart = lastResultMatch.index + lastResultMatch[0].length;
    const rawSummary = summarySection.slice(resultStart).trim();
    return rawSummary ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(rawSummary) : null;
}
function parseMatchOfficials(pageText) {
    const officialsSectionMatch = pageText.match(/Match Officials\s+No\s+Name\s+Role\s+Signature\s+([\s\S]+)$/i);
    if (!officialsSectionMatch) {
        return [];
    }
    const officialsSection = officialsSectionMatch[1];
    const officials = [];
    const officialRegex = /(\d+)\s+(.+?)\s+(Scorer|Captain|Umpire|Organizer|Commentator)(?=\s+\d+\s+|$)/gi;
    let match;
    while ((match = officialRegex.exec(officialsSection)) !== null) {
        officials.push({
            name: (0, matchTextNormalization_1.stripNameAnnotations)(match[2]),
            role: (0, matchTextNormalization_1.normalizeMatchWhitespace)(match[3])
        });
    }
    return officials;
}
function parsePlayingSquadsFromCollapsedText(pageText, teamA, teamB) {
    const sectionStart = pageText.indexOf("Playing Squad");
    const section = pageText.slice(sectionStart);
    const startAfterHeader = (0, matchTextNormalization_1.normalizeMatchWhitespace)(section.replace(/^Playing Squad\s+/i, ""));
    if (!startAfterHeader.startsWith(teamA) && !startAfterHeader.startsWith(teamB)) {
        return [];
    }
    const firstTeamName = startAfterHeader.startsWith(teamA) ? teamA : teamB;
    const secondTeamName = firstTeamName === teamA ? teamB : teamA;
    const afterTeamHeaders = startAfterHeader
        .replace(firstTeamName, "")
        .replace(secondTeamName, "")
        .trim();
    const rowRegex = /(\d{1,2})\s+(.+?)\s{2,}(.+?)(?=\s+\d{1,2}\s+|$)/g;
    const firstTeamPlayers = [];
    const secondTeamPlayers = [];
    const parseSquadPlayer = (rawName, playerOrder) => ({
        name: (0, matchTextNormalization_1.stripNameAnnotations)(rawName),
        playerOrder,
        isCaptain: (0, matchTextNormalization_1.hasCaptainMarker)(rawName),
        isWicketKeeper: (0, matchTextNormalization_1.hasWicketKeeperMarker)(rawName),
        battingStyle: null
    });
    let rowMatch;
    while ((rowMatch = rowRegex.exec(afterTeamHeaders)) !== null) {
        const playerOrder = parseInt(rowMatch[1], 10);
        firstTeamPlayers.push(parseSquadPlayer(rowMatch[2], playerOrder));
        secondTeamPlayers.push(parseSquadPlayer(rowMatch[3], playerOrder));
    }
    if (firstTeamPlayers.length === 0 || secondTeamPlayers.length === 0) {
        return [];
    }
    return [
        {
            teamName: firstTeamName,
            players: firstTeamPlayers
        },
        {
            teamName: secondTeamName,
            players: secondTeamPlayers
        }
    ];
}
function isPlayingSquadBoundary(line, teamNames) {
    const normalizedLine = (0, matchTextNormalization_1.normalizeMatchWhitespace)(line);
    if (!normalizedLine) {
        return false;
    }
    if (/^(Match Officials|Best Performances|No\s+Batsman|No\s+Bowler|Fall of Wickets|Yet To Bat|To Bat|Did Not Bat)\b/i.test(normalizedLine)) {
        return true;
    }
    return new RegExp(`^${buildInningsHeaderPattern(teamNames)}`, "i").test(normalizedLine);
}
function parsePlayingSquadRow(line) {
    const trimmedLine = line.trim();
    const rowMatch = trimmedLine.match(/^(\d{1,2})\s+(.+?)\s{2,}(.+)$/);
    if (!rowMatch) {
        return null;
    }
    const playerOrder = parseInt(rowMatch[1], 10);
    const firstPlayer = rowMatch[2].trim();
    const secondPlayer = rowMatch[3].replace(/^\d{1,2}\s+/, "").trim();
    if (Number.isNaN(playerOrder) || !firstPlayer || !secondPlayer) {
        return null;
    }
    return {
        playerOrder,
        firstPlayer,
        secondPlayer
    };
}
function parsePlayingSquads(pageText, teamA, teamB) {
    if (!teamA || !teamB || !pageText.includes("Playing Squad")) {
        return [];
    }
    const lines = pageText
        .split(/\r?\n/)
        .map((line) => line.trimEnd())
        .filter((line) => line.trim().length > 0);
    const headerIndex = lines.findIndex((line) => line.includes("Playing Squad"));
    if (headerIndex === -1) {
        return parsePlayingSquadsFromCollapsedText(pageText, teamA, teamB);
    }
    const linesAfterHeader = lines.slice(headerIndex + 1);
    const teamHeaderIndex = linesAfterHeader.findIndex((line) => {
        const normalizedLine = (0, matchTextNormalization_1.normalizeMatchWhitespace)(line);
        return normalizedLine.includes(teamA) && normalizedLine.includes(teamB);
    });
    if (teamHeaderIndex === -1) {
        return parsePlayingSquadsFromCollapsedText(pageText, teamA, teamB);
    }
    const teamHeaderLine = (0, matchTextNormalization_1.normalizeMatchWhitespace)(linesAfterHeader[teamHeaderIndex]);
    const firstTeamName = teamHeaderLine.indexOf(teamA) <= teamHeaderLine.indexOf(teamB) ? teamA : teamB;
    const secondTeamName = firstTeamName === teamA ? teamB : teamA;
    const firstTeamPlayers = [];
    const secondTeamPlayers = [];
    const parseSquadPlayer = (rawName, playerOrder) => ({
        name: (0, matchTextNormalization_1.stripNameAnnotations)(rawName),
        playerOrder,
        isCaptain: (0, matchTextNormalization_1.hasCaptainMarker)(rawName),
        isWicketKeeper: (0, matchTextNormalization_1.hasWicketKeeperMarker)(rawName),
        battingStyle: null
    });
    for (const line of linesAfterHeader.slice(teamHeaderIndex + 1)) {
        if (isPlayingSquadBoundary(line, [teamA, teamB])) {
            break;
        }
        const parsedRow = parsePlayingSquadRow(line);
        if (!parsedRow) {
            if (firstTeamPlayers.length > 0 || secondTeamPlayers.length > 0) {
                break;
            }
            continue;
        }
        firstTeamPlayers.push(parseSquadPlayer(parsedRow.firstPlayer, parsedRow.playerOrder));
        secondTeamPlayers.push(parseSquadPlayer(parsedRow.secondPlayer, parsedRow.playerOrder));
    }
    if (firstTeamPlayers.length === 0 || secondTeamPlayers.length === 0) {
        return parsePlayingSquadsFromCollapsedText(pageText, teamA, teamB);
    }
    return [
        {
            teamName: firstTeamName,
            players: firstTeamPlayers
        },
        {
            teamName: secondTeamName,
            players: secondTeamPlayers
        }
    ];
}
function parseExtrasBreakdown(block) {
    const extrasSectionMatch = block.match(/Extras:\s*\(([^)]*)\)\s*(\d+)/i);
    if (!extrasSectionMatch) {
        return {
            extras: 0,
            extrasBreakdown: {}
        };
    }
    const extrasText = extrasSectionMatch[1];
    const totalExtras = parseInt(extrasSectionMatch[2], 10);
    const extract = (label) => {
        const match = extrasText.match(label);
        return match ? parseInt(match[1], 10) : 0;
    };
    return {
        extras: totalExtras,
        extrasBreakdown: {
            byes: extract(/\bb\s*(\d+)/i),
            legByes: extract(/\blb\s*(\d+)/i),
            wides: extract(/\bwd\s*(\d+)/i),
            noBalls: extract(/\bnb\s*(\d+)/i)
        }
    };
}
function parseInningsBlocks(fullText, teamNames) {
    const inningsHeaderPattern = buildInningsHeaderPattern(teamNames);
    return fullText.match(new RegExp(String.raw `(${inningsHeaderPattern}[\s\S]+?)(?=${inningsHeaderPattern}|Match Officials|$)`, "gi")) ?? [];
}
function buildPlaying11(squadNames, battingNames, pendingBatters, bowlingNames) {
    return uniquePlayerNames([
        ...squadNames,
        ...battingNames,
        ...pendingBatters,
        ...bowlingNames
    ]);
}
function enrichPlaying11WithOppositionBowling(innings) {
    return innings.map((inningsSummary) => {
        if (!inningsSummary.teamName) {
            return inningsSummary;
        }
        const bowlingNamesForTeam = uniquePlayerNames(innings
            .filter((candidate) => candidate.teamName !== inningsSummary.teamName)
            .flatMap((candidate) => candidate.bowlingStats?.map((player) => player.player_name) ?? []));
        return {
            ...inningsSummary,
            playing11: buildPlaying11(inningsSummary.playing11 ?? [], [], [], bowlingNamesForTeam)
        };
    });
}
function buildFallbackSquads(innings) {
    return innings
        .filter((inningsSummary) => {
        return Boolean(inningsSummary.teamName && inningsSummary.playing11?.length);
    })
        .map((inningsSummary) => {
        const battingByName = new Map((inningsSummary.battingStats ?? []).map((player) => [
            (0, matchTextNormalization_1.normalizeLooseTextKey)(player.player_name),
            player
        ]));
        return {
            teamName: inningsSummary.teamName,
            players: (inningsSummary.playing11 ?? []).map((playerName, index) => {
                const battingPlayer = battingByName.get((0, matchTextNormalization_1.normalizeLooseTextKey)(playerName));
                return {
                    name: playerName,
                    playerOrder: index + 1,
                    isCaptain: battingPlayer?.isCaptain ?? false,
                    isWicketKeeper: battingPlayer?.isWicketKeeper ?? false,
                    battingStyle: battingPlayer?.batting_style ?? null
                };
            })
        };
    });
}
async function parseMatchFromBase64(base64Data, currentTeamName) {
    const pdfjsModule = await Promise.resolve().then(() => __importStar(require("pdfjs-dist/build/pdf.js")));
    const pdfjsLib = (pdfjsModule.default ?? pdfjsModule);
    const workerOptions = "GlobalWorkerOptions" in pdfjsLib
        ? pdfjsLib.GlobalWorkerOptions
        : null;
    if (typeof window !== "undefined" && workerOptions && typeof workerOptions === "object") {
        workerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    }
    const binary = atob(base64Data);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    const pdf = await pdfjsLib.getDocument({
        data: bytes,
        disableWorker: typeof window === "undefined"
    }).promise;
    const pageTexts = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = buildPageTextFromPdfItems(content.items);
        pageTexts.push(pageText);
    }
    return parseMatchFromPageTexts(pageTexts, currentTeamName);
}
function parseMatchFromPageTexts(pageTexts, currentTeamName) {
    const documentText = pageTexts.join("\n");
    const fullText = (0, matchTextNormalization_1.normalizeMatchWhitespace)(pageTexts.join(" "));
    const firstPageText = pageTexts[0] ?? "";
    const squadPageText = pageTexts.find((pageText) => pageText.includes("Playing Squad")) ?? "";
    const titleMatch = firstPageText.match(/^(.+?)\s+\d{1,2}\/\d{1,2}\/\d{2},/);
    const rawMatchTitle = titleMatch ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(titleMatch[1]) : null;
    const dateMatch = fullText.match(/Date\s+(\d{4}-\d{2}-\d{2})/);
    const matchDate = dateMatch ? dateMatch[1] : null;
    const extractedTeams = extractTeamsFromFirstPage(firstPageText);
    let teamA = extractedTeams.teamA;
    let teamB = extractedTeams.teamB;
    if (!teamA || !teamB) {
        const headerMatch = fullText.match(/Match\s+(?!Details)(.+?)\s*vs\s*(.+?)\s+Ground/i);
        if (headerMatch) {
            teamA = (0, matchTextNormalization_1.normalizeMatchWhitespace)(headerMatch[1]);
            teamB = (0, matchTextNormalization_1.normalizeMatchWhitespace)(headerMatch[2]);
        }
    }
    const matchTitle = buildMatchTitle(rawMatchTitle, teamA, teamB);
    const competitionName = extractCompetitionName(rawMatchTitle) ?? extractCompetitionName(matchTitle);
    const groundMatch = fullText.match(/Ground\s+(.+?)\s+Date/i);
    const ground = groundMatch ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(groundMatch[1]) : null;
    const tossMatch = fullText.match(/Toss\s+(.+?)\s+opt to\s+(bat|bowl)/i);
    const tossWinner = tossMatch ? (0, matchTextNormalization_1.normalizeMatchWhitespace)(tossMatch[1]) : null;
    const tossDecision = tossMatch ? tossMatch[2].toLowerCase() : null;
    const resultSummary = extractResultSummary(firstPageText);
    const winner = extractWinner(resultSummary, fullText);
    let matchResult = "Unknown";
    if (winner) {
        matchResult = (0, matchTextNormalization_1.normalizeLooseTextKey)(winner) === (0, matchTextNormalization_1.normalizeLooseTextKey)(currentTeamName) ? "Won" : "Lost";
    }
    const officials = parseMatchOfficials(firstPageText);
    const parsedSquads = parsePlayingSquads(squadPageText, teamA, teamB);
    const inningsSummaries = parseInningsBlocks(documentText, [teamA, teamB]).map((block, index) => {
        const teamName = extractInningsTeamName(block, [teamA, teamB]);
        const totalMatch = block.match(/Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)\s+\(CRR:\s*(\d+(\.\d+)?)\)/i);
        const fallbackTotalMatch = block.match(/Total:\s*Overs\s*(\d+(\.\d+)?)\s*,?\s*Wickets\s*(\d+)\s+(\d+)/i);
        const overs = totalMatch ? parseFloat(totalMatch[1]) : fallbackTotalMatch ? parseFloat(fallbackTotalMatch[1]) : null;
        const wickets = totalMatch ? parseInt(totalMatch[3], 10) : fallbackTotalMatch ? parseInt(fallbackTotalMatch[3], 10) : null;
        const runs = totalMatch ? parseInt(totalMatch[4], 10) : fallbackTotalMatch ? parseInt(fallbackTotalMatch[4], 10) : null;
        const crr = totalMatch ? parseFloat(totalMatch[5]) : null;
        const { extras, extrasBreakdown } = parseExtrasBreakdown(block);
        const battingStats = parseBattingStats(block);
        const bowlingStats = parseBowlingStats(block);
        const fallOfWickets = [];
        const fowSectionMatch = block.match(/Fall of Wickets\s+([\s\S]+?)(?=No\s+Bowler|$)/i);
        if (fowSectionMatch) {
            const fowRegex = /(\d+)-(\d+)\s*\(([^,]+),\s*(\d+(\.\d+)?)\s*ov\)/g;
            let match;
            while ((match = fowRegex.exec(fowSectionMatch[1])) !== null) {
                fallOfWickets.push({
                    score: parseInt(match[1], 10),
                    wicket_number: parseInt(match[2], 10),
                    batsman: (0, matchTextNormalization_1.stripNameAnnotations)(match[3]),
                    over: parseFloat(match[4])
                });
            }
        }
        const pendingBatters = (0, matchTextNormalization_1.parseDelimitedPlayerList)(block.match(/Yet\s+To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
            ?? block.match(/To\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
            ?? block.match(/Did\s+Not\s+Bat\s*:?\s*([\s\S]+?)(?=No\s+Bowler|Fall\s+of\s+Wickets|$)/i)?.[1]
            ?? "");
        const squadForTeam = parsedSquads.find((squad) => squad.teamName === teamName);
        const squadNames = squadForTeam?.players.map((player) => (0, matchTextNormalization_1.stripNameAnnotations)(player.name)) ?? [];
        const playing11 = buildPlaying11(squadNames, battingStats.map((player) => player.player_name), pendingBatters, []);
        return {
            innings_number: index + 1,
            teamName,
            runs,
            wickets,
            overs,
            extras,
            crr,
            extrasBreakdown,
            battingStats,
            bowlingStats,
            fallOfWickets,
            playing11
        };
    });
    const enrichedInningsSummaries = enrichPlaying11WithOppositionBowling(inningsSummaries);
    const squads = parsedSquads.length > 0 ? parsedSquads : buildFallbackSquads(enrichedInningsSummaries);
    return {
        matchTitle,
        competitionName,
        ground,
        matchDate,
        teamA,
        teamB,
        tossWinner,
        tossDecision,
        winner,
        matchResult,
        resultSummary,
        officials,
        squads,
        rawText: fullText,
        innings: enrichedInningsSummaries
    };
}
