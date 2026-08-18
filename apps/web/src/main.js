import { createApp } from "vue";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
import "./style.css";
import ChatView from "./views/chat/ChatView.vue";

createApp(ChatView).use(ElementPlus).mount("#app");
