# CAI

CAI is a local coding assistant. It performs project navigation and inspection
locally; the provider is reserved for requests that require reasoning.

## Run

Run from either the project root or its `cai` directory:

```text
npm start
```

CAI detects the enclosing project root automatically. A path-shaped request is
never sent to the provider. For example, `src/app/page.tsx` always resolves as
an Open request; if it does not exist in the detected project, CAI returns a
local file-not-found error.

## Execution pipeline

```text
User input
  -> project detection
  -> intent detection
  -> planner
  -> executor
  -> local command OR provider
```

Priority is: existing file, path-shaped local input, built-in command, indexed
search, then provider reasoning. Local operations include `open`, `find`,
`scan`, `analyze`, `project`, `workspace`, `trace`, `review`, `patch`,
`memory`, `git`, and `doctor`.

The planner records its intent decision and the orchestrator prints project and
intent diagnostics. Provider logs include effective GPU layers, context and
batch size, prompt tokens, first-token latency, and total inference time.

## Commands

```text
open <path-or-keyword>
find <keyword>
scan
analyze
trace <file>
review
patch replace <file> <search> <replacement> [--dry-run]
memory
git [status|diff|log]
doctor
project
workspace
ask <reasoning request>
```

## Provider configuration

`config/config.js` selects the provider and model. Ollama with `qwen2.5:3b` is
the default. node-llama-cpp with Qwen 7B remains an optional fallback. CAI
checks configured providers in order and falls back when one is unavailable.

Set these environment variables to switch without changing application code:

```text
CAI_GPU_LAYERS
CAI_CONTEXT_SIZE
CAI_BATCH_SIZE
CAI_THREADS
CAI_MAX_TOKENS
CAI_PROVIDER
CAI_OLLAMA_MODEL
CAI_OLLAMA_HOST
```

## Verification

```text
npm test
npm run selftest
```

The test suite covers project detection, path routing, planner fallbacks, Open,
project analysis, provider initialization, provider timeout behavior, safe
patching, project-memory persistence, review/trace commands, and Git command
allow-listing.

## Safety and diagnostics

`patch` is local-only: it accepts only a workspace file, requires exactly one
match for replace/delete operations, supports `--dry-run`, creates a
`.cai/backups` copy before writing, and verifies final content. `.cai` and
generated build folders are excluded from scans.

`doctor` reports project, index, and provider health. `git` supports read-only
`status`, `diff`, and `log` views only; CAI does not commit, push, or deploy
implicitly.

## Adding commands and providers

Add a command module in `commands/`, register it in `planner/planner.js` and
`executor/executor.js`, and add a regression test. Providers must expose an
async `ask(prompt)` method and must never be selected by local commands.
