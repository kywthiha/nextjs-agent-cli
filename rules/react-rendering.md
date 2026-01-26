# React Best Practices - Rendering

## 3. Client-Side Data Fetching (MEDIUM-HIGH)

### 3.1 Deduplicate Global Event Listeners
Use `useSWRSubscription` or module-level Maps to share listeners.

### 3.2 Use Passive Event Listeners
Add `{ passive: true }` to touch/wheel listeners for scrolling performance.

### 3.3 Use SWR/React Query for Automatic Deduplication
Don't fetch in useEffect. Use a library for dedup/caching like TanStack Query (React Query) or SWR.

### 3.4 Version and Minimize localStorage
Prefix keys with versions (`userConfig:v1`) and wrap access in try-catch blocks.

## 4. Re-render Optimization (MEDIUM)

### 4.1 Defer State Reads
Don't subscribe to dynamic state (searchParams) if only read in callbacks.

### 4.2 Extract to Memoized Components
Extract expensive work to `memo()` components.

### 4.3 Narrow Effect Dependencies
Depend on primitives (`user.id`) not objects (`user`).

### 4.4 Subscribe to Derived State
Subscribe to boolean results (`isMobile`) rather than continuous values (`width`).

### 4.5 Use Functional setState Updates
Use `setCount(c => c + 1)` to avoid dependencies and stale closures.

### 4.6 Use Lazy State Initialization
Use `useState(() => computed)` for expensive initial values.

### 4.7 Use Transitions
Mark non-urgent updates (like logging) with `startTransition`.
