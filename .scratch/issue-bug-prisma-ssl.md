## What to build

Fix the SSL/TLS connection error when Prisma connects to Supabase.

## Error

```
Error opening a TLS connection: self-signed certificate in certificate chain
code: 'P1011'
```

This happens when using Prisma 7 with the `PrismaPg` adapter connecting to Supabase.

## What was tried

1. PrismaPg with connectionString object (ssl: { rejectUnauthorized: false })
2. pg.Pool directly with SSL config
3. Different connection strings (pooler vs direct db host)
4. Adding `sslreject=off` query param

The Supabase MCP tool works fine, confirming the database is accessible. The issue is specifically with the Prisma adapter.

## Environment

- Prisma 7.8.0
- @prisma/adapter-pg
- Supabase PostgreSQL (us-east-2)
- Node.js with Next.js 16

## Next steps

1. Try direct pg connection without Prisma adapter to isolate
2. Check if Supabase requires specific CA certificate
3. Consider using Prisma Accelerate or direct connection string format