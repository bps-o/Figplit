[![Figplit — Landing Page AI Studio](./public/social_preview_index.jpg)](https://bolt.new)

# Figplit: AI Vibe-Coding Agent for Landing Pages

Figplit is an opinionated fork of the Bolt.new open-source project that focuses entirely on shipping best-in-class marketing and product landing pages. Instead of trying to build any full-stack application, Figplit leans into the workflows that product teams, founders, and designers use to craft gorgeous public-facing sites with cinematic motion and polished micro-interactions.

Figplit keeps the Bolt foundations—WebContainers, an editable project workspace, and the agentic chat interface—but layers on a design-first experience, curated animation snippets, and prompts that keep the AI centered on storytelling, polish, and brand vibes.

## Why teams use Figplit

- **Purpose-built for landing pages** – Prompts, examples, and guardrails push the AI toward marketing sites, launch pages, and hero flows instead of generic CRUD apps.
- **Animation and motion aware** – Figplit understands choreography. It suggests easing curves, orchestrates view transitions, and previews motion so you know how the page feels—not just how it looks.
- **Reusable visual vocabulary** – A bundled snippet library (see [`/snippets`](./snippets)) gives the agent rich starting points for glassmorphism heroes, marquee reels, pricing matrices, and demo carousels.
- **Agentic editing loop** – Prompt from the chat panel, watch changes stream into the editor, preview instantly, and deploy without ever leaving the tab.

## Getting started locally

Figplit is built with Remix and Vite, and runs entirely in WebContainers just like Bolt.

1. Install dependencies with `pnpm install`.
2. Provide an Anthropic API key via the `ANTHROPIC_API_KEY` environment variable.
3. Set a `SESSION_SECRET` for cookie-based authentication.
4. Start the app with `pnpm dev` and open the provided URL.

To enable the GitHub sync workflow you will also need to configure OAuth credentials:

- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from your GitHub OAuth app or GitHub App installation.
- Optionally set `GITHUB_REDIRECT_URI` if the default of `https://<host>/auth/github/callback` does not match your deployment.

Once running, the left panel hosts the chat agent. The right panel shows code, terminal output, and the live landing page preview.

## Project tour

- `app/components/chat` – Chat UI, prompt enhancer, and the design-focused onboarding experience.
- `app/lib/.server/llm` – Server-side LLM orchestration, including the Figplit-specific system prompt.
- `snippets/` – High-fidelity React + CSS snippets the agent can remix and adapt for new landing pages.
- `app/components/workbench` – Editor, preview, and terminal surfaces wired to WebContainers.

## Roadmap & feedback

This fork starts opinionated but intentionally hackable. We want Figplit to be the fastest way to go from idea to production-ready landing page. If you have ideas, encounter bugs, or want to contribute new snippet packs, open an issue or start a discussion.

Built on the incredible foundations from [Bolt.new](https://bolt.new) and the StackBlitz WebContainer API.
