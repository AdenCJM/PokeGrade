@AGENTS.md

## Testing

- Front end: `npm test` (Vitest + Testing Library, files live next to the code as `*.test.ts(x)`). Engine: `npm run engine:test` (pytest). See [TESTING.md](TESTING.md).
- 100% test coverage is the goal; tests are what make fast iteration safe.
- New function: write a test. Bug fix: write a regression test that reproduces the bug first. New error handling: write a test that triggers the error. New conditional: test both paths.
- Never commit code that makes existing tests fail.
