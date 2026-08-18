<template>
  <div class="login-page">
    <el-card class="login-card" shadow="never">
      <div class="login-logo">
        C<span>24</span>
      </div>
      <h1>管理系统</h1>
      <p>登录 Chat24 管理端</p>
      <el-alert v-if="error" :title="error" type="error" show-icon />
      <el-form :model="form">
        <el-form-item>
          <el-input
            v-model="form.email"
            placeholder="管理员邮箱"
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-input
            v-model="form.password"
            type="password"
            show-password
            placeholder="密码"
            size="large"
            @keyup.enter="submit"
          />
        </el-form-item>
        <el-button
          type="primary"
          size="large"
          class="login-button"
          :loading="loading"
          @click="submit"
        >
          登录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>
<script setup>
import { ref } from "vue";
const emit = defineEmits(["login"]), form = ref({ email: "", password: "" }), loading = ref(false), error = ref("");
async function submit() {
  loading.value = true;
  error.value = "";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "登录失败");
    }
    emit("login", result.token);
  } catch (loginError) {
    error.value = loginError.message;
  } finally {
    loading.value = false;
  }
}
</script>
