# Quality toolchain

Run `npm ci --ignore-scripts`, then `npm run tools:setup`, then `npm run quality`.
The shared supported platforms are Linux x64 and macOS arm64. cccc has additional pinned platforms, but similarity-ts does not; setup fails explicitly elsewhere.

The native setup requires Node.js, curl, tar, and a supported platform. Tools are
installed only in ignored `.tools/bin`. Archives are checked against the pinned
SHA-256 values in `quality-tools.lock.json` before extraction or execution. A
missing platform fails explicitly rather than selecting a different version.

## Pinned tools

- [cccc](https://github.com/moznion/cccc/releases/tag/v1.8.6) 1.8.6: cognitive
  complexity limit 15 and cyclomatic complexity limit 10, configured in
  `cccc.toml`. Analyze application TypeScript in src, pages, routes, and db.
- [similarity-ts](https://github.com/mizchi/similarity/releases/tag/v0.5.0) 0.5.0:
  fail on duplicate functions at similarity 0.90 or greater, minimum 8 lines.
  Generated UI and test files are excluded from duplicate detection. These are
  project policy thresholds, not a claim that smaller duplication is harmless.
- [Knip](https://github.com/webpro-nl/knip) 6.44.1: locked npm development
  dependency. `knip.json` declares Void file-routing entry points, database
  schema, scripts, and tests. `oxc-transform-react` is loaded by Void internally,
  so it is explicitly accounted for despite no direct application import.

`quality:complexity`, `quality:similarity`, and `quality:unused` can run
individually. Generated UI is excluded from complexity/duplication, but still
included in Knip's unused code analysis. These checks do not replace type
checking, tests, browser testing, or human review. Use the existing `check`,
`typecheck`, `test`, and `test:e2e` commands as well.

## pstack skills

Unmodified upstream TypeScript and no-comments skills, supporting TypeScript
principles, and the Comment Sicko review prompt are vendored from
[cursor/plugins pstack](https://github.com/cursor/plugins/tree/2776ddd2355d6d6c8747d3964600f28daf62f049/pstack).
`pstack-source.json` records the commit and Git blob IDs. The upstream MIT license
is retained in `licenses/pstack-LICENSE`.

Read `.agents/skills/typescript-best-practices/SKILL.md` and the associated
principles before changing TypeScript. Read `.agents/skills/no-comments/SKILL.md`
for comment review. This is a focused subset, not installation of the entire
Cursor plugin. Cursor-specific `Task`, slash commands, and speed selection are
not executable Codex APIs. In Codex, delegate a scoped review using
`.agents/pstack-agents/comment-sicko.md`, inspect its findings, then implement
accepted changes with native tools. Do not claim the original no-comments
workflow was fully executed unless its applicable review steps were completed.
Optional upstream architect/how/why/poteto-mode workflows are not bundled.

No-comments is a review discipline, not a license to remove legal notices,
mandatory attribution, or required framework annotations. Source provenance and
licenses remain documentation, separate from application commentary.
