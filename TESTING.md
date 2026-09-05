# Testing

100% test coverage is the key to great vibe coding. Tests let you move fast, trust your instincts, and ship with confidence. Without them, vibe coding is just yolo coding. With tests, it is a superpower.

## Two suites

| Suite | Framework | Command | What it covers |
| --- | --- | --- | --- |
| Front end | Vitest 5 + Testing Library (jsdom) | `npm test` | Pure helpers in `src/lib`, the engine-mode gate, the result view, the browser history store |
| Engine | pytest (uv) | `npm run engine:test` | Centering maths, verdict boundaries, append-only ledger, end to end |

Run the front-end suite in watch mode with `npm run test:watch`.

## Front-end layout and conventions

- Test files sit next to the code they test: `src/lib/types.test.ts`, `src/components/result/result.test.tsx`.
- Import `describe`, `it`, `expect` and friends from `vitest` explicitly. No globals.
- Rendering uses `@testing-library/react`; `@testing-library/jest-dom/vitest` matchers are loaded by `src/test/setup.tsx`, which also mocks `next/link` and cleans up after each test.
- Modules with module-level state (`src/lib/history.ts`, `src/lib/engine.ts`) are loaded per test with `vi.resetModules()` and a dynamic import so tests never share state.
- `server-only` is aliased to a no-op in `vitest.config.ts` so server helpers can be imported directly.
- Never import secrets, API keys or `.env.local` values in tests.

## Layers

- **Unit**: helpers with objectively right answers (`reasonLabel`, `worseRatio`, `gapToGate`, `buildSummary`). Test what the code does, never just that it exists.
- **Integration**: the engine-mode gate under environment combinations (`liveGradingAllowed`, `detectMode` with a stubbed `fetch`), the history store against jsdom `localStorage`.
- **Component**: the result view rendered with the real sample response, including unique aria ids when two results share a page.
- **Browser QA**: `/qa` drives the deployed site and the local live mode; findings that get fixed gain a regression test here.

## Regression tests

When `/qa` fixes a bug, it adds a test with an attribution comment naming the issue id, the date and the report, so the reason for the test survives the fix.
