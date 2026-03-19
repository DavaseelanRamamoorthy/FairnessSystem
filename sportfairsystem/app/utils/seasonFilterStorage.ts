"use client";

export function readStoredSeasonFilter(storageKey: string) {
  if (typeof window === "undefined") {
    return "";
  }

  return window.sessionStorage.getItem(storageKey) ?? "";
}

export function storeSeasonFilter(storageKey: string, seasonValue: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(storageKey, seasonValue);
}
