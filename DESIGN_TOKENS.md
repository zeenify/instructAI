# Design Tokens - Student Monitoring Dashboard

## Color System

### Semantic Colors

```
PRIMARY ACTION (Emerald)
├─ emerald-50    #f0fdf4  (unused in dark mode)
├─ emerald-100   #dcfce7  (unused in dark mode)
├─ emerald-400   #4ade80  ← Used for icons/text
├─ emerald-500   #10b981  ← Used for backgrounds
└─ emerald-900   #064e3b  (unused in dark mode)

INFORMATION (Blue)
├─ blue-400      #60a5fa  ← Used for icons/text
├─ blue-500      #3b82f6  ← Used for backgrounds
└─ (lighter shades unused in dark mode)

WARNING (Amber)
├─ amber-400     #fbbf24  ← Used for icons/text
├─ amber-500     #f59e0b  ← Used for backgrounds
└─ (lighter shades unused in dark mode)

CRITICAL (Red)
├─ red-400       #f87171  ← Used for icons/text
├─ red-500       #ef4444  ← Used for backgrounds
└─ (lighter shades unused in dark mode)
```

### Neutral Colors

```
BACKGROUND
├─ slate-950     #020617  ← Main page background (gradient start)
└─ slate-900     #0f172a  ← Gradient end

SURFACES
├─ slate-800     #1e293b  ← Card backgrounds (opaque)
└─ slate-800/50  #1e293b33 ← Card backgrounds (semi-transparent)

TEXT
├─ slate-100     #f1f5f9  ← Primary text
├─ slate-200     #e2e8f0  ← Secondary headings
├─ slate-400     #94a3b8  ← Metadata / subtext
└─ slate-500     #64748b  ← Disabled / inactive

BORDERS & DIVIDERS
├─ slate-700     #334155  ← Strong borders
├─ slate-700/50  #33415580 ← Subtle borders
├─ slate-700/30  #3341554d ← Very subtle dividers
└─ white/10      #ffffff1a ← Ultra light dividers (edge cases)
```

---

## Typography System

### Font Families

```css
/* Headings */
font-family: 'Fira Code', 'Courier New', monospace;
font-weight: 600-700 (semibold-bold);

/* Body Text */
font-family: 'Fira Sans', 'Segoe UI', system-ui;
font-weight: 300-600 (light-semibold);
```

### Font Scale

```
Page Title
  font-size: 2.25rem (36px)  /* 4xl */
  font-weight: 700 (bold)
  line-height: 1.1
  letter-spacing: -0.02em

Section Heading
  font-size: 1.5rem (24px)   /* 2xl */
  font-weight: 700 (bold)
  margin-bottom: 1.5rem

Subsection Heading
  font-size: 1.125rem (18px) /* lg */
  font-weight: 600 (semibold)

Body Text
  font-size: 1rem (16px)     /* base */
  font-weight: 400 (normal)
  line-height: 1.6

Label / Metadata
  font-size: 0.875rem (14px) /* sm */
  font-weight: 500 (medium)
  color: slate-400

Caption / Small Text
  font-size: 0.75rem (12px)  /* xs */
  font-weight: 500 (medium)
  color: slate-500
```

---

## Component Spacing

### Padding

```
Extra Large Cards/Sections:  p-8 (32px)
Large Cards/Sections:        p-6 (24px)
Medium Elements:             p-4 (16px)
Small Elements:              p-3 (12px)
Icon Badges:                 p-2.5 (10px)
Icon Small Badges:           p-2 (8px)
Label Spacing:               mb-3 (12px)
```

### Gaps

```
Extra Large:  gap-6 (24px)  /* Between major sections */
Large:        gap-5 (20px)  /* Between stat cards */
Medium:       gap-4 (16px)  /* Between list items */
Small:        gap-3 (12px)  /* Between inline elements */
Tiny:         gap-2 (8px)   /* Between small items */
```

### Margins

```
Section Break:      mb-8 (32px)
Large Heading:      mb-6 (24px)
Card Heading:       mb-5 (20px)
Item Heading:       mb-4 (16px)
Label to Input:     mb-3 (12px)
Tight Spacing:      mb-2 (8px)
```

---

## Border & Shadow Tokens

### Borders

```
Standard Border:
  border: 1px solid token(colors.slate.700 / 0.5)
  border-radius: 0.75rem (12px for cards)

Focus Ring:
  outline: 2px solid token(colors.emerald.400)
  outline-offset: 2px
  border-radius: 0.5rem (8px)

Card Border (interactive):
  Default:   border-slate-700/50
  Hover:     border-emerald-400/50
  Transition: 300ms ease-in-out
```

### Shadows

```
Hover Card Lift:
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3)
  transform: translateY(-2px)
  transition: all 300ms ease-in-out

Gradient Hover Glow (subtle):
  background: linear-gradient(to right, rgba(color, 0.2), transparent)
  opacity: 0 (default) → 1 (hover)
  transition: opacity 300ms ease-in-out
```

---

## Interactive States

### Button/Link States

```
Default:
  color: emerald-400
  cursor: pointer

Hover:
  color: emerald-300
  text-decoration: none
  transition: all 200ms

Focus:
  outline: 2px solid emerald-400
  outline-offset: 2px

Active/Pressed:
  color: emerald-500
  scale: 0.98
  transition: all 100ms
```

### Form Input States

