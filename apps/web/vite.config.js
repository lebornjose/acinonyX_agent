import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const ossUrl = env.ALIYUN_OSS_URL?.replace(/\/$/, "");
  const prefix = env.ALIYUN_OSS_UPLOAD_PREFIX?.replace(/^\/+|\/+$/g, "");
  const assetRoot = prefix ? `${ossUrl}/${prefix}` : ossUrl;

  return {
    base: assetRoot ? `${assetRoot}/web/` : "/web/",
    plugins: [vue()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: "http://localhost:4001",
          changeOrigin: true,
          secure: false
        }
      }
    }
  };
});
