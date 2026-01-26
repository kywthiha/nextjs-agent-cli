# React Best Practices - Patterns & JS

## 6. Rendering Performance (MEDIUM)

### 6.1 Animate SVG Wrapper
Wrap SVG in `<div>` and animate wrapper for hardware acceleration.
### 6.2 CSS content-visibility
Use `content-visibility: auto` for off-screen list virtualisation.
### 6.3 Hoist Static JSX
Extract static JSX or SVG outside components.
### 6.4 Optimize SVG Precision
Reduce decimal precision in SVG paths.
### 6.5 Prevent Hydration Mismatch
Use synchronous inline scripts for theme/storage handling to avoid flickering.
### 6.6 Use Activity Component
Use `<Activity>` (if available) or CSS hiding for frequent toggles.
### 6.7 Explicit Conditional Rendering
Use ternary `? :` instead of `&&` to avoid rendering `0`.

## 7. JavaScript Performance (LOW-MEDIUM)

### 7.1 Batch DOM CSS Changes
Read layout properties *before* or *after* batching style writes. Avoid interleaving.
### 7.2 Build Index Maps
Use `Map` for O(1) lookups instead of repeated `.find()`.
### 7.3 Cache Property Access
Cache deep property access in loops.
### 7.4 Cache Repeated Function Calls
Use module-level `Map` caches for pure functions called frequently.
### 7.5 Cache Storage API Calls
Cache `localStorage` / `cookie` reads in memory.
### 7.6 Combine Loop Iterations
Single loop > multiple `.filter/.map` passes.
### 7.7 Early Length Check
Check array lengths before comparing contents.
### 7.8 Early Return
Return immediately on first error/match.
### 7.9 Hoist RegExp
Create RegExp outside render or use `useMemo`.
### 7.10 Loop for Min/Max
Use a loop instead of sorting to find min/max.
### 7.11 Use Set/Map
Use `Set.has()` instead of `Array.includes()`.
### 7.12 Use toSorted()
Use immutable sort (`toSorted`) to avoid mutating state/props.

## 8. Advanced Patterns (LOW)
### 8.1 Store Event Handlers in Refs
Use refs for event handlers in effects to avoid unnecessary re-subscriptions.
### 8.2 useLatest
Use `useLatest` hook to access fresh values in callbacks without dependency updates.