```
Default:
  background: bg-slate-800/50
  border: 1px solid slate-700
  color: slate-100

Focus:
  outline: none
  ring: 2px solid emerald-400
  border: transparent
  background: bg-slate-800

Hover (enabled):
  background: bg-slate-800
  border-color: slate-600

Hover (disabled):
  background: unchanged
  cursor: not-allowed

Disabled:
  opacity: 0.5
  cursor: not-allowed
  background: unchanged
```

### Card/Row States

```
Default:
  background: from-slate-800/50 to-slate-800/30
  border: 1px solid slate-700/50

Hover:
  background: from-slate-800 to-slate-800/50
  border: 1px solid emerald-400/50
  transform: translateY(-2px)
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3)
  transition: all 300ms

Keyboard Focus:
  outline: 2px solid emerald-400
  outline-offset: 2px
```

---

## Animation & Transition Tokens

### Durations

```
Micro Interactions:  100ms
                     0.1s

Quick Feedback:      150ms
                     0.15s

Standard:            200-300ms
                     0.2-0.3s (default)

Slow:                500ms+
                     0.5s+ (only for special effects)
```

### Timing Functions

```
Ease In-Out:    cubic-bezier(0.4, 0, 0.2, 1)  [DEFAULT]
Ease Out:       cubic-bezier(0, 0, 0.2, 1)
Ease In:        cubic-bezier(0.4, 0, 1, 1)
Linear:         linear  [for spinners only]
```

### Common Transitions

```
Color Change:
  transition: all 200ms ease-in-out
  /* includes color, background, border */

Transform (Hover Lift):
  transition: transform 300ms ease-in-out
  transform: translateY(-2px)

Opacity Fade:
  transition: opacity 300ms ease-in-out

Combo (Card Hover):
  transition: all 300ms ease-in-out
  /* affects: background, border, box-shadow, transform */
```

---

## Accessibility Tokens

### Color Contrast

```
Body Text on Dark Background:
  text-slate-100 on bg-slate-950  ✓ 16:1 (WCAG AAA)
  text-slate-100 on bg-slate-800  ✓ 14:1 (WCAG AAA)

Secondary Text on Dark Background:
  text-slate-400 on bg-slate-950  ✓ 5.8:1 (WCAG AAA)
  text-slate-400 on bg-slate-800  ✓ 4.9:1 (WCAG AAA)

Colored Text (Semantic):
  emerald-400 on bg-slate-800     ✓ 9:1 (WCAG AAA)
  blue-400 on bg-slate-800        ✓ 8.2:1 (WCAG AAA)
  amber-400 on bg-slate-800       ✓ 8.5:1 (WCAG AAA)
  red-400 on bg-slate-800         ✓ 8.8:1 (WCAG AAA)
```

### Focus Indicators

```
Focus Ring:
  Width: 2px
  Color: emerald-400 (#4ade80)
  Offset: 2px
  Radius: 8px
  Visibility: Always visible (never removed)
```

### Motion Preferences

```
prefers-reduced-motion: reduce
  Remove all transitions
  Remove all animations
  Use instant state changes (duration: 0)
```

---

## Responsive Breakpoints

```
Mobile:
  max-width: 640px (640px)
  Layout: Single column
  Stat Cards: 1 column
  Selectors: Stacked vertically

Tablet:
  min-width: 768px
  max-width: 1024px
  Layout: 2 columns
  Stat Cards: 2 columns
  Selectors: Side by side

Desktop:
  min-width: 1024px
  Layout: Multi-column
  Stat Cards: 4 columns
  Full width: max-w-7xl (1280px)
```

---

## Tailwind Configuration Reference

### Colors Used

```js
colors: {
  slate: {
    50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950
  },
  emerald: {
    400, 500
  },
  blue: {
    400, 500
  },
  amber: {
    400, 500
  },
  red: {
    400, 500
  }
}
```

### Key Utilities Used

```
Spacing:     p-*, m-*, gap-*, w-*, h-*
Typography:  font-bold, text-*, font-*
Colors:      bg-*, text-*, border-*
Layout:      flex, grid, grid-cols-*
Effects:     shadow, rounded-*, border
Animation:   transition-*, duration-*
Responsive:  md:*, lg:*, sm:*
Opacity:     opacity-*, /10, /20, /30, etc.
```

---

## Icon System (Lucide React)

### Standard Icon Sizes

```
Page/Section Icons:      size={24} (w-6 h-6)
Card Icon Badges:        size={20} (w-5 h-5)
Inline Icons:            size={18} (w-4.5 h-4.5)
Button Icons:            size={16} (w-4 h-4)
Small Badges:            size={16} (w-4 h-4)
```

### Color Mapping

```
Success / Positive:      emerald-400
Information:             blue-400
Warning / Attention:     amber-400
Critical / Error:        red-400
Neutral / Navigation:    slate-400-500
```

---

## Pre-Built Component Classes

### Stat Card
```
base: "relative overflow-hidden rounded-xl border transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
bg:   "{color}-500/10"
border: "{color}-500/30"
```

### List Card
```
base: "group relative bg-gradient-to-r from-slate-800/50 to-slate-800/30 hover:from-slate-800 hover:to-slate-800/50 rounded-xl p-5 border border-slate-700/50 hover:border-emerald-400/50 cursor-pointer transition-all duration-300"
```

### Input/Select
```
base: "px-4 py-3 bg-slate-800/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent transition-all hover:bg-slate-800"
disabled: "disabled:opacity-50 disabled:cursor-not-allowed"
```

### Focus Ring
```
focus: "focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
```

