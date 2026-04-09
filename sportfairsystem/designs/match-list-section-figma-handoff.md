# Match List Section Figma Handoff

This handoff covers the full `Match List` section on the Matches page.

## Goal

Replace the current table-like list with a cleaner card-based browsing experience while keeping:

- left filter panel
- right match browsing panel
- 3 cards per page
- pagination at the bottom of the right panel only
- no internal scroll inside the card list

## Frame Setup

- Desktop frame: `1600 x 760`
- Section container width: full content width
- Section container radius: `24`
- Section border: `1`
- Section background: `#121A2B`

## Section Layout

- Desktop split: `24% / 76%`
- Left panel: Filters
- Right panel: Match cards
- Column divider: `1px`
- Outer overflow: hidden

## Left Panel

### Panel

- Width: `280-320`
- Padding: `20`
- Background: `#182235`
- Border-right: `1px solid #2A3550`

### Header

- Label: `FILTERS`
- Font size: `12`
- Font weight: `800`
- Letter spacing: `1`
- Color: `#98A7C7`

### Controls

Controls in this order:

1. Result
2. Season
3. Group By

Each select:

- Height: `48`
- Radius: `12`
- Fill: `#1B2436`
- Border: `1px solid #34405D`
- Text: `#F4F7FF`
- Label color: `#9BA8C7`
- Vertical gap: `12`

## Right Panel

### Panel

- Padding X: `24`
- Padding top: `20`
- Padding bottom: `16`
- Background: `#121A2B`

### Header Block

Title:

- Text: `Match List`
- Font size: `12`
- Font weight: `800`
- Letter spacing: `1`
- Color: `#98A7C7`

Helper:

- Text: `Recent scorecards with clearer match-by-match scanning`
- Font size: `14`
- Font weight: `400`
- Color: `#AEB9D4`

Header bottom spacing: `16`

## Match Card Stack

- Cards per page: `3`
- Gap between cards: `12`

## Match Card

### Card Shell

- Height: `92-96`
- Radius: `20`
- Padding: `16`
- Border: `1px solid #2C3750`
- Fill: `#172133`
- Hover fill: `#1B2740`
- Selected border: `#3B82F6`
- Selected fill: `rgba(59,130,246,0.12)`

### Card Layout

Desktop structure:

- Left side: match info
- Right side: result chip
- Two-row information hierarchy

Visual sketch:

```text
 ---------------------------------------------------------
| BISKUT                                       [Lost]     |
| 05 Apr 2026                                  AE050426+1 |
 ---------------------------------------------------------
```

### Typography

Opponent:

- Size: `18`
- Weight: `800`
- Color: `#F7F9FF`

Date:

- Size: `14`
- Weight: `500`
- Color: `#B4BED7`

Match code:

- Size: `13`
- Weight: `500`
- Color: `#8F9CBA`

### Result Chips

Height: `28`

Padding:

- Horizontal: `12`

Radius:

- Pill

Won:

- Fill: `#22C55E`
- Text: `#FFFFFF`

Lost:

- Fill: `#EF4444`
- Text: `#FFFFFF`

Tie:

- Fill: `#06B6D4`
- Text: `#FFFFFF`

Draw:

- Fill: `#F59E0B`
- Text: `#111827`

Unknown:

- Fill: `#475569`
- Text: `#FFFFFF`

## Card States

### Default

- Border: standard divider
- Surface: base dark card

### Hover

- Slightly brighter fill
- Same structure

### Selected

- Primary blue border
- Slight blue-tinted background
- Optional very soft glow

## Pagination Footer

Placement:

- Bottom of the right panel only

Structure:

- Left: page count summary
- Right: `Previous` and `Next`

Text format:

- `1 of 12`

Do not use:

- `1-3 of 12`

Footer spacing:

- Top divider before pagination
- Footer top padding: `12`

Buttons:

- Height: `38`
- Radius: `12`
- Outline style

## Responsive Behavior

### Tablet

- Filters stack on top
- Match list below
- Cards remain stacked
- Result chip stays top-right

### Mobile

- Filters stacked vertically
- Cards full width
- Opponent first row
- Date second row
- Match code third row if needed
- Result chip still visible but compact

Mobile sketch:

```text
 -------------------------------
| BISKUT                [Lost]  |
| 05 Apr 2026                  |
| AE050426+1                  |
 -------------------------------
```

## Spacing System

- 8: tight spacing
- 12: standard control/card gap
- 16: panel/card padding
- 20-24: section spacing

## Color Tokens

- Page background: `#0B1220`
- Section surface: `#121A2B`
- Left filter panel: `#182235`
- Card surface: `#172133`
- Divider: `#2A3550`
- Primary text: `#F7F9FF`
- Secondary text: `#AEB9D4`
- Muted text: `#8F9CBA`
- Selected accent: `#3B82F6`

## Components To Build In Figma

1. `Matches / Filter Panel`
2. `Matches / Card / Default`
3. `Matches / Card / Hover`
4. `Matches / Card / Selected`
5. `Matches / Result Chip / Won`
6. `Matches / Result Chip / Lost`
7. `Matches / Result Chip / Tie`
8. `Matches / Result Chip / Draw`
9. `Matches / Pagination Footer`

## Suggested Build Order

1. Create the full desktop frame
2. Build the 24/76 split
3. Build left filter panel component
4. Build one match card component
5. Turn the match card into variants
6. Build pagination footer
7. Duplicate three cards for the section
8. Create tablet and mobile adaptations
