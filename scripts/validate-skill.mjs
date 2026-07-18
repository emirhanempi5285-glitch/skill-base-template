/* global process, Buffer */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const warnings = [];
const bootstrapMode = exists(".template");

/**
 * Finds the dedicated repository's one standard skill source.
 * @returns {{name: string, relativeDirectory: string, skillFile: string}|null} Canonical paths and directory identity, or null after recording a structural failure.
 * @constraints A dedicated generated repository publishes exactly one skills/<name>/SKILL.md tree.
 */
function discoverCanonicalSkill() {
  const skillsRoot = path.join(root, "skills");
  const candidates = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
    : [];

  if (candidates.length !== 1) {
    fail(`Expected exactly one skills/<name>/SKILL.md source, found ${candidates.length}.`);
    return null;
  }

  const name = candidates[0];
  const relativeDirectory = path.join("skills", name);
  return { name, relativeDirectory, skillFile: path.join(relativeDirectory, "SKILL.md") };
}

const canonicalSkill = discoverCanonicalSkill();

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function parseFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return null;
  }

  const end = normalized.indexOf("\n---", 4);
  if (end === -1) {
    return null;
  }

  const block = normalized.slice(4, end).trim();
  const lines = block.split("\n");
  const data = {};
  const types = {};

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (value === ">" || value === "|") {
      const folded = value === ">";
      const collected = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        collected.push(lines[index].trim());
      }
      data[key] = folded ? collected.join(" ") : collected.join("\n");
      types[key] = "string";
      continue;
    }

    if (value === "") {
      const collected = [];
      while (index + 1 < lines.length && /^\s+/.test(lines[index + 1])) {
        index += 1;
        collected.push(lines[index]);
      }
      data[key] = collected.join("\n");
      types[key] = "mapping";
      continue;
    }

    data[key] = value.replace(/^["']|["']$/g, "");
    types[key] = "string";
  }

  return { data, types, keys: Object.keys(data), raw: block };
}

function walk(relativeDir) {
  const absoluteDir = path.join(root, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const files = [];
  for (const entry of fs.readdirSync(absoluteDir, { withFileTypes: true })) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

function validateSkill() {
  if (!canonicalSkill) {
    return;
  }

  const skillText = readText(canonicalSkill.skillFile);
  const parsed = parseFrontmatter(skillText);
  if (!parsed) {
    fail(`${canonicalSkill.skillFile} must start with YAML frontmatter.`);
    return;
  }

  const { data: frontmatter, types } = parsed;
  const standardFields = new Set(["name", "description", "license", "compatibility", "metadata", "allowed-tools"]);
  const vscodeFields = new Set(["argument-hint", "user-invocable", "disable-model-invocation"]);

  for (const key of parsed.keys) {
    if (standardFields.has(key) || vscodeFields.has(key)) {
      continue;
    }
    warn(`${canonicalSkill.skillFile} has non-standard frontmatter field '${key}'. Prefer metadata for portable custom data.`);
  }

  if (!frontmatter.name) {
    fail(`${canonicalSkill.skillFile} frontmatter is missing name.`);
  } else if (frontmatter.name.length > 64) {
    fail("Skill name must be 64 characters or fewer.");
  } else if (frontmatter.name !== canonicalSkill.name) {
    fail(`Skill name ${frontmatter.name} must match its containing directory ${canonicalSkill.name}.`);
  } else if (!/^(?!.*--)[a-z0-9]+(-[a-z0-9]+)*$/.test(frontmatter.name)) {
    fail("Skill name must use lowercase letters, numbers, and hyphens, with no leading, trailing, or consecutive hyphens.");
  }

  if (!frontmatter.description) {
    fail(`${canonicalSkill.skillFile} frontmatter is missing description.`);
  } else if (frontmatter.description.length > 1024) {
    fail("Skill description must be 1024 characters or fewer.");
  } else {
    if (frontmatter.description.trim().length === 0) {
      fail("Skill description must be non-empty.");
    }
    if (frontmatter.description.length < 80) {
      warn("Skill description is short. Include what the skill does and when agents should use it.");
    }
    if (!/\b(use|when|asked|needs?|whenever|trigger|for)\b/i.test(frontmatter.description)) {
      warn("Skill description should include trigger context, not only capability description.");
    }
  }

  if (frontmatter["license"] !== undefined && frontmatter["license"].trim().length === 0) {
    fail("license must be non-empty when provided.");
  }

  if (frontmatter["compatibility"] !== undefined) {
    if (frontmatter["compatibility"].trim().length === 0) {
      fail("compatibility must be non-empty when provided.");
    }
    if (frontmatter["compatibility"].length > 500) {
      fail("compatibility must be 500 characters or fewer.");
    }
  }

  if (frontmatter.metadata !== undefined && types.metadata !== "mapping") {
    fail("metadata must be a YAML mapping when provided.");
  }

  if (frontmatter["allowed-tools"] !== undefined && types["allowed-tools"] !== "string") {
    fail("allowed-tools must be a space-separated string when provided.");
  }

  for (const key of ["user-invocable", "disable-model-invocation"]) {
    if (frontmatter[key] !== undefined && !/^(true|false)$/.test(frontmatter[key])) {
      fail(`${key} must be true or false when provided.`);
    }
  }

  if (frontmatter["argument-hint"] !== undefined && frontmatter["argument-hint"].trim().length === 0) {
    fail("argument-hint must be non-empty when provided.");
  }

  if (bootstrapMode && canonicalSkill.name !== "placeholder-skill") {
    fail("Bootstrap mode requires skills/placeholder-skill/SKILL.md until the final name is chosen and all bootstrap references are updated.");
  }

  if (!bootstrapMode && skillText.includes(".template/")) {
    fail(`${canonicalSkill.skillFile} must not reference .template/ after generation.`);
  }
}

function validateReferences() {
  const markdownFiles = canonicalSkill ? walk(canonicalSkill.relativeDirectory).filter((file) => file.endsWith(".md")) : [];
  const linkPattern = /\[[^\]]+]\(([^)]+)\)/g;

  for (const file of markdownFiles) {
    const text = readText(file);
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
      const target = match[1];
      if (/^(https?:|mailto:|#)/.test(target)) {
        continue;
      }

      const cleaned = target.split("#")[0];
      if (!cleaned) {
        continue;
      }

      const resolved = path.normalize(path.join(path.dirname(file), cleaned));
      if (!exists(resolved)) {
        fail(`${file} links to missing file ${target}.`);
      }
    }
  }
}

