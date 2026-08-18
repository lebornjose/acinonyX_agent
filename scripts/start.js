import { spawn, execSync } from "node:child_process";

const services = [
  ["api",           process.execPath, ["apps/api/src/server.js"],              4001],
  ["agent-service", process.execPath, ["apps/agent-service/src/server.js"],    4002],
  ["web",           "pnpm",           ["--filter", "web-client",  "dev"],       5173],
  ["admin",         "pnpm",           ["--filter", "admin-client", "dev"],      5174]
];

/**
 * 查找并终止占用指定端口的进程（macOS / Linux）。
 * 找不到或 kill 失败时静默忽略，不中断启动流程。
 */
function freePort(port) {
  try {
    const output = execSync(
      `lsof -ti tcp:${port}`,
      { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
    ).trim();

    if (!output) {
      return;
    }

    const pids = output.split("\n").filter(Boolean);

    for (const pid of pids) {
      try {
        execSync(`kill -9 ${pid}`, { stdio: "pipe" });
        console.log(`[start] 端口 ${port} 已被占用（PID ${pid}），已强制释放`);
      } catch {
        // 进程可能在 kill 前已退出，忽略
      }
    }
  } catch {
    // lsof 未找到进程或命令不存在，端口空闲，直接跳过
  }
}

// 启动前释放所有目标端口
for (const [name, , , port] of services) {
  if (port) {
    freePort(port);
  }
}

const children = services.map(([name, command, args]) => {
  const child = spawn(command, args, { stdio: "inherit", env: process.env });
  child.on("exit", (code) => console.log(`[${name}] stopped (${code ?? "signal"})`));
  return child;
});

function shutdown() {
  children.forEach((child) => child.kill("SIGTERM"));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("平台服务已启动：Web http://localhost:5173，Admin http://localhost:5174，API http://localhost:4001，Agent http://localhost:4002");
