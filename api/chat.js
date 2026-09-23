const ALLOWED_ORIGINS = new Set([
  "https://hussainsaryo121.github.io",
  "https://study-hub-ebon.vercel.app"
]);

function cors(req, res) {
  const origin = req.headers.origin;

  if (ALLOWED_ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function response(req, res, status, data) {
  cors(req, res);

  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");

  return res.json(data);
}

function clean(value, max = 12000) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, max);
}

function getSources(output) {
  const sources = [];
  const used = new Set();

  for (const item of output || []) {
    if (item?.type !== "message") {
      continue;
    }

    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const citation =
          annotation.url_citation || annotation;

        const url = citation?.url;

        if (!url || used.has(url)) {
          continue;
        }

        used.add(url);

        sources.push({
          title: citation.title || url,
          url: url
        });
      }
    }
  }

  return sources.slice(0, 8);
}

export default async function handler(req, res) {

  cors(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return response(req, res, 405, {
      success: false,
      error: "Use POST."
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response(req, res, 500, {
      success: false,
      error:
        "OPENAI_API_KEY is missing from Vercel Environment Variables."
    });
  }

  try {

    let body = req.body || {};

    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        return response(req, res, 400, {
          success: false,
          error: "Invalid JSON body."
        });
      }
    }

    const message = clean(body.message);

    if (!message) {
      return response(req, res, 400, {
        success: false,
        error: "Message is required."
      });
    }

    const mode =
      body.mode === "research"
        ? "research"
        : body.mode === "quiz"
        ? "quiz"
        : body.mode === "notes"
        ? "notes"
        : "tutor";

    const profile = body.profile || {};

    const studentClass =
      clean(profile.class, 50) || "Grade 9";

    const board =
      clean(profile.board, 80) || "AKU-EB";

    const level =
      clean(profile.level, 50) || "Student";

    let modeInstruction = "";

    if (mode === "tutor") {

      modeInstruction = `
Act as a personal AI Tutor.

Explain the topic clearly.
Start with simple language.
Then give deeper understanding.
For Mathematics and Science, show the method and working.
Give examples when useful.
`;

    } else if (mode === "research") {

      modeInstruction = `
Act as an AI Research Tutor.

Research the requested topic using current web information.
Give a clear summary suitable for a Grade 9 student.
Use reliable sources.
Mention important sources at the end.
Separate current information from general explanation.
`;

    } else if (mode === "quiz") {

      modeInstruction = `
Act as Test Me AI.

Create questions about the requested topic.
Mix:
- Recall
- Understanding
- Application
- Reasoning

Do not immediately reveal the answers unless the student asks.
`;

    } else if (mode === "notes") {

      modeInstruction = `
Create clean revision notes.

Use:
- Definition
- Key points
- Examples
- Formula where needed
- Exam tip

Keep the notes easy to revise.
`;
    }

    const instructions = `
You are StudyHub AI.

Student:
Class: ${studentClass}
Board: ${board}
Level: ${level}

${modeInstruction}

General rules:

1. Use simple English.
2. Match the student's level.
3. Use headings and bullet points.
4. Focus on understanding and examination preparation.
5. Do not invent facts.
6. For calculations, show working.
7. For Science, explain concepts clearly.
8. For English, explain grammar and writing clearly.
9. Keep answers useful rather than unnecessarily long.
10. The student is using StudyHub for school learning.
`;

    const requestBody = {
      model: "gpt-5.6-luna",

      instructions: instructions,

      input: message,

      max_output_tokens: 1800
    };

    if (mode === "research") {

      requestBody.tools = [
        {
          type: "web_search"
        }
      ];

      requestBody.tool_choice = "required";
    }

    const apiResponse = await fetch(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization":
            `Bearer ${process.env.OPENAI_API_KEY}`
        },

        body: JSON.stringify(requestBody)
      }
    );

    const result = await apiResponse.json();

    if (!apiResponse.ok) {

      console.error(
        "OpenAI API error:",
        result
      );

      return response(req, res, 502, {
        success: false,

        error:
          result?.error?.message ||
          `OpenAI API error: HTTP ${apiResponse.status}`
      });
    }

    const answer =
      result.output_text ||
      "The AI did not return an answer.";

    const sources =
      mode === "research"
        ? getSources(result.output)
        : [];

    return response(req, res, 200, {

      success: true,

      answer: answer,

      mode: mode,

      webSearchUsed:
        mode === "research",

      sources: sources
    });

  } catch (error) {

    console.error(
      "StudyHub server error:",
      error
    );

    return response(req, res, 500, {

      success: false,

      error:
        error?.message ||
        "StudyHub AI could not connect to the AI service."
    });
  }
}