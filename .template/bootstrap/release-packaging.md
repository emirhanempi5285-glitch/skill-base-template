# Release Packaging

## Goal

Create release assets that install cleanly as a standalone skill and as plugin packages.

## Why Packaging Has Strict Boundaries

Packaging is the point where repository content becomes installable capability. Anything included in the ZIP can be loaded by an agent host or inspected by users.

Strict exclusions protect privacy, reduce context noise, and prevent bootstrap instructions from competing with the generated skill's runtime instructions.

## Packaging Values

- Include only files needed to use the skill.
- Keep package structure predictable across releases.
- Keep version metadata synchronized.
- Refuse ambiguous releases instead of producing misleading artifacts.
- Prefer clean draft releases over mutating published releases.

## Version Source

Use Git tags in `vX.Y.Z` format as the release source of truth.

For every release tag:

- `CHANGELOG.md` must contain `## [vX.Y.Z]`.
- `docs/releases/vX.Y.Z.md` must exist.
- Package manifests must use version `X.Y.Z`.

## Required Assets

Every release should produce three ZIP files and one checksum manifest:

- `skill-name-vX.Y.Z.zip`
- `skill-name-codex-plugin-vX.Y.Z.zip`
- `skill-name-claude-plugin-vX.Y.Z.zip`
- `SHA256SUMS`

The workflow should attest each ZIP after packaging and before upload.

## Canonical Source

Package from exactly one `skills/<name>/SKILL.md` tree whose directory and frontmatter names agree. GitHub CLI source installation reads this tagged tree directly, while release and plugin consumers receive copies of the same runtime content.

Keep maintenance fixtures under root `tests/` so source installation and release packages do not deliver them as runtime instructions.

## Exclusions

Release assets must not include:

- `.template/`
- `.intake/`
- `.git/`
- `.idea/`
- `.github/`
- `docs/`
- `tmp/`
- `dist/`
- `node_modules/`
- `setup.plan.yaml`

Rationale: These files are repository, bootstrap, or development artifacts. They do not help an installed agent execute the skill.

## Manifest Rules

The Codex plugin manifest lives at `packaging/codex-plugin/.codex-plugin/plugin.json`.

The Claude plugin manifest lives at `packaging/claude-plugin/.claude-plugin/plugin.json`.

When the generated skill name or version changes, update both manifests.

Rationale: Manifests are the package identity seen by host systems. Stale manifests cause confusion even when the skill files themselves are correct.

## Workflow Rules

The draft release workflow should package from the tagged commit, generate checksums, attest every ZIP, and refuse to mutate a published release when notes or changelog entries are missing.

Run `gh skill publish --dry-run` in a clean checkout before packaging creates `dist/`. Do not use `gh skill publish --tag` because it bypasses the generated package, checksum, attestation, curated note, draft, and review sequence.

After publication, a separate release event workflow should install the versionless public release into an ephemeral profile and verify source metadata, file inventory, and content without executing the installed skill.

Rationale: A tag is a promise that the repository state, docs, package manifests, and release notes describe the same artifact.

## Bootstrap Location

Generated skill release workflows live in `.template/generated/.github/workflows/` until bootstrap installs them into the generated repository.

Rationale: this file describes generated skill packaging after bootstrap cleanup. Template repository releases use a separate process documented in `docs/TEMPLATE-RELEASING.md`.
