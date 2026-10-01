Restyle every page/component in this admin panel to match the following design system. 
Do not change layout structure, routes, or logic — only apply these visual tokens and 
component patterns consistently across all pages (dashboard, tables, forms, settings, 
auth pages, modals, etc).

## Color tokens (CSS variables — add to global stylesheet / :root)

Light theme:
--bg: #F7EFE2;            /* page background, creamy */
--surface: #FFFBF3;        /* cards, panels */
--surface-2: #F1E5D2;      /* subtle fills, table header bg, hover states */
--border: #E2D2B8;
--border-soft: #ECDFC7;
--text: #2C201C;
--text-muted: #71594F;
--text-faint: #A18E7C;
--nav-bg: #2A1420;         /* sidebar — deep wine-black */
--nav-bg-hover: #3B1E2E;
--nav-text: #C6A5AB;
--nav-text-active: #FBF0E6;
--accent: #6E2140;         /* primary — bluish wine/maroon */
--accent-soft: #F1DCE2;
--accent-hover: #54172F;
--positive: #4C6E45;       /* success */
--positive-soft: #E7EEDF;
--negative: #A93A3A;       /* error/failed */
--negative-soft: #F5DED9;
--warn: #A5722A;           /* pending/warning */
--warn-soft: #F3E4C9;
--radius: 10px;
--shadow-card: 0 1px 2px rgba(60,30,20,0.05);

Dark theme (apply under a `[data-theme="dark"]` selector AND a 
`@media (prefers-color-scheme: dark)` fallback):
--bg: #160C10;
--surface: #20141A;
--surface-2: #2A1B22;
--border: #3C2530;
--border-soft: #301E27;
--text: #F2E4DA;
--text-muted: #B79A93;
--text-faint: #8A6F6A;
--nav-bg: #120A0E;
--nav-bg-hover: #28151E;
--accent: #B85C7C;
--accent-soft: #3A1F2A;
--accent-hover: #C97891;
--positive: #7FAE74;
--positive-soft: #20281C;
--negative: #DE7D7D;
--negative-soft: #33191A;
--warn: #D6A85A;
--warn-soft: #332413;

Rule: never hardcode hex colors in components — always reference the CSS variables 
above, so the theme toggle works everywhere.

## Typography
- Font: 'Inter' for all UI text (headings, body, labels, buttons).
- Font: 'IBM Plex Mono' only for numeric/tabular data — table amounts, IDs, order 
  numbers, timestamps in tables.
- Headings: 700–800 weight, letter-spacing -0.01 to -0.02em (tight, not loose).
- Body/labels: 400–600 weight, no all-caps labels, no letter-spacing tricks.
- Sizes: page title ~21px/700, panel headers ~14.5px/700, body ~13–13.5px/400-500, 
  small meta/labels ~11.5-12.5px.

## Layout pattern
- Fixed left sidebar, 232px wide, --nav-bg background, sticky, full height.
  - Sidebar sections grouped under small uppercase-free section labels (11px, 
    --text-faint, semibold).
  - Nav links: 8px vertical padding, 7px border-radius, icon (17x17 outline SVG, 
    stroke-width 2) + label, active/hover state uses --nav-bg-hover.
  - User block pinned to bottom of sidebar with a divider above it.
- Top bar: sticky, --bg background, bottom border --border-soft, contains breadcrumb, 
  search input (--surface bg, --border outline, 8px radius), notification/theme-toggle 
  icon buttons (34x34, --surface bg, --border outline), and one primary CTA button 
  (--accent bg, white text, 8px radius).
- Content padding: 24px 28px.
- Stat cards: 4-col grid, --surface bg, 1px --border, 10px radius, --shadow-card. 
  Each has: label + colored icon chip (soft bg + solid icon color) → big value 
  (24px/700) → delta badge (green up-arrow / red down-arrow, muted period text).
- Panels (charts, activity, tables): same card treatment (--surface, --border, 
  radius, shadow), header row with title + tab-group or meta text, internal 
  padding ~16-18px.
- Tables: header row --surface-2 bg with --border-soft top/bottom border, 
  11.5px/600 --text-faint labels; rows 12px vertical padding, hover → --surface-2; 
  status shown as pill badges (soft bg + solid dot + solid text color) using 
  positive/negative/warn tokens; monetary values in IBM Plex Mono.
- Buttons: primary = --accent bg / white text / 8px radius / --accent-hover on 
  hover. Icon-only buttons = --surface bg, --border outline, --text-muted icon, 
  --surface-2 on hover.
- Border-radius scale: 6-7px small controls, 8px inputs/buttons, 10px cards. 
  Don't apply one radius to everything indiscriminately — match what's above.

## Interaction details to replicate
- Theme toggle button in the top bar swaps `data-theme` on <html> between light/dark 
  and persists to localStorage.
- Tab-groups (segmented control: --surface-2 track, active tab gets --surface bg 
  + subtle shadow) used for time-range and status filters — reuse this pattern 
  anywhere there's a small filter toggle, instead of dropdowns.
- Icons: outline style (stroke, not filled), stroke-width 2, rounded caps/joins — 
  keep this consistent, don't mix in filled icon sets.

Apply this system to every existing page/component in the project. Where a page 
has elements not covered above (forms, modals, empty states, etc.), extend the 
same tokens and radius/spacing logic rather than introducing new colors or new 
border-radius values.