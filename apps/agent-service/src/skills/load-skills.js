import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../skills"
);

async function readSkill(directoryName) {
  const filePath = path.join(skillsDirectory, directoryName, "SKILL.md");
  const content = await fs.readFile(filePath, "utf8");
  return { name: directoryName, content };
}

export async function loadSkills() {
  const entries = await fs.readdir(skillsDirectory, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const skills = await Promise.all(directories.map(readSkill));
  return new Map(skills.map((skill) => [skill.name, skill.content]));
}

export function skillText(skills, names) {
  return names
    .map((name) => skills.get(name))
    .filter(Boolean)
    .join("\n\n---\n\n");
}
