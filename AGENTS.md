# Clean New Tab — Agent Guidelines

This document provides context, conventions, and operational guidelines for AI coding agents working on the `clean-new-tab` repository.

---

## 1. Project Overview & Tech Stack

`clean-new-tab` is a lightweight, customizable New Tab override extension for Chromium-based browsers (Brave, Chrome, Edge) and Firefox.

- **UI Framework:** React 19 + TypeScript (strict mode)
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`)
- **Bundler:** Vite 6
  - Chrome / Chromium: `@crxjs/vite-plugin` (`vite.config.chrome.ts`)
  - Firefox: Custom manifest & HTML plugins (`vite.config.firefox.ts`)
- **State & Hooks:** Context API (`NewtabContext`), custom React hooks in `src/hooks/`
- **Testing:** Vitest (`vitest.config.ts`)
- **Code Quality:** ESLint (`@typescript-eslint`, `eslint-plugin-react`, `eslint-plugin-import`) + Prettier

---

## 2. Verification Commands

Always run relevant checks before finalizing tasks:

```bash
# Code Quality
npm run lint           # ESLint check
npm run lint:fix       # Auto-fix ESLint issues
npm run type-check     # TypeScript check without emit (tsc --noEmit)
npm run format:check   # Verify formatting with Prettier
npm run format         # Format all files with Prettier

# Testing
npm test               # Run Vitest test suite once
npm run test:watch     # Run Vitest in watch mode

# Builds
npm run build:chrome   # Build production extension for Chrome (dist_chrome)
npm run build:firefox  # Build production extension for Firefox (dist_firefox)
npm run build          # Default build (Chrome)
```

---

## 3. Architecture & File Conventions

- **`src/pages/newtab/`**: Main entry point for the new tab dashboard (`Newtab.tsx`).
- **`src/components/`**:
  - `section/`: Section container (`SectionCard.tsx`).
  - `grid/`: Shortcut items inside sections (`GridItemCard.tsx`).
  - `modals/`: Add item, add section, edit shortcut, and settings modals.
  - `common/`: Reusable primitives (`Icon.tsx`, `FaviconImage.tsx`, `DropIndicator.tsx`).
- **`src/context/`**: Centralized application state (`NewtabContext.tsx`).
- **`src/utils/`**:
  - `storage.ts`: Persistence abstraction over `chrome.storage.local`.
  - `security.ts`: Protocol validation (`isSafeUrl`) and sanitization (`normalizeSafeUrl`).
  - `sync/`: GitHub Gist synchronization (PAT and Device Flow authentication).
- **`src/assets/styles/`**: Global styles and Tailwind entry point (`tailwind.css`).

---

## 4. Coding & Security Rules

1. **URL Sanitization:**
   - Never render or persist user-provided URLs without sanitizing via `normalizeSafeUrl(url)` from `@utils/security`.
   - Only allowed protocols (`https:`, `http:`, `chrome:`, `brave:`, `edge:`, `chrome-extension:`).
2. **Tailwind CSS v4:**
   - Use Tailwind v4 syntax. Do NOT use legacy v3 `@tailwind base;` directives.
   - Use standard utilities (e.g. `w-28 h-28`, `gap-2`, `select-none`) and arbitrary values only when necessary.
3. **Cross-Browser Compatibility:**
   - Any changes to `manifest.json` must be compatible with both Chromium Manifest V3 and Firefox (check `custom-vite-plugins.ts` and `manifest.dev.json`).
4. **Formatting:**
   - Code must adhere to `.prettierrc`: 2 spaces indentation, single quotes in JS/TS, double quotes in JSX, semicolons, LF line endings, 100 char print width.

---

## 5. Git & Workflow Guidelines

- **Branches:** Never commit directly to `develop` or `main`. Always create or use a dedicated branch (e.g., `feature/...`, `fix/...`, `chore/...`).
- **No Automatic Commits:** Do NOT commit (`git commit`) automatically without explicit permission from the user. Keep changes in working tree / staged files and wait for user approval before making a commit.
- **Commit Messages:** Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat:` new user-facing functionality
  - `fix:` bug fixes
  - `chore:` tooling, dependencies, formatting, docs
  - `refactor:` code restructuring without feature changes
  - `perf:` performance improvements
- **User Communication:** Maintain responses in concise GitHub-style Markdown and converse in Russian unless requested otherwise.
