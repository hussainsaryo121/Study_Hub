import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN ||
  "https://hussainsaryo121.github.io";

function sendJSON(res, status, data) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.json(data);
}

function cleanText(value, max = 12000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204);
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.end();
  }

  if (req.method !== "POST") {
    return sendJSON(res, 405, {
      error: "Use POST."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJSON(res, 500, {
      error: "OPENAI_API_KEY is not configured."
    });
  }

  try {
    const body = req.body || {};
    const message = cleanText(body.message);

    if (!message) {
      return sendJSON(res, 400, {
        error: "Message is required."
      });
    }

    const mode =
      body.mode === "research" ? "research" :
      body.mode === "quiz" ? "quiz" :
      body.mode === "notes" ? "notes" :
      "tutor";

    const instructions = `
You are Study Hub AI Tutor.

You help a Grade 9 school student.

Student profile:
Class: ${cleanText(body.profile?.class, 50) || "Grade 9"}
Board: ${cleanText(body.profile?.board, 50) || "AKU-EB"}
Level: ${cleanText(body.profile?.level, 50) || "School"}

Rules:
- Explain in simple language first.
- Give exam-level understanding when useful.
- Use headings and bullet points.
- Give examples when helpful.
- For Mathematics and Science, show the method and working.
- Focus on concepts, application, reasoning and exam preparation.
- Keep answers appropriate for a school student.
- Never invent facts or sources.
- If web search is used, clearly distinguish current information.

Current mode: ${mode}
`;

    const request = {
      model: "gpt-5.6-luna",
      instructions,
      input: message,
      max_output_tokens: 1800
    };

    if (mode === "research" || body.webSearch === true) {
      request.tools = [
        {
          type: "web_search"
        }
      ];
    }

    const response = await client.responses.create(request);

    return sendJSON(res, 200, {
      success: true,
      answer:
        response.output_text ||
        "The AI returned no answer.",
      mode,
      webSearchUsed:
        mode === "research" || body.webSearch === true
    });

  } catch (error) {
    console.error(error);

    return sendJSON(res, 500, {
      success: false,
      error: "The AI service could not complete the request."
    });
  }
}