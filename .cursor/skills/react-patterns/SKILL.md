---
name: react-patterns
description: React patterns for callbacks, event handlers, and module-level constants. Use when writing React components, implementing event handlers, or defining constants.
---

# React Patterns

## Callbacks and Event Handlers

Use `useCallback` for callbacks and event handlers to ensure stable references and optimal performance.

```typescript
const handleClick = useCallback(() => {
  // Handler logic
}, [dependencies]);

const handleChange = useCallback((value: string) => {
  setState(value);
}, [setState]);
```

Use `useEffectEvent` for callbacks inside effects when you need to reference the latest props/state without adding them to dependencies:

```typescript
import { useEffectEvent } from "react";

function Component({ onUpdate }) {
  const [value, setValue] = useState("");
  
  const handleUpdate = useEffectEvent(() => {
    onUpdate(value);
  });

  useEffect(() => {
    const interval = setInterval(() => {
      handleUpdate();
    }, 1000);
    return () => clearInterval(interval);
  }, []);
}
```

## Module-Level Constants

Define true constants at module level, not inside components.

```typescript
// ✅ Good - Module level constant
const DEFAULT_CONFIG = {
  timeout: 5000,
  retries: 3,
};

export default function MyComponent() {
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  // ...
}
```

```typescript
// ❌ Bad - Constant recreated on every render
export default function MyComponent() {
  const defaultConfig = {
    timeout: 5000,
    retries: 3,
  };
  const [config, setConfig] = useState(defaultConfig);
  // ...
}
```

Benefits: fewer allocations, clearer intent, reuse across components.

### When to Use Module-Level Constants

- Default JSON structures, config objects that never change
- Static arrays or maps for rendering
- Default form values, regex patterns

### When NOT to Use

- Values that depend on props or state
- Values computed from runtime data (use `useMemo` instead)
