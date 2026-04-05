import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { DEFAULT_SYSTEM_INSTRUCTION } from "../constants";
import { ChatMessage, MultimeterReading, TroubleshootingPreset, AI_GUIDED_PRESET_ID } from "../types";

let aiClient: GoogleGenAI | null = null;
const apiKey = import.meta.env.GEMINI_API_KEY;

export const isGeminiConfigured = (): boolean => Boolean(apiKey);

const getClient = (): GoogleGenAI | null => {
  if (!apiKey) {
    return null;
  }

  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }

  return aiClient;
};

export const createChatSession = (): Chat | null => {
  const ai = getClient();
  if (!ai) {
    return null;
  }

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: DEFAULT_SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }] // Enable Google Search for technical specs lookup
    },
  });
};

export const sendMessageToAI = async (
  chat: Chat, 
  userMessage: ChatMessage,
  currentReading: MultimeterReading | null,
  activePreset: TroubleshootingPreset | null = null
): Promise<string> => {
  
  // Construct a rich context prompt
  let textPart = userMessage.text;

  // Append Context Information
  if (userMessage.context) {
    if (userMessage.context.deviceName) textPart += `\n[Device: ${userMessage.context.deviceName}]`;
    if (userMessage.context.goal) textPart += `\n[Goal: ${userMessage.context.goal}]`;
  }

  // Append Telemetry
  if (currentReading) {
    textPart += `
\n[REAL-TIME TELEMETRY]
Value: ${currentReading.value}
Unit: ${currentReading.unit}
Mode: ${currentReading.mode}
OverLimit: ${currentReading.isOverLimit}
RawHex: ${currentReading.rawHex || 'N/A'}
`;
  }

  // Append Preset Context
  if (activePreset) {
      if (activePreset.id === AI_GUIDED_PRESET_ID) {
          textPart += `\n[Mode: AI Guided - You are in control of safety validation]`;
      } else {
          textPart += `\n[Active Preset: ${activePreset.name} - ${activePreset.description}]`;
      }
  }

  const parts: any[] = [{ text: textPart }];

  // Add Image if present (Base64)
  if (userMessage.image) {
    // Remove data URL header if present (e.g. "data:image/jpeg;base64,")
    const base64Data = userMessage.image.split(',')[1];
    parts.push({
        inlineData: {
            mimeType: 'image/jpeg', // Assuming jpeg/png for simplicity, or detect from header
            data: base64Data
        }
    });
  }

  try {
    const response: GenerateContentResponse = await chat.sendMessage({
      message: { parts }
    });
    return response.text || "I received the data but couldn't generate a response.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Sorry, I encountered an error communicating with the AI service. Please check your connection.";
  }
};
