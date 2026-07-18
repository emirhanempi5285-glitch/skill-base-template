# Install the Generated Skill

This root guide is the beginner entry point for a generated skill repository. During bootstrap, replace every `OWNER/REPOSITORY`, `skill-name`, display name, package name, and host example with the final public identity before removing `.template/`.

Do not publish this placeholder guide. A generated repository must present complete commands that a person can copy without editing a flag from an earlier example.

## Choose an Installation Path

| Situation | Recommended path |
|---|---|
| The agent can install skills | Ask the agent with one explicit source and scope instruction |
| GitHub CLI exposes `gh skill` | Install the latest published source release with tracking metadata |
| The host has a native skill manager | Use that supported manager with the canonical repository URL |
| The user does not want a terminal | Download the standalone release ZIP in a browser |
| Only one repository needs the skill | Use the complete project command for the intended host |
| The user contributes to the skill | Clone the maintenance repository and follow its development checks |

GitHub CLI is optional. The generated [GitHub CLI guide](docs/GITHUB-CLI.md) should help a new user decide whether terminal commands, a connector, a native installer, or browser packages fit the current need.

## Ask an Agent

The generated repository must replace this placeholder with one short instruction that names the latest public source, prefers `gh skill install` when available, keeps a native installer and standalone ZIP as fallbacks, rejects GitHub's automatic Source code archive, asks before overwriting, and verifies the final source and location.

## Install With GitHub CLI

Confirm that the installed command exposes Agent Skills:

```bash
gh skill --help
```

The generated repository must provide one complete user scope command for every supported host instead of asking a beginner to alter a previous command.

Codex command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent codex --scope user
```

GitHub Copilot command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent github-copilot --scope user
```

Claude Code command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent claude-code --scope user
```

The bootstrap agent must replace each pattern with the generated repository and skill identity. Versionless installation follows the latest published release and allows later update checks; add a pin only when the user needs a fixed release.

## Install in One Project

The generated guide must present each project command as its own host section, tell the user to open a terminal in the intended repository root, and show the resulting project folder.

Codex project command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent codex --scope project
```

GitHub Copilot project command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent github-copilot --scope project
```

Claude Code project command pattern:

```bash
gh skill install OWNER/REPOSITORY skill-name --agent claude-code --scope project
```

## Install With a Browser

The generated guide must link the latest release, name the standalone `skill-name-vX.Y.Z.zip` asset pattern, warn against `Source code (zip)` and `Source code (tar.gz)`, show the complete inner folder structure, and give current personal locations for every supported host.

Keep `SKILL.md`, `references/`, and genuine runtime assets together. Keep tests, intake, repository docs, bootstrap files, and maintenance scripts outside the installed skill folder.

## Verify

The generated guide must provide one copyable prompt that asks the host to identify the installed skill, recorded source, release ref when available, final path, and a harmless first task. Verification must not execute retrieved scripts merely to prove installation.

Release instructions should also explain `SHA256SUMS` and provenance verification for downloaded ZIPs while making clear that provenance is not a security review.

## Update

A GitHub CLI update begins with the read-only check:

```bash
gh skill update skill-name --dry-run
```

The name can match copies in several host, user, project, and test folders. The generated skill should include a focused update reference that records the current parent skills folder and uses `--dir` when one installation must be targeted.

Pinned installations require a separate decision before `--unpin`. Missing source metadata, local changes, and forced replacement require origin and destination review instead of an automatic `--force` command.

## Repair and Remove

The generated guide must separate diagnosis from mutation, identify the exact destination before replacement, preserve intentional local changes, and remove only the exact skill folder. It must never tell a user or agent to delete a broad profile, project, home, or parent skills directory.

## Maintainer Completion Check

Before cleanup, read this file as a beginner who has no repository context. Confirm that every required command is complete, every placeholder is gone, each choice stands alone, the default path is clear, the effect and destination are stated, and troubleshooting never depends on remembering an earlier section.
