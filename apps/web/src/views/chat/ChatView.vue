<template>
  <div class="chat-app">
    <aside :class="['sidebar', { collapsed: !sidebarOpen }]">
      <div class="brand"><span class="brand-mark">✦</span><span>股票知识 Agent</span></div>
      <button class="new-chat" type="button" @click="newChat"><span>＋</span> 新对话</button>
      <div class="history-title">最近对话</div>
      <div v-if="conversations.length" class="history-list">
        <div v-for="conversation in conversations" :key="conversation.id" :class="['history-item', { active: conversation.id === conversationId }]">
          <button type="button" class="history-select" @click="selectConversation(conversation.id)">{{ conversation.title || "新对话" }}</button>
          <button type="button" class="history-delete" aria-label="删除会话" @click="removeConversation(conversation.id)">×</button>
        </div>
      </div>
      <div v-else class="history-empty">还没有对话记录</div>
      <div class="sidebar-footer"><button type="button">⌘　设置</button><button type="button">◎　账户</button></div>
    </aside>

    <main class="workspace">
      <header class="topbar">
        <button class="menu-button" type="button" @click="sidebarOpen = !sidebarOpen">☰</button>
        <div class="model-picker">股票知识 Agent <span>⌄</span></div>
        <button class="top-action" type="button">⋯</button>
      </header>

      <section ref="conversationRef" class="conversation">
        <div v-if="!messages.length" class="welcome">
          <div class="welcome-mark">✦</div>
          <h1>你好，我是股票知识 Agent</h1>
          <p>我可以帮你学习股票知识、理解财务指标、分析公司和估值方法。</p>
          <div class="suggestions"><button type="button" @click="input = '市盈率和市净率有什么区别？'">解释市盈率和市净率</button><button type="button" @click="input = '如何系统分析一家上市公司？'">如何分析一家上市公司？</button></div>
        </div>
        <div v-else class="messages">
          <article v-for="(message, index) in messages" :key="index" :class="['message', message.role]">
            <div class="message-avatar">{{ message.role === "user" ? "我" : "✦" }}</div>
            <div v-if="message.role === 'assistant'" class="message-content markdown-content" v-html="renderMarkdown(message.content)"></div>
            <div v-else class="message-content">{{ message.content }}</div>
          </article>
          <article v-if="loading" class="message assistant"><div class="message-avatar">✦</div><div class="typing"><i></i><i></i><i></i></div></article>
          <div v-if="error" class="error-box"><span>{{ error }}</span><button type="button" @click="submit">重试</button></div>
        </div>
      </section>

      <form class="composer" @submit.prevent="submit">
        <textarea v-model="input" :disabled="loading" placeholder="向股票知识 Agent 提问" rows="1" @keydown.enter.exact.prevent="handleEnter"></textarea>
        <div class="composer-footer">
          <select v-model="selectedModelId" class="model-select" :disabled="loading || !models.length" aria-label="选择模型">
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
          <button
            class="thinking-toggle"
            :class="{ active: thinkingMode === 'enabled' }"
            type="button"
            :disabled="loading"
            @click="toggleThinking"
          >
            <span class="thinking-icon">✦</span>
            {{ thinkingMode === "enabled" ? "深度思考" : "思考" }}
          </button>
          <span>模型可能会犯错，请核查重要信息</span>
          <button class="send-button" type="submit" :disabled="!input.trim() || loading">↑</button>
        </div>
      </form>
    </main>
  </div>
</template>

<script setup>
import { nextTick, onMounted, ref } from "vue";
import { ElMessage } from "element-plus";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { createConversation, deleteConversation, getConversation, listConversations, listModels, streamMessage } from "../../services/index.js";
import "../../markdown.css";
import "./model-select.css";
import "./thinking-toggle.css";

const input = ref("");
const messages = ref([]);
const loading = ref(false);
const error = ref("");
const sidebarOpen = ref(true);
const conversationRef = ref(null);
const conversations = ref([]);
const conversationId = ref("");
const models = ref([]);
const selectedModelId = ref("");
const thinkingMode = ref("disabled");

const localSessionKey = "jiahui-agent-current-session";

