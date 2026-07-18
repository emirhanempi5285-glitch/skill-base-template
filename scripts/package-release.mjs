/* global process */
/**
 * Builds the standalone and plugin archives plus their checksum manifest from the single canonical skill source.
 * @since 1.4.0
 * @why Generated repositories need one portable package path that agrees with GitHub CLI source delivery.
 * @constraints Reads exactly one skills/<name>/SKILL.md tree and resets only this repository's generated dist directory.
 * @see ../.template/bootstrap/release-packaging.md
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tag = process.argv[2];

if (!tag || !/^v[0-9]+\.[0-9]+\.[0-9]+([.-][A-Za-z0-9.-]+)?$/.test(tag)) {
  console.error("Usage: npm run package -- vX.Y.Z");
  process.exit(1);
}

const version = tag.slice(1);
const skill = discoverCanonicalSkill();
const dist = path.join(root, "dist");
const stage = path.join(dist, "stage");
const assets = path.join(dist, "assets");

resetDist(dist);
fs.mkdirSync(stage, { recursive: true });
fs.mkdirSync(assets, { recursive: true });

stageStandalone(skill);
stagePlugin("codex", skill, version);
stagePlugin("claude", skill, version);

const standaloneAsset = path.join(assets, `${skill.name}-${tag}.zip`);
const codexAsset = path.join(assets, `${skill.name}-codex-plugin-${tag}.zip`);
const claudeAsset = path.join(assets, `${skill.name}-claude-plugin-${tag}.zip`);

zipDirectory(path.join(stage, skill.name), standaloneAsset);
zipDirectory(path.join(stage, `${skill.name}-codex-plugin`), codexAsset);
zipDirectory(path.join(stage, `${skill.name}-claude-plugin`), claudeAsset);
writeChecksums([standaloneAsset, codexAsset, claudeAsset], path.join(assets, "SHA256SUMS"));

console.log(`Packaged release assets for ${skill.name} ${tag}.`);

/**
 * Discovers and validates the dedicated repository's one canonical skill tree.
 * @returns {{name: string, directory: string, description: string}} Skill identity and absolute source directory.
 * @throws {Error} When the source is missing, ambiguous, or disagrees with its containing directory.
 */
function discoverCanonicalSkill() {
  const skillsRoot = path.join(root, "skills");
  const candidates = fs.existsSync(skillsRoot)
    ? fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(skillsRoot, entry.name, "SKILL.md")))
      .map((entry) => entry.name)
    : [];

  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one skills/<name>/SKILL.md source, found ${candidates.length}.`);
  }

  const directoryName = candidates[0];
  const directory = path.join(skillsRoot, directoryName);
  const text = fs.readFileSync(path.join(directory, "SKILL.md"), "utf8");
  const name = text.match(/\n?name:\s*([a-z0-9-]+)/)?.[1];
  const description = text.match(/\n?description:\s*(.+)/)?.[1]?.trim() || "";

  if (!name || name !== directoryName) {
    throw new Error(`SKILL.md name ${name || "<missing>"} must match its containing directory ${directoryName}.`);
  }

  return { name, directory, description };
}

/**
 * Resets the generated release directory after proving it is the exact repository dist path.
 * @param {string} directory Absolute directory proposed for recursive cleanup.
 * @returns {void}
 * @throws {Error} When the resolved target is not this repository's dist directory.
 * @sideEffects Removes and recreates the generated dist directory.
 */
function resetDist(directory) {
  const resolved = path.resolve(directory);
  const relative = path.relative(root, resolved);
  if (relative !== "dist" || path.isAbsolute(relative)) {
    throw new Error(`Refusing to reset unsafe release directory: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive: true, force: true });
  fs.mkdirSync(resolved, { recursive: true });
}

/**
 * Copies runtime files without symbolic links or placeholder entries and prunes empty directories.
 * @param {string} source Absolute source directory.
 * @param {string} destination Absolute destination directory.
 * @returns {void}
 * @throws {Error} When a symbolic link or unsupported filesystem entry appears.
 * @sideEffects Creates the destination tree and copies regular files.
 */
