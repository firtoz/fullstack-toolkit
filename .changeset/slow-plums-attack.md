---
"@firtoz/router-toolkit": minor
---

Add JSON support to formAction. The function now automatically detects the Content-Type header and handles both JSON (`application/json`) and FormData (`multipart/form-data` or `application/x-www-form-urlencoded`) requests. This allows `submitJson()` to work seamlessly with formAction handlers.
