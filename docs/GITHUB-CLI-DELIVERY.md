# GitHub CLI Skill Delivery

This document defines the reusable delivery architecture for a generated dedicated skill repository.

## Source Contract

Keep exactly one canonical `skills/<name>/SKILL.md` tree. The frontmatter name must match its containing directory, and maintenance fixtures belong under root `tests/` rather than inside the runtime tree.

GitHub CLI discovers and installs the standard source directly from a Git tree. Release ZIP packaging and plugin wrappers must copy that same canonical tree so every channel shares one runtime source.

## Resolution and Installed State

A versionless install selects the latest published release and falls back to the default branch only when no usable release exists. Explicit pins are for reproducible workflows and remain outside normal update movement.

Installed `SKILL.md` frontmatter receives repository, ref, path, tree, and optional pin metadata. Canonical source must not contain generated `github-*` metadata.

An update name can match several copies across host, user, project, and test folders. Use a dry run before mutation, review every destination, and use `--dir` with an actual parent skills folder when one copy must be targeted.

## Release Architecture

The generated tag workflow remains authoritative for validation, three ZIP packages, checksums, attestations, curated notes, draft review, and publication. Run `gh skill publish --dry-run` from a clean checkout before packaging.

Do not use `gh skill publish --tag` in the generated workflow. It can push the branch and create an immediately published release without the generated repository's package, checksum, attestation, draft, or curated note sequence.

After the draft is published, the release event workflow performs a public versionless install in an ephemeral runner and verifies repository, tag, source path, tree metadata, runtime inventory, and content without executing the installed skill.

## Containment

Publisher validation scans the working directory and can find ignored research, package stages, or installed copies. Run it before `dist/` exists and use a clean checkout in release automation.

Remote install can write the selected destination and tracking state below the effective user home. Manual tests therefore require a disposable profile as well as a temporary install folder.

## Generated Repository Work

Bootstrap must rename `skills/placeholder-skill/` to the final frontmatter name, rewrite public installation and GitHub CLI guides with the final repository identity, keep the runtime update reference focused, retain platform neutral scripts, install all three generated workflows, and add the `agent-skills` repository topic after user approval.

Maintenance validation must discover the canonical source dynamically, reject ambiguous sources and name mismatch, preserve the release cleanup boundary, and keep GitHub CLI optional at runtime.

## Verification

Run:

```bash
npm run validate
npm run package -- vX.Y.Z
```

Inspect the three ZIPs and `SHA256SUMS`, confirm excluded bootstrap and private material is absent, run the publisher dry run in a clean checkout, and verify the public versionless install after release publication.

## Rollback

If the preview command changes incompatibly, keep the release ZIP path available and correct the documented preferred path in a new release. Never move a published tag or rewrite an existing published release to hide a failed delivery contract.
