import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import OSS from "ali-oss";

const projectRoot = process.cwd();
const requiredVariables = [
  "ALIYUN_OSS_BUCKET",
  "ALIYUN_OSS_REGION",
  "ALIYUN_OSS_ENDPOINT"
];

function getOssConfig() {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`缺少 OSS 配置：${missing.join(", ")}`);
  }

  if (!process.env.ALIYUN_OSS_ACCESS_KEY_ID || !process.env.ALIYUN_OSS_ACCESS_KEY_SECRET) {
    throw new Error("缺少 OSS 访问凭证：ALIYUN_OSS_ACCESS_KEY_ID / ALIYUN_OSS_ACCESS_KEY_SECRET");
  }

  return {
    region: process.env.ALIYUN_OSS_REGION,
    endpoint: process.env.ALIYUN_OSS_ENDPOINT,
    bucket: process.env.ALIYUN_OSS_BUCKET,
    accessKeyId: process.env.ALIYUN_OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.ALIYUN_OSS_ACCESS_KEY_SECRET,
    secure: true
  };
}

async function collectFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else {
      files.push(absolutePath);
    }
  }

  return files;
}

function toObjectKey(filePath, distDirectory, sitePrefix) {
  const relativePath = path.relative(distDirectory, filePath).split(path.sep).join("/");
  const prefix = sitePrefix.replace(/^\/+|\/+$/g, "");
  return prefix ? `${prefix}/${relativePath}` : relativePath;
}

async function uploadDirectory(client, directory, sitePrefix) {
  const files = await collectFiles(directory);

  for (const filePath of files) {
    const objectKey = toObjectKey(filePath, directory, sitePrefix);
    await client.put(objectKey, filePath);
    console.log(`OSS 上传完成：${objectKey}`);
  }
}

async function main() {
  const config = getOssConfig();
  const client = new OSS(config);
  const prefix = process.env.ALIYUN_OSS_UPLOAD_PREFIX || "";

  await uploadDirectory(client, path.join(projectRoot, "apps/web/dist"), `${prefix}/web`);
  await uploadDirectory(client, path.join(projectRoot, "apps/admin/dist"), `${prefix}/admin`);

  if (process.env.ALIYUN_OSS_PUBLIC_BASE_URL) {
    const baseUrl = process.env.ALIYUN_OSS_PUBLIC_BASE_URL.replace(/\/$/, "");
    console.log(`Web 地址：${baseUrl}/${prefix ? `${prefix}/` : ""}web/`);
    console.log(`Admin 地址：${baseUrl}/${prefix ? `${prefix}/` : ""}admin/`);
  }
}

main().catch((error) => {
  console.error(`OSS 上传失败：${error.message}`);
  process.exitCode = 1;
});
