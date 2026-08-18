import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ossUrl = env.ALIYUN_OSS_URL?.replace(/\/$/, "");
  const prefix = env.ALIYUN_OSS_UPLOAD_PREFIX?.replace(/^\/+|\/+$/g, "");
  const assetRoot = prefix ? `${ossUrl}/${prefix}` : ossUrl;

  return {
    base: assetRoot ? `${assetRoot}/admin/` : "/admin/",
    plugins: [vue()],
    server: {
      host: "127.0.0.1",
      port: 5174,
      proxy: {
        "/api": "http://localhost:4001"
      }
    }
  };
});
