/* global process */
/**
 * Verifies that GitHub CLI installed the repository's canonical skill from the expected published release.
 * @since 1.4.0
 * @why Generated repositories need an end-to-end source delivery check without executing installed skill content.
 * @constraints Reads one canonical skills/<name> tree and one caller-provided install root; it never installs, executes, deletes, or writes skill files.
 * @see ../docs/GITHUB-CLI-DELIVERY.md
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const options = parseArguments(process.argv.slice(2));
const source = discoverCanonicalSkill(options.sourceRoot || root);

if (options.printSkillName) {
  process.stdout.write(source.name + "\n");
  process.exit(0);
}

for (const required of ["installRoot", "repository", "tag"]) {
  if (!options[required]) {
    throw new Error("Missing required option --" + toKebabCase(required) + ".");
  }
}

verifyInstalledSkill(source, options);
console.log("Verified gh skill installation for " + source.name + " from " + options.repository + "@" + options.tag + ".");

/**
 * Parses the verification command arguments.
 * @param {string[]} args Command arguments after the Node executable and script path.
 * @returns {{printSkillName: boolean, installRoot: string, repository: string, tag: string, sourceRoot: string}} Parsed options with empty strings for omitted values.
 * @throws {Error} When an option is unknown or lacks a value.
 */
function parseArguments(args) {
  const parsed = { printSkillName: false, installRoot: "", repository: "", tag: "", sourceRoot: "" };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--print-skill-name") {
      parsed.printSkillName = true;
      continue;
    }

    const key = {
      "--install-root": "installRoot",
      "--repository": "repository",
      "--tag": "tag",
      "--source-root": "sourceRoot"
    }[argument];

    if (!key) {
      throw new Error("Unknown option " + argument + ".");
    }
    if (index + 1 >= args.length || args[index + 1].startsWith("--")) {
      throw new Error("Option " + argument + " requires a value.");
    }
    parsed[key] = args[index + 1];
    index += 1;
  }

  return parsed;
}

/**
 * Finds the repository's single standard skill source.
 * @param {string} repositoryRoot Repository root that contains the canonical skills directory.
 * @returns {{name: string, directory: string, skillFile: string}} Canonical skill identity and absolute source paths.
 * @throws {Error} When the repository does not contain exactly one standard source or its name disagrees with the directory.
 */
function discoverCanonicalSkill(repositoryRoot) {
  const skillsRoot = path.join(path.resolve(repositoryRoot), "skills");
  const candidates = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
    : [];

  if (candidates.length !== 1) {
    throw new Error("Expected exactly one skills/<name>/SKILL.md source, found " + candidates.length + ".");
  }

  const name = candidates[0];
  const directory = path.join(skillsRoot, name);
  const skillFile = path.join(directory, "SKILL.md");
  const frontmatter = parseFrontmatter(fs.readFileSync(skillFile, "utf8"));
  if (frontmatter.values.name !== name) {
    throw new Error("Canonical skill name " + (frontmatter.values.name || "<missing>") + " does not match directory " + name + ".");
  }
  if (/^\s+github-/m.test(frontmatter.yaml)) {
    throw new Error("Canonical SKILL.md contains GitHub install metadata and cannot be published.");
  }

  return { name, directory, skillFile };
}

/**
 * Checks installed source metadata, portable content, and runtime file identity.
 * @param {{name: string, directory: string, skillFile: string}} source Canonical source discovered in this repository.
 * @param {{installRoot: string, repository: string, tag: string}} verification Expected installation root and release identity.
 * @returns {void}
 * @throws {Error} When containment, metadata, inventory, or content differs from the release contract.
 */