function validateManifests() {
  const packageManifest = JSON.parse(readText("package.json"));
  const manifestPaths = [
    "packaging/codex-plugin/.codex-plugin/plugin.json",
    "packaging/claude-plugin/.claude-plugin/plugin.json"
  ];

  for (const manifestPath of manifestPaths) {
    if (!exists(manifestPath)) {
      fail(`Missing ${manifestPath}.`);
      continue;
    }

    try {
      const manifest = JSON.parse(readText(manifestPath));
      for (const key of ["name", "version", "description", "license"]) {
        if (!manifest[key]) {
          fail(`${manifestPath} is missing ${key}.`);
        }
      }
      if (manifestPath.includes(".claude-plugin") && !manifest.displayName) {
        fail(`${manifestPath} is missing top-level displayName.`);
      }
      if (canonicalSkill && manifest.name !== canonicalSkill.name) {
        fail(`${manifestPath} name must match the canonical skill directory.`);
      }
      if (!bootstrapMode && manifest.version !== packageManifest.version) {
        fail(`${manifestPath} version must match package.json in maintenance mode.`);
      }
    } catch (error) {
      fail(`${manifestPath} is not valid JSON: ${error.message}`);
    }
  }
}

function validateReleaseNotes() {
  if (!exists("CHANGELOG.md")) {
    fail("Missing CHANGELOG.md.");
  }

  if (!exists("docs/releases/README.md")) {
    fail("Missing docs/releases/README.md.");
  }
}

function validatePackagingBoundaries() {
  const sourceFiles = canonicalSkill ? walk(canonicalSkill.relativeDirectory) : [];
  for (const file of sourceFiles) {
    if (file.split(path.sep).includes("test-fixtures")) {
      fail(`${file} is a maintenance fixture inside the runtime source; move it to tests/fixtures/.`);
    }
    const text = fs.readFileSync(path.join(root, file));
    if (!bootstrapMode && text.includes(Buffer.from(".template/"))) {
      fail(`${file} references bootstrap control files.`);
    }
  }
}

function validateWorkflowMode() {
  if (bootstrapMode) {
    if (!exists(".github/workflows/template-ci.yml")) {
      fail("Template mode requires .github/workflows/template-ci.yml.");
    }
    for (const workflow of ["ci.yml", "release-draft.yml", "gh-skill-install.yml"]) {
      if (!exists(`.template/generated/.github/workflows/${workflow}`)) {
        fail(`Template mode requires generated workflow ${workflow}.`);
      }
    }
    for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release-draft.yml", ".github/workflows/gh-skill-install.yml"]) {
      if (exists(workflow)) {
        fail(`${workflow} should live under .template/generated/ while the repository is in template mode.`);
      }
    }
    return;
  }

  if (exists(".github/workflows/template-ci.yml")) {
    fail("Maintenance mode must remove .github/workflows/template-ci.yml.");
  }
  for (const workflow of [".github/workflows/ci.yml", ".github/workflows/release-draft.yml", ".github/workflows/gh-skill-install.yml"]) {
    if (!exists(workflow)) {
      fail(`Maintenance mode requires ${workflow}.`);
    }
  }
}

/**
 * Validates the reusable GitHub CLI source and release delivery contract.
 * @returns {void}
 * @constraints The template validates generated workflows in bootstrap mode and installed workflows in maintenance mode without publishing a release.
 */
