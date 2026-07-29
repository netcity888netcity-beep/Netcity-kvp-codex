# Contributing to KVP / NetCityOS

Thank you for helping build KVP and NetCityOS. The project values small,
reviewable changes and reproducible evidence over presentation-only progress.

## Before starting

1. Read `README.md`, `BUILDERS_CALL.md`, `SECURITY.md`, and the relevant design
   documents under `docs/`.
2. Choose one bounded problem. Discuss architectural or cross-component changes
   before implementation.
3. Record the current branch, exact HEAD, and `git status --short`.
4. Never overwrite or clean an existing contributor's worktree.

## Pull request requirements

Every pull request must state:

- the problem and bounded scope;
- files and public contracts changed;
- exact test commands and results;
- security, privacy, compatibility, and rollback considerations;
- known limitations and intentionally skipped checks.

Keep generated files, caches, build output, editor locks, databases, audit
backups, and credentials out of commits.

## Baseline offline checks

Use `docs/offline-test-runbook.md` when available. The current baseline includes:

```text
python -B -m unittest discover -s tests -p "test_model_gateway_contract.py" -v
cargo fmt --all -- --check
cargo test --workspace --all-targets --locked --offline
cargo clippy --workspace --all-targets --locked --offline -- -D warnings
```

Do not install dependencies or contact external providers merely to make an
evidence run pass. Report unavailable tooling as skipped with the reason.

## Engineering expectations

- fail closed at trust boundaries;
- authenticate before authorization and before reserving bounded replay state;
- treat caller-supplied identity and role fields as assertions, not credentials;
- report delivery only after an actual recipient-side effect;
- preserve idempotency and explicit unknown-outcome semantics;
- bound queues, payloads, logs, state, timeouts, and retries;
- avoid secret or personal data in logs and fixtures;
- keep production claims no stronger than their automated evidence.

## Commit and review hygiene

- use a focused branch and descriptive commit message;
- do not mix unrelated formatting or generated artifacts into a change;
- do not rewrite shared history without explicit maintainer coordination;
- respond to review findings with code, tests, or a documented rationale;
- never stage, commit, or publish another contributor's local audit artifacts.

## Community conduct

Be respectful, precise, and welcoming. Critique code and claims, not people.
Harassment, coercion, spam, destructive testing, credential solicitation, and
unauthorized access are not accepted.