function copyRuntimeTree(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") {
      continue;
    }
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Runtime source contains unsupported symbolic link ${sourcePath}.`);
    }
    if (entry.isDirectory()) {
      copyRuntimeTree(sourcePath, destinationPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(sourcePath, destinationPath);
    } else {
      throw new Error(`Runtime source contains unsupported entry ${sourcePath}.`);
    }
  }
  if (fs.readdirSync(destination).length === 0) {
    fs.rmdirSync(destination);
  }
}

/**
 * Stages the portable standalone skill folder.
 * @param {{name: string, directory: string}} skill Canonical skill identity and source.
 * @returns {void}
 * @sideEffects Copies runtime files into the generated stage.
 */
function stageStandalone(skill) {
  copyRuntimeTree(skill.directory, path.join(stage, skill.name));
}

/**
 * Stages one plugin wrapper around the same canonical runtime tree.
 * @param {"codex"|"claude"} type Plugin host type.
 * @param {{name: string, directory: string}} skill Canonical skill identity and source.
 * @param {string} releaseVersion Version without the leading tag prefix.
 * @returns {void}
 * @sideEffects Copies files and writes the staged manifest name and version.
 */
function stagePlugin(type, skill, releaseVersion) {
  const pluginName = `${skill.name}-${type}-plugin`;
  const target = path.join(stage, pluginName);
  const manifestDir = type === "codex" ? ".codex-plugin" : ".claude-plugin";
  const manifestSource = path.join(root, "packaging", `${type}-plugin`);

  copyRuntimeTree(manifestSource, target);
  copyRuntimeTree(skill.directory, path.join(target, "skills", skill.name));

  const manifestPath = path.join(target, manifestDir, "plugin.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.name = skill.name;
  manifest.version = releaseVersion;
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

/**
 * Creates one ZIP with portable archivers and an optional PowerShell fallback.
 * @param {string} source Absolute directory path to archive.
 * @param {string} destination Absolute ZIP path to create or replace.
 * @returns {void}
 * @throws {Error} When zip, archive-capable tar, and available PowerShell hosts all fail.
 * @sideEffects Creates or replaces the destination archive and streams archiver output.
 */
function zipDirectory(source, destination) {
  const parent = path.dirname(source);
  const base = path.basename(source);
  const zip = spawnSync("zip", ["-r", destination, base], { cwd: parent, stdio: "inherit" });
  if (zip.status === 0) {
    return;
  }

  const tar = spawnSync("tar", ["-a", "-c", "-f", destination, base], { cwd: parent, stdio: "inherit" });
  if (tar.status === 0) {
    return;
  }

  const escapedSource = source.replaceAll("'", "''");
  const escapedDestination = destination.replaceAll("'", "''");
  const command = `Compress-Archive -LiteralPath '${escapedSource}' -DestinationPath '${escapedDestination}' -Force`;
  const fallbackHosts = process.platform === "win32" ? ["pwsh", "powershell"] : ["pwsh"];

  for (const host of fallbackHosts) {
    const powershell = spawnSync(host, ["-NoProfile", "-NonInteractive", "-Command", command], { stdio: "inherit" });
    if (powershell.status === 0) {
      return;
    }
  }

  throw new Error(`Unable to create ZIP ${destination}. Install zip, archive-capable tar, or PowerShell 7 and retry.`);
}

/**
 * Writes a deterministic SHA-256 manifest for the packaged release assets.
 * @param {string[]} files Absolute archive paths.
 * @param {string} destination Absolute checksum manifest path.
 * @returns {void}
 * @sideEffects Reads every archive and overwrites the manifest.
 */
function writeChecksums(files, destination) {
  const lines = files
    .map((file) => `${crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex")}  ${path.basename(file)}`)
    .sort();
  fs.writeFileSync(destination, `${lines.join("\n")}\n`);
}
