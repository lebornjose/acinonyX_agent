<template>
  <div>
    <el-card shadow="never" class="model-card">
      <template #header>
        <div class="card-header">
          <strong>自定义模型</strong>
          <el-button type="primary" @click="dialogVisible = true">
            + 手动添加模型
          </el-button>
        </div>
      </template>

      <el-table
        v-loading="loading"
        :data="models"
        empty-text="暂无模型配置"
      >
        <el-table-column prop="name" label="名称" />
        <el-table-column prop="provider" label="提供商" />
        <el-table-column prop="model" label="模型标识" />
        <el-table-column label="思考模式">
          <template #default="scope">
            <el-tag :type="scope.row.thinkingMode === 'enabled' ? 'warning' : 'info'">
              {{ thinkingModeLabel(scope.row.thinkingMode) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="endpoint"
          label="接口地址"
          show-overflow-tooltip
        />
        <el-table-column label="状态">
          <template #default="scope">
            <el-tag type="success">
              {{ scope.row.status === "active" ? "启用" : scope.row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="scope">
            <el-button link type="primary" @click="editModel(scope.row)">
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="editingModelId ? '编辑模型' : '手动添加模型'"
      width="560px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
      >
        <el-form-item label="模型名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="供应商" prop="provider">
          <el-select v-model="form.provider" placeholder="请选择供应商" style="width: 100%">
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="Kimi" value="kimi" />
            <el-option label="千问" value="qwen" />
            <el-option label="豆包" value="doubao" />
          </el-select>
        </el-form-item>
        <el-form-item label="模型标识" prop="model">
          <el-input v-model="form.model" />
        </el-form-item>
        <el-form-item label="思考模式" prop="thinkingMode">
          <el-select v-model="form.thinkingMode" style="width: 100%">
            <el-option label="关闭（默认）" value="disabled" />
            <el-option label="开启" value="enabled" />
            <el-option label="自动" value="auto" />
          </el-select>
        </el-form-item>
        <el-form-item label="接口地址" prop="endpoint">
          <el-input v-model="form.endpoint" />
        </el-form-item>
        <el-form-item label="API Key" prop="apiKey">
          <el-input
            v-model="form.apiKey"
            type="password"
            show-password
            :placeholder="editingModelId ? '留空表示不修改原 API Key' : ''"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="submit"
        >
          保存模型
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup>
import { ref } from "vue";
import { ElMessage } from "element-plus";
defineProps({
  models: {
    type: Array,
    default: () => []
  },
  loading: Boolean
});

const emit = defineEmits(["saved"]);
const dialogVisible = ref(false);
const saving = ref(false);
const formRef = ref();
const editingModelId = ref("");
const form = ref({
  name: "",
  provider: "",
  model: "",
  endpoint: "",
  apiKey: "",
  thinkingMode: "disabled"
});
const rules = Object.fromEntries(
  ["name", "provider", "model", "endpoint", "apiKey"].map((field) => [
    field,
    [
      {
        required: true,
        message: "此项不能为空",
        trigger: "blur"
      }
    ]
  ])
);

function thinkingModeLabel(mode) {
  if (mode === "enabled") {
    return "开启";
  }

  if (mode === "auto") {
    return "自动";
  }

  return "关闭";
}

function resetForm() {
  form.value = {
    name: "",
    provider: "",
    model: "",
    endpoint: "",
    apiKey: "",
    thinkingMode: "disabled"
  };
  editingModelId.value = "";
}

function editModel(model) {
  editingModelId.value = model.id;
  form.value = {
    name: model.name || "",
    provider: model.provider || "",
    model: model.model || "",
    endpoint: model.endpoint || "",
    apiKey: "",
    thinkingMode: model.thinkingMode || "disabled"
  };
  dialogVisible.value = true;
}

async function submit() {
  try {
    await formRef.value.validate();
    saving.value = true;
    const path = editingModelId.value
      ? `/api/admin/models/${encodeURIComponent(editingModelId.value)}`
      : "/api/admin/models";
    const response = await fetch(path, {
      method: editingModelId.value ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.value)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "保存失败");
    }
    ElMessage.success(editingModelId.value ? "模型修改成功" : "模型添加成功");
    dialogVisible.value = false;
    resetForm();
    emit("saved");
  } catch (error) {
    if (error !== false) {
      ElMessage.error(error.message || "请完善表单");
    }
  } finally {
    saving.value = false;
  }
}
</script>
