---
"@firtoz/drizzle-utils": patch
---

Avoid executing `syncableTable` default functions during table definition so Worker global scope restrictions are respected in Durable Object environments.
