import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

export function createModel() {
  if (!process.env.LLM_API_KEY) {
    throw new Error("Missing LLM_API_KEY. Copy .env.example to .env and configure it.");
  }

  return new ChatOpenAI({
    model: process.env.LLM_MODEL || "gpt-4o-mini",
    temperature: 0.2,
    timeout: Number(process.env.LLM_TIMEOUT_MS || 60000),
    maxRetries: Number(process.env.LLM_MAX_RETRIES || 1),
    ...(process.env.LLM_BASE_URL ? { configuration: { baseURL: process.env.LLM_BASE_URL } } : {})
  });
}
