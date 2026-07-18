# Install and Update This Skill

This is a bootstrap scaffold. Rewrite it with the final repository and skill identity, then link it directly from the final `SKILL.md` for requests to install, locate, update, repair, reinstall, or verify that skill.

## Required Runtime Sequence

The generated reference must tell an agent to locate the installed `SKILL.md`, record its actual parent skills folder, and inspect the generated repository, path, ref, tree, and pin metadata before changing files.

The agent must detect `gh skill`, run a read-only update check with `--dir` limited to the actual parent folder, review an available change, and apply only that installation after the user's update request and replacement effect are clear.

The generated commands must use the final skill name and the literal discovered folder in place of any scaffold placeholder:

```bash
gh skill update skill-name --dry-run --dir "<ABSOLUTE_SKILLS_FOLDER>"
gh skill update skill-name --all --dir "<ABSOLUTE_SKILLS_FOLDER>"
```

A pin requires a separate user decision before `--unpin`. Missing or conflicting source metadata, local modifications, an unexpected path, or a manually copied installation must stop automatic replacement and route to the generated root installation guide.

Verification reports the final source, ref, and path without executing retrieved skill scripts or modifying unrelated skills, repositories, user files, or host configuration.
