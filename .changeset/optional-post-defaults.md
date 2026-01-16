---
"@firtoz/router-toolkit": minor
---

### Changed

- **`submitJson` options are now optional** - Defaults to `{ method: "POST" }` when not provided. You can now simply call `submitter.submitJson(data)` without specifying options.

  ```tsx
  // Before: options required
  await submitter.submitJson(data, { method: "POST" });

  // After: options optional, defaults to POST
  await submitter.submitJson(data);

  // Or specify a different method
  await submitter.submitJson(data, { method: "PUT" });
  ```

- **`Form` method is now optional** - Defaults to `"POST"` when not specified.

  ```tsx
  // Before: method required
  <submitter.Form method="POST">...</submitter.Form>

  // After: method optional, defaults to POST
  <submitter.Form>...</submitter.Form>

  // Or specify a different method
  <submitter.Form method="PUT">...</submitter.Form>
  ```
