import { NextResponse } from "next/server";
import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";

type IncomingMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

function toLangChainMessage(message: IncomingMessage) {
  const content = message.content ?? "";
  switch (message.role) {
    case "system":
      return { _getType: () => "system", content };
    case "assistant":
      return { _getType: () => "ai", content };
    default:
      return { _getType: () => "human", content };
  }
}

export async function GET() {
  // No default prompts are provided here since they come from the frontend
  return NextResponse.json({});
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => {
      console.error("no body");
    });

    const model = typeof body.model === "string" ? body.model.trim() : "";
    if (!model || typeof body.mode !== "string") {
      return NextResponse.json(
        { error: "Model is required." },
        { status: 400 }
      );
    }
    // Messages must be provided by the frontend
    const rawMessages: IncomingMessage[] = Array.isArray(body.messages)
      ? body.messages
          .map((msg: IncomingMessage) => ({
            role: msg.role,
            content: typeof msg.content === "string" ? msg.content.trim() : "",
          }))
          .filter((msg: IncomingMessage) => msg.content.length > 0)
      : [];

    // Ensure we have at least a system and user message
    if (!rawMessages.length) {
      return NextResponse.json(
        { error: "Messages are required." },
        { status: 400 }
      );
    }

    const messages = rawMessages.map(toLangChainMessage);

    const chat = new ChatOllama({
      model,
      baseUrl: process.env["BASE_URL"]?.trim() + ":11434",
    });
    const response = await chat._generate(messages, {});
    const text = response.generations[0]?.text ?? "";
    return NextResponse.json({ text });
  } catch (err) {
    console.error("Error in /api/compare:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
