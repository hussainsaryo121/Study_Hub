const ALLOWED_ORIGINS = new Set([
  "https://study-hub-ebon.vercel.app",
  "https://hussainsaryo121.github.io"
]);

function setCors(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJSON(req, res, status, data) {
  setCors(req, res);
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.json(data);
}

function cleanText(value, max = 12000) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return sendJSON(req, res, 405, {
      error: "Use POST."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return sendJSON(req, res, 500, {
      error: "OPENAI_API_KEY is not configured."
    });
  }

  try {
    const body = req.body || {};
    const message = cleanText(body.message);

    if (!message) {
      return sendJSON(req, res, 400, {
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

    const requestBody = {
      model: "gpt-5.6-luna",
      instructions,
      input: message,
      max_output_tokens: 1800
    };

    if (mode === "research" || body.webSearch === true) {
      requestBody.tools = [
        {
          type: "web_search"
        }
      ];
    }

    const response = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(requestBody)
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("OpenAI API error:", result);

      return sendJSON(req, res, 500, {
        success: false,
        error: "The AI service could not complete the request."
      });
    }

    return sendJSON(req, res, 200, {
      success: true,
      answer:
        result.output_text ||
        "The AI returned no answer.",
      mode,
      webSearchUsed:
        mode === "research" || body.webSearch === true
    });

  } catch (error) {
    console.error("Server error:", error);

    return sendJSON(req, res, 500, {
      success: false,
      error: "The AI service could not complete the request."
    });
  }
}