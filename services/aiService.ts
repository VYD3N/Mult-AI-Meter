import { DEFAULT_SYSTEM_INSTRUCTION } from "../constants";
import { AI_GUIDED_PRESET_ID, ChatMessage, MultimeterReading, TroubleshootingPreset } from "../types";

type OpenRouterMessage = {
  role: "user" | "assistant";
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
const fallbackModels = [
  "google/gemma-3-12b-it:free",
  "google/gemma-3-4b-it:free",
  "meta-llama/llama-3.2-3b-instruct:free",
];

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
    messages: [],
  };
};

const withSystemInstruction = (
  messages: OpenRouterMessage[],
): OpenRouterMessage[] => {
  if (messages.length === 0) {
    return messages;
  }

  const [first, ...rest] = messages;
  if (typeof first.content === "string") {
    return [
      {
        ...first,
        content: `${DEFAULT_SYSTEM_INSTRUCTION.trim()}\n\n[USER MESSAGE]\n${first.content}`,
      },
      ...rest,
    ];
  }

  return [
    {
      ...first,
      content: [
        {
          type: "text",
          text: `${DEFAULT_SYSTEM_INSTRUCTION.trim()}\n\n[USER MESSAGE]`,
        },
        ...first.content,
      ],
    },
    ...rest,
  ];
};

const getErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json();
    return data?.error?.metadata?.raw || data?.error?.message || `Request failed with ${response.status}`;
  } catch {
    return `Request failed with ${response.status}`;
  }
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
    const payloadMessages = withSystemInstruction(chat.messages);
    const modelsToTry = [model, ...fallbackModels.filter((candidate) => candidate !== model)];
    let lastError = "";

    for (const candidate of modelsToTry) {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "X-OpenRouter-Title": "Mult-AI-Meter",
          "HTTP-Referer": window.location.origin,
        },
        body: JSON.stringify({
          model: candidate,
          messages: payloadMessages,
        }),
      });

      if (!response.ok) {
        lastError = await getErrorMessage(response);
        if (response.status === 429 || response.status >= 500) {
          continue;
        }
        throw new Error(lastError);
      }

      const data = await response.json();
      const responseText = normalizeAssistantText(data?.choices?.[0]?.message?.content)
        || "I received the data but couldn't generate a response.";

      chat.messages.push({
        role: "assistant",
        content: responseText,
      });

      return responseText;
    }

    throw new Error(lastError || "All configured OpenRouter models failed.");
  } catch (error) {
    console.error("OpenRouter API Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.toLowerCase().includes("rate-limited") || message.includes("429")) {
      return "OpenRouter's free models are currently rate-limited. Please retry in a moment.";
    }
    return `Sorry, I encountered an AI service error: ${message}`;
  }
};
