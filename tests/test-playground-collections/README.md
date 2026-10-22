# Test playground (collections)

A React Router v7 app for **collections**, **IndexedDB**, **SQLite (WASM)**, sync-mode, and pagination demos. Sibling app for router-toolkit-only flows: **`tests/test-playground-router`**.

## Purpose

This package exercises integration of packages such as **@firtoz/drizzle-sqlite-wasm**, **@firtoz/drizzle-indexeddb**, **@firtoz/idb-collections**, **@firtoz/worker-helper**, **@firtoz/router-toolkit**, and **@firtoz/maybe-error**.

## Features

- 🚀 Server-side rendering with React Router v7
- ⚡️ Hot Module Replacement (HMR)
- 🔒 TypeScript by default
- 🎨 TailwindCSS with dark mode support
- 🧪 E2E testing with Playwright
- 📦 Asset bundling and optimization

## Getting Started

### Installation

Install the dependencies from the repository root:

```bash
bun install
```

### Development

Start the development server from this directory:

```bash
cd tests/test-playground-collections
bun run dev
```

The app listens on **port 5198** (`http://127.0.0.1:5198`).

### Testing

Run E2E tests:

```bash
bun run test:e2e
```

## Available test routes

### API

- **`/api/clear-opfs`** — Clear OPFS for E2E isolation

### Under `/collections/`

- **`sqlite-test`**, **`indexeddb-test`**, **`indexeddb-migration-test`**
- **`sync-mode-test`**, **`sqlite-sync-mode-test`**
- **`standalone-test`**, **`memory-collection-test`**, **`memory-collection-n-sync-test`**, **`keyval-collection-test`**
- **`pagination-test`**, **`sqlite-pagination-test`**
- **`tanstack-06-virtual-props-demo`**

## Building for Production

Create a production build from the repository root:

```bash
bunx turbo run build --filter=test-playground-collections --concurrency=1
```

## Deployment

### Docker Deployment

Run these commands from the **repository root**. The image installs the frozen Bun workspace lockfile, builds the workspace packages, and serves the app with patched Node 24.22.1:

```bash
docker build --pull -f tests/test-playground-collections/Dockerfile -t test-playground-collections .

# Run the container
docker run --rm -p 3000:3000 test-playground-collections
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

These apps depend on Bun workspace/catalog packages. A copy of this directory alone
is not a complete deployment; use the repository-root Docker build above, or retain
the built workspace packages and their production dependency links alongside the app.

SQLite/OPFS routes also require `Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: require-corp` from your deployment's reverse proxy.
The development server configures those headers automatically.

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

---

Built with ❤️ using React Router.
