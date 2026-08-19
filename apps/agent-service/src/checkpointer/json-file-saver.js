/**
 * @file json-file-saver.js
 * @description 基于 JSON 文件的持久化 Checkpointer。
 *
 * 继承 LangGraph 内置的 MemorySaver，在每次 put/putWrites 之后
 * 将内存中的 storage 和 writes 序列化到磁盘 JSON 文件，
 * 在进程重启时从文件恢复，实现跨进程的会话状态持久化。
 *
 * 设计原则：
 *   - 零 native 依赖，纯 Node.js fs 模块实现
 *   - 写操作异步非阻塞（fire-and-forget），不阻塞 Agent 响应
 *   - 读操作在构造时同步完成（启动时一次性加载）
 *   - 写失败只打印警告，不影响 Agent 正常运行
 *
 * 适用场景：单机部署、开发环境、中小规模用户（< 万级会话）。
 * 如需水平扩展多实例，应替换为 MySQL/Redis 等共享存储实现。
 */

import { readFileSync, writeFile, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { MemorySaver } from "@langchain/langgraph";

/**
 * 将 MemorySaver 的内存状态序列化并写入 JSON 文件。
 * 写操作是 fire-and-forget，失败只记录警告。
 *
 * @param {string} filePath - JSON 文件的绝对或相对路径
 * @param {object} storage  - MemorySaver 的 checkpoint 存储对象
 * @param {object} writes   - MemorySaver 的 pending writes 存储对象
 */
function persistToDisk(filePath, storage, writes) {
  const payload = JSON.stringify({ storage, writes });

  writeFile(filePath, payload, "utf8", (error) => {
    if (error) {
      console.warn(`[checkpointer] 写入失败（不影响运行）: ${error.message}`);
    }
  });
}

/**
 * 基于 JSON 文件的持久化 Checkpointer。
 *
 * 用法：
 *   const checkpointer = new JsonFileSaver("./data/checkpoints.json");
 *   const graph = createDefaultGraph({ ..., checkpointer });
 */
export class JsonFileSaver extends MemorySaver {
  /**
   * @param {string} filePath - 持久化文件路径（不存在时自动创建）
   */
  constructor(filePath) {
    super();

    this._filePath = filePath;

    // 确保目录存在
    mkdirSync(dirname(filePath), { recursive: true });

    // 启动时同步读取已有快照（进程重启后从磁盘恢复状态）
    try {
      const raw = readFileSync(filePath, "utf8");
      const saved = JSON.parse(raw);

      if (saved?.storage && typeof saved.storage === "object") {
        this.storage = saved.storage;
      }

      if (saved?.writes && typeof saved.writes === "object") {
        this.writes = saved.writes;
      }

      const threadCount = Object.keys(this.storage).length;
      console.log(`[checkpointer] 已从磁盘恢复 ${threadCount} 个会话快照：${filePath}`);
    } catch (error) {
      // 文件不存在（首次启动）是正常情况，其他错误也不阻断启动
      if (error.code !== "ENOENT") {
        console.warn(`[checkpointer] 读取快照文件失败，以空状态启动: ${error.message}`);
      } else {
        console.log(`[checkpointer] 快照文件不存在，以空状态启动：${filePath}`);
      }
    }
  }

  /**
   * 覆写 put 方法：调用父类保存到内存后，异步持久化到磁盘。
   */
  async put(config, checkpoint, metadata, newVersions) {
    const result = await super.put(config, checkpoint, metadata, newVersions);
    persistToDisk(this._filePath, this.storage, this.writes);
    return result;
  }

  /**
   * 覆写 putWrites 方法：调用父类保存到内存后，异步持久化到磁盘。
   */
  async putWrites(config, writes, taskId) {
    const result = await super.putWrites(config, writes, taskId);
    persistToDisk(this._filePath, this.storage, this.writes);
    return result;
  }
}
