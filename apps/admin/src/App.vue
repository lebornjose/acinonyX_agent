<template>
  <Login v-if="!loggedIn" @login="handleLogin" />
  <el-container v-else class="admin-shell">
    <el-aside width="224px" class="sidebar">
      <div class="brand">Chat24 <span>管理端</span></div>
      <el-menu :default-active="activeMenu" @select="activeMenu = $event">
        <el-menu-item index="dashboard">数据概览</el-menu-item>
        <el-menu-item index="models">模型管理</el-menu-item>
        <el-menu-item index="users">用户管理</el-menu-item>
        <el-menu-item index="conversations">会话审计</el-menu-item>
      </el-menu>
      <el-button class="logout" text @click="logout">退出登录</el-button>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div><div class="eyebrow">SYSTEM CONSOLE</div><h1>{{ pageTitle }}</h1></div>
        <el-button text @click="loadData">刷新</el-button>
      </el-header>
      <el-main class="content">
        <el-alert v-if="error" :title="error" type="error" show-icon />
        <Dashboard v-if="activeMenu === 'dashboard'" :users="users" :conversations="conversations" :models="models" />
        <Models v-else-if="activeMenu === 'models'" :models="models" :loading="loading" @saved="loadData" />
        <el-card v-else shadow="never" class="model-card">
          <el-table v-loading="loading" :data="activeMenu === 'users' ? users : conversations" empty-text="暂无数据">
            <template v-if="activeMenu === 'users'">
              <el-table-column prop="email" label="邮箱" />
              <el-table-column prop="nickname" label="昵称" />
              <el-table-column prop="status" label="状态" />
            </template>
            <template v-else>
              <el-table-column prop="id" label="会话 ID" />
              <el-table-column prop="userId" label="用户 ID" />
              <el-table-column prop="title" label="标题" />
            </template>
          </el-table>
        </el-card>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import Login from "./views/Login.vue";
import Dashboard from "./views/Dashboard.vue";
import Models from "./views/Models.vue";

const loggedIn = ref(Boolean(localStorage.getItem("admin-token")));
const activeMenu = ref("dashboard");
const loading = ref(false);
const error = ref("");
const users = ref([]);
const conversations = ref([]);
const models = ref([]);

const pageTitles = {
  dashboard: "数据概览",
  models: "模型管理",
  users: "用户管理",
  conversations: "会话审计"
};
const pageTitle = computed(() => pageTitles[activeMenu.value]);

async function request(path) {
  const response = await fetch(path);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "请求失败");
  }
  return result;
}

async function loadData() {
  loading.value = true;
  error.value = "";
  try {
    const [userData, conversationData, modelData] = await Promise.all([
      request("/api/admin/users"),
      request("/api/admin/conversations"),
      request("/api/admin/models")
    ]);
    users.value = userData;
    conversations.value = conversationData;
    models.value = modelData;
  } catch (loadError) {
    error.value = loadError.message;
  } finally {
    loading.value = false;
  }
}

function handleLogin(token) {
  localStorage.setItem("admin-token", token);
  loggedIn.value = true;
  loadData();
}

function logout() {
  localStorage.removeItem("admin-token");
  loggedIn.value = false;
}

onMounted(() => {
  if (loggedIn.value) {
    loadData();
  }
});
</script>
