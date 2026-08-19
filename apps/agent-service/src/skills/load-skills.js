/**
 * @file load-skills.js
 * @description 从磁盘加载 skills 目录下所有技能文件，并提供按名称组合技能文本的工具函数。
 *
 * Skills 目录结构（相对于 agent-service 根目录）：
 *   skills/
 *     fly-ash-domain/SKILL.md   - 粉煤灰领域知识
 *     answer-quality/SKILL.md   - 回答质量规范
 *     ...（后续新增技能只需新建目录和 SKILL.md 即可自动被加载）
 *
 * 返回值 Map<string, string> 的 key 为目录名，value 为 SKILL.md 的文件内容。
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// skills 目录的绝对路径：从当前文件向上两级到达 agent-service 根，再进入 skills/
const skillsDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../skills"
);

/**
 * 读取单个技能目录下的 SKILL.md 文件内容。
 *
 * @param {string} directoryName - 技能目录名（即 skills/ 下的子目录名）
 * @returns {Promise<{name: string, content: string}>} 技能名称与文件内容
 * @throws 若 SKILL.md 不存在或不可读，会将错误向上抛出，由 loadSkills 捕获
 */
async function readSkill(directoryName) {
  const filePath = path.join(skillsDirectory, directoryName, "SKILL.md");
  const content = await fs.readFile(filePath, "utf8");
  return { name: directoryName, content };
}

/**
 * 扫描 skills 目录，并行读取所有技能文件。
 *
 * 只读取直接子目录（非递归），目录名按字母顺序排序后依次加载。
 * 每次服务启动时调用一次，结果由 create-runtime.js 缓存在内存中。
 *
 * @returns {Promise<Map<string, string>>} key 为技能目录名，value 为 SKILL.md 内容
 */
export async function loadSkills() {
  // 读取 skills 目录的所有条目（文件 + 目录），保留 Dirent 对象以便判断类型
  const entries = await fs.readdir(skillsDirectory, { withFileTypes: true });

  // 只取目录条目，并按名称排序（保证加载顺序稳定）
  const directories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  // 并行读取所有技能，减少 I/O 等待时间
  const skills = await Promise.all(directories.map(readSkill));

  // 转换为 Map，方便后续按名称快速查找
  return new Map(skills.map((skill) => [skill.name, skill.content]));
}

/**
 * 从已加载的技能 Map 中按名称提取指定技能的文本内容，并拼接成单个字符串。
 *
 * 不存在的技能名会被静默跳过（filter(Boolean)），不影响其他技能的拼接。
 * 多个技能之间用分隔线（--- ）隔开，方便模型区分不同技能的边界。
 *
 * @param {Map<string, string>} skills - loadSkills() 返回的技能 Map
 * @param {string[]}            names  - 需要提取的技能目录名列表，按传入顺序拼接
 * @returns {string} 拼接后的技能文本；若所有名称均不存在则返回空字符串
 *
 * @example
 * const text = skillText(skills, ["fly-ash-domain", "answer-quality"]);
 * // 返回 fly-ash-domain 内容 + "\n\n---\n\n" + answer-quality 内容
 */
export function skillText(skills, names) {
  return names
    .map((name) => skills.get(name))   // 按名称取内容（不存在则返回 undefined）
    .filter(Boolean)                    // 过滤掉 undefined / 空字符串
    .join("\n\n---\n\n");              // 用分隔线连接多段技能文本
}
