import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import OSS from "ali-oss";

const projectRoot = process.cwd();
const releaseRoot = path.join(projectRoot, "apps/api/public");
const webDist = path.join(projectRoot, "apps/web/dist");
const adminDist = path.join(projectRoot, "apps/admin/dist");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} 执行失败，退出码：${code}`));
    });
  });
}

async function buildFrontends() {
  await run("pnpm", ["--filter", "web-client", "build"]);
  await run("pnpm", ["--filter", "admin-client", "build"]);
}

async function copyStaticFiles() {
  await fs.rm(releaseRoot, { recursive: true, force: true });
  await fs.mkdir(releaseRoot, { recursive: true });
  await fs.cp(webDist, path.join(releaseRoot, "web"), { recursive: true });
  await fs.cp(adminDist, path.join(releaseRoot, "admin"), { recursive: true });
  console.log("静态文件已复制到 apps/api/public");
}

function getOssClient() {
  const requiredVariables = [
    "ALIYUN_OSS_BUCKET",
    "ALIYUN_OSS_REGION",
    "ALIYUN_OSS_ENDPOINT",
    "ALIYUN_OSS_ACCESS_KEY_ID",
    "ALIYUN_OSS_ACCESS_KEY_SECRET"
  ];
  const missing = requiredVariables.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new Error(`缺少 OSS 配置：${missing.join(", ")}`);
  }

  return new OSS({
    bucket: process.env.ALIYUN_OSS_BUCKET,
    region: process.env.ALIYUN_OSS_REGION,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    secure: true
  });
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(filePath));
    } else {
      files.push(filePath);
    }
  }

  return files;
}

async function uploadDirectory(client, directory, prefix) {
  const files = await collectFiles(directory);

  for (const filePath of files) {
    const relativePath = path.relative(directory, filePath).split(path.sep).join("/");
    const objectKey = `${prefix}/${relativePath}`;
    await client.put(objectKey, filePath);
    console.log(`OSS 上传完成：${objectKey}`);
  }
}

async function uploadToOss() {
  const client = getOssClient();
  const rootPrefix = (process.env.ALIYUN_OSS_UPLOAD_PREFIX || "")
    .replace(/^\/+|\/+$/g, "");
  const webPrefix = rootPrefix ? `${rootPrefix}/web` : "web";
  const adminPrefix = rootPrefix ? `${rootPrefix}/admin` : "admin";

  await uploadDirectory(client, webDist, webPrefix);
  await uploadDirectory(client, adminDist, adminPrefix);

  if (process.env.ALIYUN_OSS_PUBLIC_BASE_URL) {
    const baseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL.replace(/\/$/, "");
    console.log(`Web OSS 地址：${baseUrl}/${webPrefix}/`);
    console.log(`Admin OSS 地址：${baseUrl}/${adminPrefix}/`);
  }
}

async function main() {
  if (!process.env.ALIYUN_OSS_URL) {
    throw new Error("缺少 ALIYUN_OSS_URL，无法生成 OSS 静态资源地址");
  }
  await buildFrontends();
  await copyStaticFiles();
  await uploadToOss();
  console.log("生产打包完成");
}

main().catch((error) => {
  console.error(`生产打包失败：${error.message}`);
  process.exitCode = 1;
});
