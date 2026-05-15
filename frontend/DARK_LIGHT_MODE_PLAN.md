# Dark Mode / Light Mode Implementation Plan

## Overview
Transform the existing dark mode design to support both dark and light modes via a toggle switch in the settings sidebar. Landing page remains dark only.

## Current State
- Design is dark mode by default (dark backgrounds, light text)
- No theme switching mechanism exists
- Tailwind CSS is used for styling
- Need to preserve current dark aesthetic while adding light variant

## Implementation Strategy

### 1. Color System Architecture

#### Option A: CSS Variables + Tailwind (RECOMMENDED)
Create a CSS variable system that Tailwind references:

**File: `frontend/src/index.css`**
```css
:root {
  /* Light Mode (default fallback) */
  --bg-primary: #f5f5f5;
  --bg-secondary: #ffffff;
  --bg-tertiary: #e8e8e8;
  
  --text-primary: #1a1a1a;
  --text-secondary: #666666;
  --text-tertiary: #999999;
  
  --border-color: #e0e0e0;
  --accent: #3b82f6;
}

[data-theme="dark"] {
  /* Dark Mode */
  --bg-primary: #1a1a1a;
  --bg-secondary: #262626;
  --bg-tertiary: #333333;
  
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-tertiary: #808080;
  
  --border-color: #404040;
  --accent: #60a5fa;
}
```

**File: `frontend/tailwind.config.js`**
```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        'bg': {
          'primary': 'var(--bg-primary)',
          'secondary': 'var(--bg-secondary)',
          'tertiary': 'var(--bg-tertiary)',
        },
        'text': {
          'primary': 'var(--text-primary)',
          'secondary': 'var(--text-secondary)',
          'tertiary': 'var(--text-tertiary)',
        },
        'border': 'var(--border-color)',
        'accent': 'var(--accent)',
      },
      backgroundColor: {
        'base': 'var(--bg-primary)',
      }
    }
  }
}
```

### 2. State Management

**File: `frontend/src/context/ThemeContext.jsx`** (New)
```javascript
- Create context to store theme state (light/dark)
- Provide theme getter and setter functions
- Load initial theme from localStorage (key: 'theme-preference')
- Default to 'dark' if no saved preference
- Apply theme to document root on context initialization
- Auto-save to localStorage on theme change
```

**Integration Points:**
- Wrap app in `ThemeProvider` at highest level (in `main.jsx` or wrap `AuthProvider`)
- Ensure theme loads before rendering to prevent flash of unstyled content

### 3. Toggle Implementation

#### Placement
1. **Teacher Pages**: Side navbar settings → add "Theme" or "Appearance" section
   - File: `frontend/src/components/layouts/TeacherLayout.jsx`
   - Insert toggle in the settings/profile dropdown or dedicated section

2. **Student Pages**: Side navbar settings → add "Theme" section
   - File: `frontend/src/components/layouts/StudentLayout.jsx`
   - Same approach as teacher layout

#### Toggle Component
**File: `frontend/src/components/ui/ThemeToggle.jsx`** (New)
- Simple toggle button or radio group (Light / Dark)
- Use Moon/Sun icons from lucide-react
- Call `ThemeContext` setter on click
- Display current theme state visually

### 4. Color Migration Strategy

#### Phase 1: Define Base Color Map
Map current dark mode colors to semantic names:
- Background Primary: Current page background (`#1a1a1a`)
- Background Secondary: Card backgrounds (`#262626`)
- Background Tertiary: Hover/elevated states (`#333333`)
- Text Primary: Main text (current white/near-white)
- Text Secondary: Muted text (current grays)
- Accent: Primary actions (current blues)
- Border: Dividers (current dark grays)

#### Phase 2: Replace Hardcoded Colors
Search and replace all hardcoded colors in components:
- `bg-slate-950` → `bg-bg-primary`
- `bg-slate-900` → `bg-bg-secondary`
- `text-white` → `text-text-primary`
- `text-gray-400` → `text-text-secondary`
- Direct hex values → CSS variables or Tailwind semantic names

Files to audit:
- `frontend/src/pages/teacher/*`
- `frontend/src/pages/student/*`
- `frontend/src/components/teacher/*`
- `frontend/src/components/student/*`
- `frontend/src/components/ui/*`

#### Phase 3: Component-Level Adjustments
- **Cards**: Use `bg-bg-secondary` for light mode, adjust shadows
- **Inputs/Forms**: Light mode needs visible borders/background contrast
- **Buttons**: Ensure text contrast in both modes (WCAG AA minimum)
- **Syntax highlighting**: Code blocks need light-mode syntax colors
- **Charts/Graphs**: Adjust colors for visibility in light mode

### 5. Landing Page Scope
- **Status**: Leave as dark-only (no toggle needed)
- **Action**: Mark landing page as excluded from theme context
- **Implementation**: Landing page component/route doesn't render toggle, doesn't read theme context (optional styling per current dark design)

### 6. Specific Files to Modify

