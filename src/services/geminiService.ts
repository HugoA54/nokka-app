import type { AIMacroResult } from "@types/index";

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY!;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

type MimeType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const MIME_MAP: Record<string, MimeType> = {
  "/9j/": "image/jpeg",
  iVBORw0KGgo: "image/png",
  R0lGOD: "image/gif",
  UklGR: "image/webp",
};

function detectMimeType(base64: string): MimeType {
  for (const [prefix, mime] of Object.entries(MIME_MAP)) {
    if (base64.startsWith(prefix)) return mime;
  }
  return "image/jpeg";
}

function stripBase64Header(base64: string): string {
  const match = base64.match(/^data:image\/[a-z]+;base64,(.+)$/);
  return match ? match[1] : base64;
}

const NUTRITIONIST_PROMPT = `You are a professional nutritionist and food analyst.
Analyze this meal photo and estimate its nutritional content with high accuracy.
Consider portion sizes, cooking methods, and ingredient density.

Return ONLY a valid JSON object in this exact format with no markdown, no code blocks, no explanation:
{
  "name": "meal name in English",
  "calories": number,
  "proteines": number,
  "glucides": number,
  "lipides": number
}

Rules:
- All macro values must be in grams (integers)
- Calories must be in kcal (integer)
- Estimate for the full visible portion in the image
- Be conservative but realistic
- If you cannot identify the food, make your best educated guess`;

class GeminiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeMealImage(
    imageBase64: string,
    notes?: string,
  ): Promise<AIMacroResult> {
    if (!this.apiKey) {
      throw new Error(
        "Gemini API key is not configured. Set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.",
      );
    }

    const cleanBase64 = stripBase64Header(imageBase64);
    const mimeType = detectMimeType(cleanBase64);

    const prompt = notes
      ? `${NUTRITIONIST_PROMPT}\n\nAdditional context from user: ${notes}`
      : NUTRITIONIST_PROMPT;

    const body = {
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topK: 32,
        topP: 1,
      },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[geminiService] API error:", errorText);
      throw new Error(
        `Gemini API error ${response.status}: ${response.statusText}`,
      );
    }

    const json = await response.json();

    const text: string | undefined =
      json?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("Gemini returned an empty response. Please try again.");
    }

    // Strip markdown code fences if present
    const cleaned = text
      .replace(/```json\s*/gi, "")
      .replace(/```\s*/g, "")
      .trim();

    let parsed: AIMacroResult;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error(
        `Could not parse Gemini response as JSON. Raw: ${cleaned}`,
      );
    }

    // Validate and sanitize
    const result: AIMacroResult = {
      name: String(parsed.name ?? "Unknown meal"),
      calories: Math.round(Number(parsed.calories) || 0),
      proteines: Math.round(Number(parsed.proteines) || 0),
      glucides: Math.round(Number(parsed.glucides) || 0),
      lipides: Math.round(Number(parsed.lipides) || 0),
    };

    if (result.calories <= 0) {
      throw new Error(
        "AI returned zero calories. The image may not show food clearly.",
      );
    }

    return result;
  }

  async analyzeWorkoutSession(prompt: string): Promise<string> {
    if (!this.apiKey) throw new Error('Gemini API key not configured.');

    const body = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, topK: 32, topP: 1 },
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) throw new Error(`Gemini API error ${response.status}`);

    const json = await response.json();
    const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text.trim();
  }
}

export const geminiService = new GeminiService(GEMINI_API_KEY ?? "");
