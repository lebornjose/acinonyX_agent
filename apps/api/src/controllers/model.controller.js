import { createModel, listModels, updateModel } from "../repositories/model.repository.js";
import { httpError } from "../utils/http-error.js";

const supportedProviders = new Set(["deepseek", "kimi", "qwen", "doubao"]);

function validateModel(body = {}, allowEmptyApiKey = false) {
  const fields = ["name", "provider", "model", "endpoint", "apiKey"];
  const values = Object.fromEntries(fields.map((field) => [field, typeof body[field] === "string" ? body[field].trim() : ""]));
  const requiredValues = allowEmptyApiKey ? { ...values, apiKey: "ok" } : values;
  if (Object.values(requiredValues).some((value) => !value)) throw httpError(400, "模型名称、提供商、模型标识和接口地址均不能为空");
  if (!supportedProviders.has(values.provider)) throw httpError(400, "不支持的模型供应商");
  if (/^\d+$/.test(values.model)) throw httpError(400, "模型标识必须填写真实模型名称，不能填写数字 ID");
  values.thinkingMode = ["enabled", "disabled", "auto"].includes(body.thinkingMode) ? body.thinkingMode : "disabled";
  if (!/^https?:\/\//i.test(values.endpoint)) throw httpError(400, "接口地址必须是 http 或 https 地址");
  return values;
}

export async function models(_req, res, next) {
  try {
    const result = await listModels();
    res.set("Cache-Control", "no-store");
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const model = await createModel(validateModel(req.body));
    res.status(201).json(model);
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const model = await updateModel(
      req.params.id,
      validateModel(req.body, true)
    );
    if (!model) {
      throw httpError(404, "模型不存在");
    }
    res.json(model);
  } catch (error) {
    next(error);
  }
}
