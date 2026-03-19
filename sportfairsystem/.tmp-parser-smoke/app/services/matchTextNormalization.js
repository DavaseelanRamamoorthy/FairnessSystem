"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMatchWhitespace = normalizeMatchWhitespace;
exports.stripNameAnnotations = stripNameAnnotations;
exports.normalizeNameKey = normalizeNameKey;
exports.normalizeLooseTextKey = normalizeLooseTextKey;
exports.uniqueNameKeys = uniqueNameKeys;
exports.parseDelimitedPlayerList = parseDelimitedPlayerList;
exports.hasCaptainMarker = hasCaptainMarker;
exports.hasWicketKeeperMarker = hasWicketKeeperMarker;
const CAPTAIN_MARKER_REGEX = /\(\s*c(?:apt)?(?:ain)?(?:\s*&\s*wk)?\s*\)|\(\s*c\s*&/i;
const WICKET_KEEPER_MARKER_REGEX = /\(\s*wk\s*\)|\(\s*c\s*&\s*wk\s*\)/i;
function normalizeMatchWhitespace(value) {
    return value.replace(/\s+/g, " ").trim();
}
function stripNameAnnotations(name) {
    return normalizeMatchWhitespace(name
        .replace(/\(.*?\)/g, "")
        .replace(/[()]/g, ""));
}
function normalizeNameKey(name) {
    return stripNameAnnotations(name).toLowerCase();
}
function normalizeLooseTextKey(value) {
    return stripNameAnnotations(value)
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
function uniqueNameKeys(names) {
    return Array.from(new Set(names
        .map((name) => normalizeNameKey(name ?? ""))
        .filter(Boolean)));
}
function parseDelimitedPlayerList(listText) {
    return Array.from(new Set(listText
        .split(/\s*[,;]\s*/)
        .map((name) => stripNameAnnotations(name))
        .filter(Boolean)));
}
function hasCaptainMarker(rawName) {
    return CAPTAIN_MARKER_REGEX.test(rawName);
}
function hasWicketKeeperMarker(rawName) {
    return WICKET_KEEPER_MARKER_REGEX.test(rawName);
}
