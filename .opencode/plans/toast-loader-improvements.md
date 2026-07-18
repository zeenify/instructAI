# Toast & Button Loader Improvements

## 1. Button Loader — `frontend/src/components/ui/Button.jsx`

### Current
- Plain `Loader2` with CSS `animate-spin`
- No glow or shimmer

### Changes
- **Framer-motion rotation** — `animate={{ rotate: 360 }}` replaces CSS `animate-spin` for smoother continuous rotation
- **Pulsing glow ring** — `<motion.span>` behind spinner with `boxShadow: 0 0 14px {accent}` that pulses `scale[1→1.6→1]` and `opacity[0.5→0.15→0.5]`
- **Shimmer sweep** — `<motion.div>` overlay with `linear-gradient` that translates `x: [-100%, 100%]` across the button surface while loading
- **Accent color map** — `{ primary: "#a78bfa", student: "#22d3ee" }` used for glow + shimmer tint

```jsx
// loading branch becomes:
<>
  <span className="relative flex items-center justify-center" style={{ width: 18, height: 18 }}>
    <motion.span className="absolute inset-0 rounded-full"
      style={{ boxShadow: `0 0 14px ${accent}`, opacity: 0.5 }}
      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 0.15, 0.5] }}
      transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
    />
    <motion.span style={{ display: "inline-flex" }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: "linear" }}
    >
      <Loader2 className="w-[18px] h-[18px] text-current relative z-10" />
    </motion.span>
  </span>
  <span className="tracking-wide">{loadingText}</span>
</>
```

## 2. Theme-aware Toaster — `frontend/src/App.jsx`

### Current
- `<Toaster>` placed globally with fixed `richColors`
- No theme awareness

### Changes
- Import `useTheme` from ThemeContext
- Pass dynamic `theme={theme}` prop to `<Toaster>`
- Add styled close button + custom toast options

```jsx
import { useTheme } from './context/ThemeContext';

function App() {
  const { theme } = useTheme();
  // ...
  <Toaster
    position="top-right"
    richColors
    closeButton
    theme={theme}
    toastOptions={{
      style: {
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: '14px',
        padding: '14px 18px',
        borderRadius: '14px',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      },
    }}
  />
```

## 3. Color-coded toasts — across all files

Change `toast.success()` → `toast.warning()` for destructive/undo actions:

### File-by-file changes

| File | Line | Current | New |
|------|------|---------|-----|
| `ActivityViewer.jsx` | 115 | `toast.success('File removed')` | `toast.warning('File removed')` |
| `ActivityViewer.jsx` | 181 | `toast.success('Submission unsubmitted')` | `toast.warning('Submission unsubmitted')` |
| `ActivityEditor.jsx` | 416 | `toast.success('File removed')` | `toast.warning('File removed')` |
| `ActivityEditor.jsx` | 474 | `toast.success('...Unpublished')` | `toast.warning('...Unpublished')` (only the unpublish branch) |
| `ActivityEditor.jsx` | 503 | `toast.success('Question removed')` | `toast.warning('Question removed')` |
| `CourseBuilder.jsx` | 102 | `toast.success('...set to draft')` | `toast.warning('...set to draft')` (only the draft branch) |
| `CourseBuilder.jsx` | 264 | `toast.success('Unpublished')` | `toast.warning('Unpublished')` (only the unpublish branch) |
| `CourseBuilder.jsx` | 330 | `toast.success('Deleted successfully')` | `toast.warning('Deleted successfully')` |
| `CourseBuilder.jsx` | 370 | `toast.success('Deleted ... modules')` | `toast.warning('Deleted ... modules')` |
| `ContentGenerationModal.jsx` | 51 | `toast.success('...removed')` | `toast.warning('...removed')` |
| `LessonEditor.jsx` | 110 | `toast.success('Block removed')` | `toast.warning('Block removed')` |
| `Classwork.jsx` | 92 | `toast.success('...deleted')` | `toast.warning('...deleted')` |
| `ClassDetails.jsx` | 72 | `toast.success('...deleted')` | `toast.warning('...deleted')` |
| `QuizBuilder.jsx` | 357 | `toast.success('Question deleted')` | `toast.warning('Question deleted')` |
| `ActivityCard.jsx` | 41 | `toast.success('Unpublished')` | `toast.warning('Unpublished')` (only unpublish branch) |

### Files with ternary destructive/positive — need careful if/else split

Files where toast message is a ternary that covers both positive and destructive:
- `CourseBuilder.jsx:102` — `newStatus ? "Course is now live" : "Course set to draft"` → change to `newStatus ? toast.success(...) : toast.warning(...)`
- `CourseBuilder.jsx:264` — `newStatus ? 'Published' : 'Unpublished'` → same split
- `ActivityEditor.jsx:474` — `res.data.is_published ? 'Published!' : 'Unpublished'` → same split
- `LessonEditor.jsx:128` — `publishStatus ? "Published to Classroom" : "Draft Saved Successfully"` → both are positive actually (saving as draft is still a save, not destructive)
- `ActivityCard.jsx:41` — `res.data.is_published ? 'Published' : 'Unpublished'` → split
- `CourseBuilder.jsx:1296` — `allPublished ? 'All unpublished' : 'All published'` → this one's inverted logic, split accordingly

## 4. Action-specific icons on toasts (optional enhancement)

Add icon props to key toast calls for visual distinction:
- Publish → `<Check className="text-green-400" size={18} />`
- Delete/Remove → `<Trash2 className="text-amber-400" size={18} />`
- Save → `<CloudCheck className="text-green-400" size={18} />`
- Upload → `<Upload className="text-green-400" size={18} />`

This is a nice-to-have. Can focus on the main three items first.

## Implementation Order

1. Button.jsx — shimmer + glow + framer spinner
2. App.jsx — theme-aware Toaster
3. All files — color-coded toasts
4. Lint check
