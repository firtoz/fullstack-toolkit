---
"@firtoz/router-toolkit": minor
---

### Added

- **`submitJson` function** in `useDynamicSubmitter` - Submit form data as a plain JSON object without needing `FormData` or `SubmitTarget`. Accepts only the inferred schema type for cleaner programmatic submissions.

  ```tsx
  const submitter = useDynamicSubmitter<typeof import("./auth.login")>("/auth/login");
  
  await submitter.submitJson(
    { email: "user@example.com", password: "secret123", rememberMe: true },
    { method: "POST" }
  );
  ```

### Improved

- **Comprehensive TSDoc documentation** for all main exports:
  - `formAction` - Now includes examples for route setup, using with `useDynamicSubmitter`, and combining with `useDynamicFetcher` for full CRUD operations
  - `useDynamicSubmitter` - Full documentation with route setup examples, all three submission methods (`submitJson`, `submit`, `Form`), and response handling patterns
  - `useDynamicFetcher` - Complete documentation covering basic usage, query parameters, and combining with `useDynamicSubmitter`
