# Architecture

This document contains a distilled public version of TechSpokes architecture guidance for template-driven agent skill repositories.

This template separates bootstrap instructions from generated skill content.

## Architectural Goal

The architecture supports a one-way transition from template to standalone skill repository.

The template is useful only while it helps an agent transform intake into a maintained skill. After that transformation, the template structure becomes a liability because it can confuse future agents about which instructions are authoritative.

## Design Values

- Separate user evidence from agent instructions.
- Separate temporary bootstrap logic from durable skill content.
- Preserve reasoning that future maintainers need.
- Remove construction scaffolding when it no longer serves the generated repository.
- Keep release artifacts focused on runtime skill use.

## Bootstrap Mode

Bootstrap mode is the initial state after a repository is created from this template.

Important areas:

- `.intake/` contains user source material.
- `.template/` contains agent bootstrap instructions.
- `.template/generated/` contains files that are installed into generated skill repositories.
- `skills/placeholder-skill/` contains the standard placeholder source until the final skill name is confirmed.
- `tests/fixtures/` contains maintenance examples that must not enter the installed runtime.
- `docs/` contains template documentation until rewritten.
- `packaging/` contains reusable plugin manifest skeletons.

The reason to keep these areas separate is that each area has a different authority level. Intake is evidence from the user. Template files are instructions for the builder. `skills/<name>/` becomes the runtime product, while `tests/` remains maintenance evidence.

Bootstrap mode includes an intake adequacy step before skill construction. This step determines whether the available intake can support a transferable skill or whether the agent must resolve missing evidence first.

## Skill Mode

Skill mode is the final state after the agent builds the skill and cleans up bootstrap files.

Important areas:

- `skills/<name>/SKILL.md` is the canonical skill entry point and its directory name matches frontmatter.
- `skills/<name>/references/` contains durable runtime knowledge.
- `tests/fixtures/` contains activation and behavior evidence outside the installable tree.
- `docs/` explains the generated skill.
- `AGENTS.md` explains how future agents maintain the skill.
- `.github/` explains how GitHub issues, discussions, reviews, funding, and repository automation work for the generated skill.
- `.template/` is deleted.

Generated skill workflows are installed from `.template/generated/.github/workflows/` during cleanup. The template repository keeps only template-owned workflows active so it validates the scaffold and drafts template releases without publishing placeholder skill assets.

The reason `.template/` is deleted is not tidiness. It prevents future agents from optimizing for bootstrap goals after the repository's purpose has changed.

## Authority Model

During bootstrap, authority flows in this order:

1. User request and repository `AGENTS.md`.
2. `.template/bootstrap/` instructions.
3. `.intake/` source material.
4. Existing placeholder files.

When `.intake/` is empty or insufficient, the agent may create temporary assessment files under `.template/state/` and durable evidence under `.intake/`. The assessment files guide construction while bootstrap mode is active. The evidence files become part of the intake boundary and must still be excluded from release artifacts unless transformed into safe runtime references.

During maintenance mode, authority changes:

1. The generated repository `AGENTS.md`.
2. `docs/ARCHITECTURE.md`.
3. Generated docs and release process.
4. `skills/<name>/SKILL.md`.
5. New material intentionally placed in `.intake/` for updates.

`skills/<name>/SKILL.md` is the canonical skill entry point for installed agent hosts, but it is not the highest-level design authority for repository maintenance. In maintenance work, `SKILL.md` is the runtime implementation of the skill. It should stay aligned with the repository `AGENTS.md` and the design intent documented in `docs/ARCHITECTURE.md`.

## Delivery Channels

GitHub CLI source installation and release ZIP installation share one canonical runtime tree. GitHub CLI reads the tagged Git tree and adds source metadata, while browser and plugin hosts use the packaged standalone, Codex plugin, and Claude plugin ZIPs.

The generated draft release workflow remains authoritative for curated notes, packages, checksums, attestations, and publication review. Clean `gh skill publish --dry-run` validation checks the source layout without delegating release creation to the preview publisher.

After publication, an ephemeral workflow installs the versionless public release and compares the installed tree without executing it. This confirms the delivery channel while keeping GitHub CLI optional for runtime use.

This authority shift is why rewriting `AGENTS.md` is required. The old file governs construction. The new file governs maintenance. `docs/ARCHITECTURE.md` should preserve the reasoning behind the generated skill's structure so future agents can judge when an implementation change is aligned with the design and when it changes the design itself.

## Communication Design

The template applies cross-intelligence communication rules:

- Goals appear before procedures.
- Terms with likely ambiguity are defined.
- Hard rules are separate from context.
- Critical constraints are front-loaded.
- Release packaging boundaries are explicit.
- Validation checks deterministic conditions where possible.

These rules exist because future agents may load partial context, interpret terms differently, or operate under different host constraints. Rationale gives them enough orientation to adapt while preserving purpose.

## Theory Integration

The underlying theory files are intentionally not bundled as full research documents. They are large, exploratory, and broader than this template's operational need.

The template uses adapted theory instead:

- `.template/bootstrap/theory-context.md` carries the compact reasoning model for bootstrap agents.
- `.template/bootstrap/cross-intelligence-communication.md` converts that model into practical writing rules.
- Generated repositories should preserve relevant rationale in `AGENTS.md`, `README.md`, and `docs/ARCHITECTURE.md`.

This keeps bootstrap context useful without forcing every generated repository to inherit the full research archive.

## Maintenance Implication

Generated repositories should keep enough reasoning to support future updates. Maintenance docs should explain why the skill is structured as it is, which references are volatile, which boundaries protect scope, and which release rules protect users.

Do not preserve bootstrap rationale just because it exists. Preserve only rationale that helps maintain the generated skill.