function toggleThinking() {
  thinkingMode.value = thinkingMode.value === "enabled" ? "disabled" : "enabled";
}

function saveLocalSession() {
  localStorage.setItem(localSessionKey, JSON.stringify({
    conversationId: conversationId.value,
    messages: messages.value,
    modelId: selectedModelId.value
  }));
}

function restoreLocalSession() {
  const savedSession = localStorage.getItem(localSessionKey);
  if (!savedSession) return;

  try {
    const session = JSON.parse(savedSession);
    conversationId.value = session.conversationId || "";
    messages.value = Array.isArray(session.messages) ? session.messages : [];
    if (session.modelId) selectedModelId.value = session.modelId;
  } catch {
    localStorage.removeItem(localSessionKey);
  }
}

function clearLocalSession() {
  localStorage.removeItem(localSessionKey);
}

marked.setOptions({ breaks: true, gfm: true });

function renderMarkdown(content) {
  return DOMPurify.sanitize(marked.parse(content || ""));
}

async function scrollToLatest() {
  await nextTick();
  if (conversationRef.value) conversationRef.value.scrollTop = conversationRef.value.scrollHeight;
}

async function submit() {
  const content = input.value.trim();
  if (!content || loading.value) return;
  input.value = "";
  error.value = "";
  loading.value = true;
  await nextTick();
  try {
    if (!conversationId.value) {
      const conversation = await createConversation(content.slice(0, 20));
      conversationId.value = conversation.id;
      conversations.value.unshift(conversation);
    }
    messages.value.push({ role: "user", content });
    saveLocalSession();
    await scrollToLatest();
    let assistantIndex = -1;
    await streamMessage(conversationId.value, content, (event, payload) => {
      if (event === "status") { ElMessage.info(`${payload.agent === "researcher" ? "研究" : "写作"} Agent：${payload.status === "running" ? "开始" : "完成"}`); }
      if (event === "token") {
        if (assistantIndex < 0) { messages.value.push({ role: "assistant", content: "" }); assistantIndex = messages.value.length - 1; }
        messages.value[assistantIndex].content += payload.token;
        scrollToLatest();
      }
      if (event === "final") {
        if (assistantIndex < 0) { messages.value.push({ role: "assistant", content: payload.answer || "没有收到有效回复。" }); assistantIndex = messages.value.length - 1; }
        else if (payload.answer && !messages.value[assistantIndex].content) messages.value[assistantIndex].content = payload.answer;
        scrollToLatest();
      }
      if (event === "message" && assistantIndex >= 0) messages.value[assistantIndex].content = payload.message.content;
      saveLocalSession();
    }, selectedModelId.value, thinkingMode.value);
    await refreshConversations();
  } catch (requestError) {
    error.value = requestError.message;
    ElMessage.error(requestError.message);
  } finally {
    loading.value = false;
  }
}

function newChat() {
  messages.value = [];
  conversationId.value = "";
  error.value = "";
  clearLocalSession();
}

async function refreshConversations() {
  conversations.value = await listConversations();
}

async function selectConversation(id) {
  if (loading.value || id === conversationId.value) return;
  error.value = "";
  try {
    const conversation = await getConversation(id);
    conversationId.value = conversation.id;
    messages.value = conversation.messages || [];
    saveLocalSession();
    await scrollToLatest();
  } catch (requestError) {
    error.value = requestError.message;
    ElMessage.error(requestError.message);
  }
}

async function removeConversation(id) {
  if (loading.value) return;
  try {
    await deleteConversation(id);
    conversations.value = conversations.value.filter((conversation) => conversation.id !== id);
    if (conversationId.value === id) newChat();
  } catch (requestError) {
    ElMessage.error(requestError.message);
  }
}

function handleEnter(event) {
  if (event.isComposing || event.keyCode === 229) {
    return;
  }

  submit();
}

onMounted(async () => {
  try { await refreshConversations(); } catch (requestError) { error.value = requestError.message; }
  try {
    models.value = await listModels();
    selectedModelId.value = models.value.find((model) => model.provider === "deepseek")?.id || models.value[0]?.id || "";
    restoreLocalSession();
  } catch (requestError) {
    error.value = requestError.message;
  }
});
</script>
