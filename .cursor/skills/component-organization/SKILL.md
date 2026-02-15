---
name: component-organization
description: Component organization patterns for React applications. Use when creating components, organizing files, or structuring routes. ALWAYS keep 1 component per file and routes simple.
---

# Component Organization

## Core Principles

### 1 Component Per File

Each component in its own file with a clear, descriptive name.

```typescript
// ✅ Good - components/admin/settings/SiteInfoSection.tsx
export function SiteInfoSection({ siteName, siteUrl, onUpdate }) {
  return <div className="space-y-4">{/* ... */}</div>;
}
```

```typescript
// ❌ Bad - Multiple components in one file
export function SiteInfoSection() { ... }
export function ThemeSection() { ... }
export function SEOSection() { ... }
```

## Folder Structure

```
app/
├── components/
│   ├── ui/              # Primitives (button, input, card)
│   ├── shared/           # Cross-feature shared
│   └── [feature]/       # Feature-specific
│       └── [page]/      # Page-specific
├── features/
│   └── [feature]/
│       ├── components/
│       ├── hooks/
│       └── stores/
└── routes/
    └── ...              # Thin wrappers
```

## Simple Route Pattern

Routes are thin wrappers: keep loaders/actions in the route, move JSX to a page component.

```typescript
// ✅ Good - routes/admin/settings.tsx
import { SettingsPage } from "~/components/admin/settings/SettingsPage";

export const loader = async ({ request }: Route.LoaderArgs) => {
  const settings = await getAllSettings();
  return { settings };
};

export default function SettingsRoute() {
  const { settings } = useLoaderData<typeof loader>();
  return <SettingsPage settings={settings} />;
}
```

```typescript
// ❌ Bad - Large JSX in route file
export default function SettingsRoute() {
  return (
    <div>
      {/* 800+ lines of JSX */}
    </div>
  );
}
```

## Page Component Pattern

The page component composes smaller section components:

```typescript
// components/admin/settings/SettingsPage.tsx
import { SiteInfoSection } from "./SiteInfoSection";
import { ThemeSection } from "./ThemeSection";

export function SettingsPage({ settings }) {
  return (
    <div className="container">
      <SiteInfoSection data={settings.siteInfo} />
      <ThemeSection data={settings.theme} />
    </div>
  );
}
```

## When Creating New Components

1. UI primitive? → `components/ui/`
2. Shared across features? → `components/shared/`
3. Feature-specific? → `components/[feature]/` or `features/[feature]/components/`
4. Page-specific? → `components/[feature]/[page]/`

Create a new file for each component. Prefer small, focused files.