| File | Change |
|------|--------|
| `frontend/src/index.css` | Add CSS variables (light + dark) |
| `frontend/tailwind.config.js` | Map Tailwind colors to CSS vars |
| `frontend/src/main.jsx` | Wrap with `ThemeProvider` |
| `frontend/src/context/ThemeContext.jsx` | CREATE - Theme state & logic |
| `frontend/src/components/ui/ThemeToggle.jsx` | CREATE - Toggle UI component |
| `frontend/src/components/layouts/TeacherLayout.jsx` | Add toggle to settings |
| `frontend/src/components/layouts/StudentLayout.jsx` | Add toggle to settings |
| `frontend/src/pages/teacher/*.jsx` | Replace hardcoded colors with semantic names |
| `frontend/src/pages/student/*.jsx` | Replace hardcoded colors with semantic names |
| `frontend/src/components/**/*.jsx` | Replace hardcoded colors with semantic names |

### 7. Color Palette Reference

**Dark Mode (Current)**
```
Primary BG: #1a1a1a
Secondary BG: #262626
Tertiary BG: #333333
Primary Text: #ffffff
Secondary Text: #b0b0b0
Tertiary Text: #808080
Border: #404040
Accent Primary: #60a5fa
Accent Danger: #ef4444
Success: #22c55e
Warning: #f59e0b
```

**Light Mode (New)**
```
Primary BG: #f5f5f5
Secondary BG: #ffffff
Tertiary BG: #e8e8e8
Primary Text: #1a1a1a
Secondary Text: #666666
Tertiary Text: #999999
Border: #e0e0e0
Accent Primary: #3b82f6
Accent Danger: #dc2626
Success: #16a34a
Warning: #d97706
```

### 8. Implementation Checklist

- [ ] Create `ThemeContext.jsx` with localStorage persistence
- [ ] Update `tailwind.config.js` with CSS variable mappings
- [ ] Add CSS variables to `index.css` for both themes
- [ ] Create `ThemeToggle.jsx` component with icons
- [ ] Add ThemeProvider wrapper to app root
- [ ] Add toggle to teacher layout settings
- [ ] Add toggle to student layout settings
- [ ] Audit and replace all hardcoded dark colors in teacher pages
- [ ] Audit and replace all hardcoded dark colors in student pages
- [ ] Audit and replace all hardcoded dark colors in shared components
- [ ] Test theme switching across all pages
- [ ] Verify localStorage persistence (refresh page, check if theme persists)
- [ ] Check contrast ratios in light mode (WCAG AA)
- [ ] Test code block syntax highlighting in light mode
- [ ] Verify charts/graphs render properly in light mode
- [ ] Test on mobile (sidebar styling should adapt)
- [ ] Ensure landing page remains dark-only

### 9. Edge Cases & Considerations

1. **Flash of Unstyled Content (FOUC)**
   - Load theme from localStorage before rendering components
   - Set `data-theme` attribute immediately in `ThemeProvider` initialization

2. **System Preference Fallback**
   - Optional: Detect OS dark/light preference on first visit (`prefers-color-scheme` media query)
   - Store user's choice in localStorage once they interact with toggle

3. **Code Block Syntax Highlighting**
   - If using Prism or highlight.js, ensure light-mode theme is available
   - May need separate CSS import for light-mode syntax highlighting

4. **Third-Party Components (e.g., shadcn/ui)**
   - If components use hardcoded colors, they may need Tailwind config overrides
   - Test carefully to ensure third-party components respect theme variables

5. **Print Styles**
   - Consider if print should force light mode for better printer output
   - Add media query: `@media print { [data-theme] { --bg-primary: white; ... } }`

6. **Transitioned Changes**
   - Optional: Add `transition: background-color 0.2s` to elements for smooth theme switch
   - Be careful not to add transitions that make page feel sluggish

### 10. Testing Strategy

1. **Visual Testing**
   - Load each page (teacher course builder, student quiz, etc.)
   - Toggle theme and verify all text readable, buttons visible, cards distinct
   - Check hover states, disabled states, active states in both modes

2. **Accessibility Testing**
   - Use WebAIM contrast checker on main text, buttons, borders
   - Ensure focus indicators visible in both modes

3. **Persistence Testing**
   - Set theme to light, refresh page, verify theme persists
   - Set theme to dark, refresh page, verify theme persists
   - Clear localStorage, refresh, verify defaults to dark

4. **Mobile Testing**
   - Sidebar toggle functionality on small screens
   - Colors visible on mobile devices (may render differently)

---

## Notes for Implementation Team

- **Parallel Work**: Color replacement can be done file-by-file without blocking other features
- **Git Strategy**: Suggest one commit per major section (context, CSS vars, component-by-component color updates)
- **Naming Convention**: Use BEM or similar for new CSS classes if needed, but prefer Tailwind utilities + CSS variables
- **Rollback Plan**: If theme-switching breaks something, CSS variables can be reverted quickly; localStorage doesn't break anything
