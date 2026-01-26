# React Best Practices - Performance

## 1. Eliminating Waterfalls (CRITICAL)

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### 1.1 Defer Await Until Needed
Move `await` operations into the branches where they're actually used to avoid blocking code paths that don't need them.

### 1.2 Dependency-Based Parallelization
For operations with partial dependencies, use `Promise.all` or `better-all` to maximize parallelism.

### 1.3 Promise.all() for Independent Operations
When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

### 1.4 Strategic Suspense Boundaries
Instead of awaiting data in async components blocks the entire tree, use Suspense boundaries to show wrapper UI faster.

## 2. Client-Side Optimization (CRITICAL)

### 2.1 Avoid Barrel File Imports
Import directly from source files instead of barrel files.
**Incorrect:** `import { Check } from 'lucide-react'`
**Correct:** `import Check from 'lucide-react/dist/esm/icons/check'`

### 2.2 Conditional Module Loading
Load large data/modules only when feature is activated using dynamic imports (`import()`) inside useEffect or handlers.
