# Tech Stack & Implementation Rules

## Next.js Project Setup

1.  **Framework:** Next.js 14+ with App Router
    -   **SSR by Default:** Use Server Components for data fetching and SEO content.
    -   **Client Components:** Add `"use client"` only when interactivity is needed.
    -   **File-based Routing:** Pages are defined in `src/app/` directory.

2.  **UI Library:** Radix UI (shadcn/ui compatible)
    -   **Strict Usage:** Use Radix UI components for complex interactions (Dialog, Select, Tabs, etc.)
    -   **Location:** Components should be placed in `src/components/ui`.
    -   **Icons:** Use `lucide-react` for icons.

3.  **Styling:** Tailwind CSS v4
    -   **Theme Variables:** Use CSS variables defined in `src/app/globals.css` with `@theme` block.
    -   **No Hardcoded Colors:** Use dynamic tokens like `bg-background`, `text-foreground`, `border-border`.
    -   **Responsive:** Mobile-first approach with `md:`, `lg:`, `xl:` breakpoints.

4.  **Form Management:** `react-hook-form` + `zod`
    -   Use `zod` for schema validation.
    -   Use `react-hook-form` for state management.
    -   Add `"use client"` directive to form components.

5.  **Data Tables:** `@tanstack/react-table`
    -   Use for all complex tabular data.
    -   Implement sorting and pagination using table state.

## Next.js App Router Structure

```
src/
├── app/                    # App Router
│   ├── layout.tsx          # Root layout (required)
│   ├── page.tsx            # Home page (/)
│   ├── globals.css         # Tailwind + theme
│   └── [feature]/
│       └── page.tsx        # Feature routes
├── components/
│   ├── ui/                 # UI primitives
│   ├── features/           # Feature components
│   └── icons/              # SVG components
├── lib/
│   ├── utils.ts            # cn() helper
│   └── api/                # Mock API functions
└── stores/                 # Zustand stores (if needed)
public/                     # Static assets
├── images/
└── fonts/
```

## Component Rules

### Server vs Client Components
-   **Server (default):** No directive. Use for data fetching, SEO.
-   **Client:** Add `"use client"` for interactivity, hooks, event handlers.

### Navigation
-   Use `next/link` for declarative navigation.
-   Use `next/navigation` `useRouter` for programmatic navigation (Client Components only).

### Static Assets
-   Store images in `public/images/`.
-   Reference as `<img src="/images/file.png" />` or use `next/image`.

### General
-   **Mock Data:** Create mock API functions in `src/lib/api/` with simulated delays.
-   **Path Aliases:** Use `@/` imports (e.g., `import { cn } from "@/lib/utils"`).

## Example: Server Component with Data Fetching
```tsx
// app/products/page.tsx - NO "use client"
import { getProducts } from '@/lib/api/products';
import { ProductList } from '@/components/features/ProductList';

export default async function ProductsPage() {
  const products = await getProducts();
  return <ProductList products={products} />;
}
```

## Example: Client Component with Interactivity
```tsx
// components/features/ProductList.tsx
"use client";
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

export function ProductList({ products: initial }) {
  const [products, setProducts] = useState(initial);
  
  const handleDelete = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
  };
  
  return (
    <ul>
      {products.map(product => (
        <li key={product.id}>
          {product.name}
          <Button onClick={() => handleDelete(product.id)}>Delete</Button>
        </li>
      ))}
    </ul>
  );
}
```