function verifyInstalledSkill(source, verification) {
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$/.test(verification.tag)) {
    throw new Error("Expected tag " + verification.tag + " does not use vX.Y.Z release syntax.");
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(verification.repository)) {
    throw new Error("Expected repository " + verification.repository + " is not OWNER/REPO.");
  }

  const installRoot = path.resolve(verification.installRoot);
  const installedDirectory = path.resolve(installRoot, source.name);
  assertContained(installRoot, installedDirectory);
  const installedSkillFile = path.join(installedDirectory, "SKILL.md");
  if (!fs.existsSync(installedSkillFile)) {
    throw new Error("Installed SKILL.md is missing at " + installedSkillFile + ".");
  }

  const installed = parseFrontmatter(fs.readFileSync(installedSkillFile, "utf8"));
  const expectedMetadata = {
    "github-path": "skills/" + source.name,
    "github-ref": "refs/tags/" + verification.tag,
    "github-repo": "https://github.com/" + verification.repository
  };

  for (const [key, expected] of Object.entries(expectedMetadata)) {
    if (installed.metadata[key] !== expected) {
      throw new Error("Installed metadata " + key + " is " + (installed.metadata[key] || "<missing>") + "; expected " + expected + ".");
    }
  }
  if (!/^[0-9a-f]{40}$/.test(installed.metadata["github-tree-sha"] || "")) {
    throw new Error("Installed metadata github-tree-sha is missing or invalid.");
  }
  if (installed.metadata["github-pinned"]) {
    throw new Error("Versionless release verification unexpectedly produced a pinned installation.");
  }

  const canonical = parseFrontmatter(fs.readFileSync(source.skillFile, "utf8"));
  for (const key of ["name", "description", "license", "compatibility", "allowed-tools"]) {
    if ((installed.values[key] || "") !== (canonical.values[key] || "")) {
      throw new Error("Installed frontmatter field " + key + " differs from the canonical source.");
    }
  }
  if (normalizeSkillBody(installed.body) !== normalizeSkillBody(canonical.body)) {
    throw new Error("Installed SKILL.md body differs from the canonical source.");
  }

  const sourceFiles = listRuntimeFiles(source.directory);
  const installedFiles = listRuntimeFiles(installedDirectory);
  if (JSON.stringify(installedFiles) !== JSON.stringify(sourceFiles)) {
    throw new Error("Installed file inventory differs from source.");
  }

  for (const relativePath of sourceFiles) {
    if (relativePath === "SKILL.md") {
      continue;
    }
    const sourceBytes = fs.readFileSync(path.join(source.directory, relativePath));
    const installedBytes = fs.readFileSync(path.join(installedDirectory, relativePath));
    if (!equivalentRuntimeFile(sourceBytes, installedBytes)) {
      throw new Error("Installed runtime file " + relativePath + " differs from the canonical source.");
    }
  }
}

/**
 * Parses portable scalar frontmatter and injected GitHub metadata.
 * @param {string} content Complete SKILL.md content.
 * @returns {{yaml: string, body: string, values: Record<string, string>, metadata: Record<string, string>}} Parsed sections and relevant mappings.
 * @throws {Error} When the file lacks a complete YAML frontmatter block.
 */
function parseFrontmatter(content) {
  const normalized = normalizeNewlines(content);
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    throw new Error("SKILL.md must start with a complete YAML frontmatter block.");
  }

  const yaml = match[1];
  const values = {};
  const metadata = {};
  let inMetadata = false;

  for (const line of yaml.split("\n")) {
    const topLevel = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (topLevel) {
      inMetadata = topLevel[1] === "metadata";
      values[topLevel[1]] = unquote(topLevel[2].trim());
      continue;
    }
    if (inMetadata) {
      const nested = line.match(/^\s+([A-Za-z0-9_-]+):\s*(.*)$/);
      if (nested) {
        metadata[nested[1]] = unquote(nested[2].trim());
      }
    }
  }

  return { yaml, body: normalized.slice(match[0].length), values, metadata };
}

/**
 * Lists regular runtime files without following symbolic links.
 * @param {string} directory Absolute skill directory to inspect.
 * @returns {string[]} Sorted slash-separated paths relative to the skill directory.
 * @throws {Error} When a symbolic link or unsupported entry appears.
 */
function listRuntimeFiles(directory) {
  const files = [];

  function visit(current, prefix = "") {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const relativePath = prefix ? prefix + "/" + entry.name : entry.name;
      const absolutePath = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error("Runtime tree contains unsupported symbolic link " + relativePath + ".");
      }
      if (entry.isDirectory()) {
        visit(absolutePath, relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      } else {
        throw new Error("Runtime tree contains unsupported entry " + relativePath + ".");
      }
    }
  }

  visit(directory);
  return files.sort();
}

/**
 * Rejects paths that resolve outside the caller-provided installation root.
 * @param {string} parent Absolute containment root.
 * @param {string} child Absolute path expected below the root.
 * @returns {void}
 * @throws {Error} When the child is equal to or outside the containment root.
 */
function assertContained(parent, child) {
  const relative = path.relative(parent, child);
  if (!relative || path.isAbsolute(relative) || relative.startsWith(".." + path.sep) || relative === "..") {
    throw new Error("Refusing to inspect path outside the install root: " + child + ".");
  }
}

function normalizeNewlines(value) {
  return value.replace(/\r\n/g, "\n");
}

function normalizeSkillBody(value) {
  return normalizeNewlines(value).replace(/^\n/, "");
}

/**
 * Compares binary files exactly and UTF-8 text files after local checkout newline normalization.
 * @param {Buffer} sourceBytes Canonical checkout bytes.
 * @param {Buffer} installedBytes GitHub API installation bytes.
 * @returns {boolean} Whether the files represent the same runtime content.
 */
function equivalentRuntimeFile(sourceBytes, installedBytes) {
  if (sourceBytes.equals(installedBytes)) {
    return true;
  }

  try {
    const decoder = new TextDecoder("utf-8", { fatal: true });
    return normalizeNewlines(decoder.decode(sourceBytes)) === normalizeNewlines(decoder.decode(installedBytes));
  } catch {
    return false;
  }
}

function unquote(value) {
  return value.replace(/^(["'])(.*)\1$/, "$2");
}

function toKebabCase(value) {
  return value.replace(/[A-Z]/g, (letter) => "-" + letter.toLowerCase());
}