function validateDeliveryContract() {
  for (const file of ["INSTALL.md", "docs/GITHUB-CLI.md", "docs/GITHUB-CLI-DELIVERY.md", "scripts/verify-gh-skill-install.mjs", "tests/fixtures/README.md"]) {
    if (!exists(file)) {
      fail(`Missing delivery file ${file}.`);
    }
  }

  if (exists("src")) {
    fail("The obsolete src/ skill source must be removed after migrating to skills/<name>/.");
  }

  if (canonicalSkill) {
    const updateReference = path.join(canonicalSkill.relativeDirectory, "references", "install-and-update-this-skill.md");
    const skillText = readText(canonicalSkill.skillFile);
    if (!exists(updateReference)) {
      fail(`Missing focused runtime update reference ${updateReference}.`);
    } else if (!skillText.includes("references/install-and-update-this-skill.md")) {
      fail(`${canonicalSkill.skillFile} must link the focused runtime update reference directly.`);
    }
  }

  if (!bootstrapMode) {
    for (const file of ["README.md", "INSTALL.md", "docs/GITHUB-CLI.md", "docs/GITHUB-CLI-DELIVERY.md"]) {
      const text = readText(file);
      if (/OWNER\/REPOSITORY|placeholder-skill|skill-name/i.test(text)) {
        fail(`${file} contains a bootstrap identity placeholder after cleanup.`);
      }
    }
  }

  const packageScript = readText("scripts/package-release.mjs");
  for (const expected of ["fileURLToPath(import.meta.url)", "Expected exactly one skills/<name>/SKILL.md source", "relative !== \"dist\"", "SHA256SUMS"]) {
    if (!packageScript.includes(expected)) {
      fail(`scripts/package-release.mjs is missing delivery contract: ${expected}.`);
    }
  }

  const packageManifest = JSON.parse(readText("package.json"));
  if (packageManifest.scripts?.["verify:gh-skill"] !== "node scripts/verify-gh-skill-install.mjs") {
    fail("package.json must expose the platform-neutral GitHub CLI install verifier.");
  }

  const workflowRoot = bootstrapMode ? ".template/generated/.github/workflows" : ".github/workflows";
  const ciWorkflow = readText(`${workflowRoot}/ci.yml`);
  const releaseWorkflow = readText(`${workflowRoot}/release-draft.yml`);
  const installWorkflow = readText(`${workflowRoot}/gh-skill-install.yml`);

  for (const [label, text] of [["CI", ciWorkflow], ["release", releaseWorkflow]]) {
    if (!text.includes("gh skill publish --dry-run")) {
      fail(`${label} workflow must validate the clean GitHub CLI skill source before packaging.`);
    }
    if (text.includes("gh skill publish --tag")) {
      fail(`${label} workflow must not bypass the generated package and draft release pipeline with gh skill publish --tag.`);
    }
  }

  for (const expected of ["id-token: write", "attestations: write", "actions/attest@v4", "subject-path: dist/assets/*.zip", "dist/assets/SHA256SUMS --clobber"]) {
    if (!releaseWorkflow.includes(expected)) {
      fail(`Generated release workflow is missing provenance contract: ${expected}.`);
    }
  }

  for (const expected of ["types:\n      - published", "permissions:\n  contents: read", "gh skill install", "scripts/verify-gh-skill-install.mjs", "npm run verify:gh-skill"]) {
    if (!installWorkflow.includes(expected)) {
      fail(`Generated install workflow is missing delivery contract: ${expected}.`);
    }
  }

  const markdownInstructions = readText(".github/instructions/markdown.instructions.md");
  for (const expected of ["one physical source line", "one idea", "one empty line", "Do not hard wrap prose"]) {
    if (!markdownInstructions.includes(expected)) {
      fail(`Markdown instructions are missing source formatting rule: ${expected}.`);
    }
  }
}

/**
 * Rejects hard wrapped prose and list continuations in release Markdown while ignoring table alignment.
 * @returns {void}
 * @constraints Modern readers provide soft wrapping; one physical line preserves each paragraph as one machine-readable block.
 */
function validateReleaseMarkdownWrapping() {
  const releaseFiles = walk("docs/releases").filter((file) => file.endsWith(".md") && exists(file));

  for (const file of releaseFiles) {
    const lines = readText(file).replace(/\r\n/g, "\n").split("\n");
    let inFence = false;
    let previousKind = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("```")) {
        inFence = !inFence;
        previousKind = null;
        continue;
      }
      if (inFence || trimmed.length === 0) {
        previousKind = null;
        continue;
      }
      if (/^#{1,6}\s|^\||^(?:[-*+] |\d+\. )|^>|^---+$/.test(trimmed)) {
        previousKind = /^(?:[-*+] |\d+\. )/.test(trimmed) ? "list" : null;
        continue;
      }
      if (previousKind === "prose" || (previousKind === "list" && /^\s/.test(line))) {
        fail(`${file} hard-wraps a paragraph or list item; keep each Markdown block on one physical source line.`);
        break;
      }
      previousKind = "prose";
    }
  }
}

validateSkill();
validateReferences();
validateManifests();
validateReleaseNotes();
validatePackagingBoundaries();
validateWorkflowMode();
validateDeliveryContract();
validateReleaseMarkdownWrapping();

if (failures.length > 0) {
  console.error("Validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

for (const warning of warnings) {
  console.warn(`Warning: ${warning}`);
}

console.log("Validation passed.");
