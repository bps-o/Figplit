[![Figplit Open Source Workspace](./public/social_preview_index.jpg)](https://bolt.new)

> Welcome to the **Figplit** open-source workspace! This repository keeps the Bolt.new foundations but reshapes them into an AI assistant obsessed with shipping iconic landing pages. If you want to extend Figplit, wire in new snippet packs, or tweak the agent’s behaviours, you’re in the right place.

### Why build with Figplit + WebContainer API

StackBlitz’s WebContainer API still powers the entire experience: a browser-based environment where the AI can **prompt, edit, run, and preview** the project without any remote servers. Figplit layers a design-forward UX, curated motion snippets, and prompt guardrails that keep the agent focused on front-of-house experiences—hero sections, launch pages, pricing tables, and product demos.

### What’s the difference between Figplit and Bolt.new?

- **Bolt.new**: The original StackBlitz product for building any full-stack app in the browser.
- **Figplit**: This fork narrows the scope to marketing and product landing pages, adding motion-aware onboarding, reusable design snippets, and instructions that push the LLM toward polish over raw functionality.

# Build with Figplit

Figplit combines [WebContainer API](https://webcontainers.io/api) with [Claude Sonnet 3.5](https://www.anthropic.com/news/claude-3-5-sonnet), [Remix](https://remix.run/), and the [AI SDK](https://sdk.vercel.ai/) to orchestrate a conversational editing loop tailored to front-end storytelling.

### WebContainer API

Figplit uses [WebContainers](https://webcontainers.io/) to run generated code in the browser. They give the agent a sandboxed Node.js environment using the [WebContainer API](https://webcontainers.io/api). Because everything compiles in the tab, Figplit can iterate on React, CSS, and animation files instantly—perfect for dialing in hero reveals or motion choreography without waiting on remote servers.

The [WebContainer API](https://webcontainers.io) is free for personal and open source usage. If you're building an application for commercial usage, review the [WebContainer API commercial usage pricing](https://stackblitz.com/pricing#webcontainer-api).

### Remix App

Figplit is built with [Remix](https://remix.run/) and deployed using [Cloudflare Pages](https://pages.cloudflare.com/) plus [Cloudflare Workers](https://workers.cloudflare.com/).

### AI SDK Integration

Figplit uses the [AI SDK](https://github.com/vercel/ai) with Anthropic's Claude Sonnet 3.5 model. Grab an API key from the [Anthropic API Console](https://console.anthropic.com/) and inspect the integration in [`app/lib/.server/llm`](./app/lib/.server/llm).

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v20.15.1)
- pnpm (v9.4.0)

## Setup

1. Clone the repository (if you haven't already):

```bash
git clone https://github.com/YOUR-ORG/Figplit.git
```

2. Install dependencies:

```bash
pnpm install
```

3. Create a `.env.local` file in the root directory and add your Anthropic API key:

```
ANTHROPIC_API_KEY=XXX
```

Optionally, you can set the debug level:

```
VITE_LOG_LEVEL=debug
```

**Important**: Never commit your `.env.local` file to version control. It's already included in .gitignore.

## Available Scripts

- `pnpm run dev`: Starts the development server.
- `pnpm run build`: Builds the project.
- `pnpm run start`: Runs the built application locally using Wrangler Pages. This script uses `bindings.sh` to set up necessary bindings so you don't have to duplicate environment variables.
- `pnpm run preview`: Builds the project and then starts it locally, useful for testing the production build. Note, HTTP streaming currently doesn't work as expected with `wrangler pages dev`.
- `pnpm test`: Runs the test suite using Vitest.
- `pnpm run typecheck`: Runs TypeScript type checking.
- `pnpm run typegen`: Generates TypeScript types using Wrangler.
- `pnpm run deploy`: Builds the project and deploys it to Cloudflare Pages.

## Development

To start the development server:

```bash
pnpm run dev
```

This will start the Remix Vite development server.

## Testing

Run the test suite with:

```bash
pnpm test
```

## Deployment

To deploy the application to Cloudflare Pages:

```bash
pnpm run deploy
```

Make sure you have the necessary permissions and Wrangler is correctly configured for your Cloudflare account.
