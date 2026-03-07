import OpenAI from "openai";
import { ExtractedReceipt } from "./types";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return openaiClient;
}

export async function extractReceiptData(
  imageBase64: string,
  mimeType: string = "image/jpeg"
): Promise<ExtractedReceipt> {
  const openai = getOpenAI();

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: `You are a receipt data extractor. Extract structured data from receipt images.
Return ONLY valid JSON with this exact schema:
{
  "vendor": "string",
  "date": "YYYY-MM-DD",
  "lineItems": [{"name": "string", "quantity": number, "price": number}],
  "subtotal": number,
  "tax": number,
  "tip": number,
  "total": number,
  "confidence": number (0-1)
}
If a field is unclear, use 0 for numbers and "Unknown" for strings. Set confidence accordingly.`,
      },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: "text",
            text: "Extract all data from this receipt image.",
          },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0,
  });

  const content = response.choices[0]?.message?.content || "{}";

  // Extract JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      vendor: "Unknown",
      date: new Date().toISOString().split("T")[0],
      lineItems: [],
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      confidence: 0,
    };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      vendor: parsed.vendor || "Unknown",
      date: parsed.date || new Date().toISOString().split("T")[0],
      lineItems: Array.isArray(parsed.lineItems) ? parsed.lineItems : [],
      subtotal: Number(parsed.subtotal) || 0,
      tax: Number(parsed.tax) || 0,
      tip: Number(parsed.tip) || 0,
      total: Number(parsed.total) || 0,
      confidence: Number(parsed.confidence) || 0,
    };
  } catch {
    return {
      vendor: "Unknown",
      date: new Date().toISOString().split("T")[0],
      lineItems: [],
      subtotal: 0,
      tax: 0,
      tip: 0,
      total: 0,
      confidence: 0,
    };
  }
}
