"use client";

// The club look: v2's layout (navy banner, colourful tiles) in the Moonwalkers
// kit colours. Navy from the shirts, red from the trousers and shoulder
// pattern, orange from the logo's outline. Red stays an accent so it never
// reads as a lost match.

import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { createContext, useContext } from "react";

export const KIT = {
  navy0: "#0B0F2E",
  navy1: "#1B2150",
  navy2: "#2A3275",
  navy3: "#4A56A8",
  red: "#D7192D",
  redDark: "#8E0E1C",
  redLight: "#F2545F",
  orange: "#F5A31A",
  orangeDark: "#B96A00",
  orangeLight: "#FFD27A",
  green: "#22C55E",
  greenDark: "#118D57",
  greenLight: "#77ED8B"
} as const;

export const NAVY_GRADIENT = `linear-gradient(135deg, ${KIT.navy0} 0%, ${KIT.navy1} 58%, ${KIT.navy2} 100%)`;

/** Where a page is drawn: inside the app shell, or on the signed-out card. */
export const ShellContext = createContext<{ bare: boolean; eyebrow: string }>({ bare: false, eyebrow: "Team space" });
export const useShell = () => useContext(ShellContext);

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Box
      component="img"
      src="/moonwalkers-logo.png"
      alt="Moonwalkers logo"
      sx={{ width: size, height: size * 1.08, objectFit: "contain", flexShrink: 0, filter: "drop-shadow(0 2px 6px rgba(0,0,0,.25))" }}
    />
  );
}

/** Red cross marks and the jersey's shoulder flare, drawn behind the banner text. */
function BannerDecoration() {
  return (
    <Box
      component="svg"
      viewBox="0 0 400 140"
      preserveAspectRatio="xMaxYMid slice"
      aria-hidden
      sx={{ position: "absolute", right: 0, top: 0, width: "60%", height: "100%", pointerEvents: "none" }}
    >
      <path d="M400 0h-70c-10 22 4 34-14 52 22-4 30 10 50-6 6 16 22 14 34 4z" fill="rgba(215,25,45,.22)" />
      <path d="M400 140h-46c8-14-2-24 12-36 10 10 22 4 34 12z" fill="rgba(215,25,45,.22)" />
      <path d="M290 22v40M270 42h40M318 92v20M308 102h20" stroke="rgba(215,25,45,.75)" strokeWidth={1.3} fill="none" />
      <path d="M200 60v44M178 82h44M120 100h70" stroke="rgba(255,255,255,.16)" strokeWidth={1.3} fill="none" />
    </Box>
  );
}

export function Banner({
  eyebrow,
  title,
  subtitle,
  actions,
  logo,
  square
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  logo?: boolean;
  square?: boolean;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        overflow: "hidden",
        borderRadius: square ? 0 : 2.5,
        px: { xs: 2, sm: 3 },
        py: { xs: 2, sm: 2.5 },
        color: "common.white",
        background: NAVY_GRADIENT,
        border: square ? 0 : "1px solid rgba(120,130,210,.22)",
        borderBottom: `3px solid ${KIT.red}`,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 2
      }}
    >
      <BannerDecoration />
      <Stack direction="row" spacing={2} sx={{ position: "relative", zIndex: 1, alignItems: "center", minWidth: 0, flex: "1 1 260px" }}>
        {logo && <Logo size={60} />}
        <Box sx={{ minWidth: 0 }}>
          <Typography
            component="div"
            sx={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}
          >
            {eyebrow}
          </Typography>
          <Typography variant="h3" component="h1" sx={{ fontSize: { xs: 24, sm: 30 }, lineHeight: 1.15, my: 0.5, overflowWrap: "anywhere" }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography component="div" sx={{ color: "rgba(255,255,255,.8)", fontSize: 14, maxWidth: "60ch" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      {actions && (
        <Stack direction="row" spacing={1} sx={{ position: "relative", zIndex: 1, flexWrap: "wrap", alignItems: "center", gap: 1 }}>
          {actions}
        </Stack>
      )}
    </Box>
  );
}

type TileColor = "navy" | "green" | "orange" | "red";
const TILE_GRADIENT: Record<TileColor, string> = {
  navy: `linear-gradient(135deg, ${KIT.navy1}, ${KIT.navy2} 55%, ${KIT.navy3})`,
  green: `linear-gradient(135deg, ${KIT.greenDark}, ${KIT.green} 55%, ${KIT.greenLight})`,
  orange: `linear-gradient(135deg, ${KIT.orangeDark}, ${KIT.orange} 55%, ${KIT.orangeLight})`,
  red: `linear-gradient(135deg, ${KIT.redDark}, ${KIT.red} 55%, ${KIT.redLight})`
};

/** v2's colourful headline tile: gradient top with icon, label and value; caption strip below. */
export function StatTile({
  color,
  icon,
  label,
  value,
  caption
}: {
  color: TileColor;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
}) {
  return (
    <Box sx={{ borderRadius: 2.5, overflow: "hidden", bgcolor: "background.paper", border: 1, borderColor: "divider", display: "flex", flexDirection: "column" }}>
      <Box
        sx={{
          position: "relative",
          color: "common.white",
          background: TILE_GRADIENT[color],
          px: 1.75,
          pt: 1.5,
          pb: 1.75,
          "&::after": {
            content: '""',
            position: "absolute",
            inset: 0,
            background: "radial-gradient(circle at top right, rgba(255,255,255,.16), transparent 32%)",
            pointerEvents: "none"
          }
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Box sx={{ width: 26, height: 26, borderRadius: "50%", bgcolor: "rgba(255,255,255,.2)", display: "grid", placeItems: "center", "& svg": { fontSize: 15 } }}>
            {icon}
          </Box>
          <Typography component="div" sx={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            {label}
          </Typography>
        </Stack>
        <Typography component="div" variant="h4" sx={{ textAlign: "center", mt: 1, fontSize: { xs: 20, sm: 26 }, lineHeight: 1.15, overflowWrap: "anywhere" }}>
          {value}
        </Typography>
      </Box>
      {caption && (
        <Typography
          component="div"
          sx={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", textAlign: "center", color: "text.secondary", px: 1, py: 0.9 }}
        >
          {caption}
        </Typography>
      )}
    </Box>
  );
}

/** v2's plain summary card: small label, big number, one line of context. */
export function StatCard({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Box sx={{ bgcolor: "background.paper", border: 1, borderColor: "divider", borderRadius: 2, px: 1.75, py: 1.5, minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h5" component="div" sx={{ my: 0.25, overflowWrap: "anywhere" }}>
        {value}
      </Typography>
      {note && (
        <Typography variant="caption" color="text.secondary" component="div">
          {note}
        </Typography>
      )}
    </Box>
  );
}

/** Four tiles in a row on wide screens, two on phones. */
export function TileGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" } }}>{children}</Box>
  );
}

/** Season picker styled for the navy banner. */
export const bannerSelectSx = {
  minWidth: 150,
  "& .MuiInputLabel-root, & .MuiInputLabel-root.Mui-focused": { color: "rgba(255,255,255,.7)" },
  "& .MuiOutlinedInput-root": { color: "common.white", bgcolor: "rgba(11,15,46,.35)" },
  "& .MuiOutlinedInput-notchedOutline, & .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,.28)" },
  "& .MuiSvgIcon-root": { color: "rgba(255,255,255,.7)" }
} as const;
