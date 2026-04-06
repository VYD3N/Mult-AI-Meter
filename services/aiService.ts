import { DEFAULT_SYSTEM_INSTRUCTION } from "../constants";
import { AI_GUIDED_PRESET_ID, ChatMessage, MultimeterReading, TroubleshootingPreset } from "../types";

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string | Array<{
    type: "text" | "image_url";
    text?: string;
    image_url?: { url: string };
  }>;
};

export interface ChatSession {
  messages: OpenRouterMessage[];
}

const apiKey = import.meta.env.OPENROUTER_API_KEY;
const model = import.meta.env.OPENROUTER_MODEL || "google/gemma-3-27b-it:free";

export const isAIConfigured = (): boolean => Boolean(apiKey);

const buildUserPrompt = (
  userMessage: ChatMessage,
  currentReading: MultimeterReading | null,
  activePreset: TroubleshootingPreset | null,
): string => {
  let textPart = userMessage.text;

  if (userMessage.context) {
    if (userMessage.context.deviceName) textPart += `\n[Device: ${userMessage.context.deviceName}]`;
    if (userMessage.context.goal) textPart += `\n[Goal: ${userMessage.context.goal}]`;
  }

  if (currentReading) {
    textPart += `

[REAL-TIME TELEMETRY]
Value: ${currentReading.value}
Unit: ${currentReading.unit}
Mode: ${currentReading.mode}
OverLimit: ${currentReading.isOverLimit}
RawHex: ${currentReading.rawHex || "N/A"}
`;
  }

  if (activePreset) {
    if (activePreset.id === AI_GUIDED_PRESET_ID) {
      textPart += `\n[Mode: AI Guided - You are in control of safety validation]`;
    } else {
      textPart += `\n[Active Preset: ${activePreset.name} - ${activePreset.description}]`;
    }
  }

  return textPart.trim();
};

const normalizeAssistantText = (content: unknown): string => {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item && typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .join("\n")
      .trim();
  }

  return "";
};

export const createChatSession = (): ChatSession | null => {
  if (!apiKey) {
    return null;
  }

  return {
    messages: [
      {
        role: "system",
        content: DEFAULT_SYSTEM_INSTRUCTION,
      },
    ],
  };
};

export const sendMessageToAI = async (
  chat: ChatSession,
  userMessage: ChatMessage,
  currentReading: MultimeterReading | null,
  activePreset: TroubleshootingPreset | null = null,
): Promise<string> => {
  const textPart = buildUserPrompt(userMessage, currentReading, activePreset);

  const content: OpenRouterMessage["content"] = userMessage.image
    ? [
        { type: "text", text: textPart },
        {
          type: "image_url",
          image_url: {
            url: userMessage.image,
          },
        },
      ]
    : textPart;

  chat.messages.push({
    role: "user",
    content,
  });

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-OpenRouter-Title": "Mult-AI-Meter",
        "HTTP-Referer": window.location.origin,
      },
      body: JSON.stringify({
        model,
        messages: chat.messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed with ${response.status}`);
    }

    const data = await response.json();
    const responseText = normalizeAssistantText(data?.choices?.[0]?.message?.content)
      || "I received the data but couldn't generate a response.";

    chat.messages.push({
      role: "assistant",
      content: responseText,
    });

    return responseText;
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    return "Sorry, I encountered an error communicating with the AI service. Please check your connection.";
  }
};
