import "dotenv/config";
import { ChatOllama, type ChatOllamaInput } from "@langchain/ollama";
import { pathToFileURL } from "node:url";

export const MODEL_KEYS = ["primary", "secondary"] as const;
export type ModelKey = (typeof MODEL_KEYS)[number];

export interface ComparisonModelConfig {
  key: ModelKey;
  name: ChatOllamaInput;
  port: string;
  baseUrl: string;
}

const DEFAULT_PROMPT =
  "You are a helpful assistant. Provide a clear and concise response the user can trust.";
const DEFAULT_USER_INPUT =
  "What is the difference between 'ollama run' and 'ollama serve' commands?";

function requireEnvVar(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable "${name}".`);
  }
  return value;
}

function buildBaseUrl(host: string, port: string): string {
  try {
    const url = new URL(host);
    url.port = port;
    return url.origin;
  } catch (error) {
    throw new Error(
      `Invalid NEXT_PUBLIC_BASE_URL "${host}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

const PRIMARY_MODEL_NAME = requireEnvVar(
  "NEXT_PUBLIC_OLLAMA_PRIMARY_MODEL"
) as ChatOllamaInput;
const SECONDARY_MODEL_NAME = requireEnvVar(
  "NEXT_PUBLIC_OLLAMA_SECONDARY_MODEL"
) as ChatOllamaInput;
const HOST = requireEnvVar("NEXT_PUBLIC_BASE_URL");
const PRIMARY_PORT = requireEnvVar("NEXT_PUBLIC_OLLAMA_PRIMARY_PORT");
const SECONDARY_PORT = requireEnvVar("NEXT_PUBLIC_OLLAMA_SECONDARY_PORT");

export const MODEL_CONFIGS: Record<ModelKey, ComparisonModelConfig> = {
  primary: {
    key: "primary",
    name: PRIMARY_MODEL_NAME,
    port: PRIMARY_PORT,
    baseUrl: buildBaseUrl(HOST, PRIMARY_PORT),
  },
  secondary: {
    key: "secondary",
    name: SECONDARY_MODEL_NAME,
    port: SECONDARY_PORT,
    baseUrl: buildBaseUrl(HOST, SECONDARY_PORT),
  },
};

async function previewComparison(): Promise<void> {
  for (const key of MODEL_KEYS) {
    const model = MODEL_CONFIGS[key];
    const chat = new ChatOllama({
      model: model.name as string,
      baseUrl: model.baseUrl,
    });
    const messages = [
      { _getType: () => "system", content: DEFAULT_PROMPT },
      { _getType: () => "human", content: DEFAULT_USER_INPUT },
    ];
    const response = await chat._generate(messages, {});
    const generation = response.generations[0]?.text ?? "No output from model.";

    console.log(`\n${model.port}: ${model.name}`);
    console.log(generation);
  }
}

const isDirectExecution =
  typeof process !== "undefined" &&
  typeof process.argv !== "undefined" &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectExecution) {
  previewComparison().catch((err) => {
    console.error("Error calling Ollama model:", err);
    process.exit(1);
  });
}
