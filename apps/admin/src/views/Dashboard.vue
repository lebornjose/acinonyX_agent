<template>
  <div>
    <el-row :gutter="18">
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="never">
          <div class="stat-label">用户总数</div>
          <div class="stat-value">{{ users.length }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="never">
          <div class="stat-label">会话总数</div>
          <div class="stat-value">{{ conversations.length }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-card class="stat-card" shadow="never">
          <div class="stat-label">模型总数</div>
          <div class="stat-value">{{ models.length }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="model-card" shadow="never">
      <template #header>
        <strong>系统状态</strong>
      </template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="API 服务">
          已连接
        </el-descriptions-item>
        <el-descriptions-item label="数据存储">
          MySQL
        </el-descriptions-item>
        <el-descriptions-item label="自定义模型">
          {{ models.length ? "已配置" : "尚未配置" }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>
  </div>
</template>
<script setup>
defineProps({ users: { type: Array, default: () => [] }, conversations: { type: Array, default: () => [] }, models: { type: Array, default: () => [] } });
</script>
