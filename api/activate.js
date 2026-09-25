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

function clean(value, max = 200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function getLicenseKeys() {
  const raw = process.env.LICENSE_KEYS || "{}";

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
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

    const key = clean(body.key, 100);
    const deviceHash = clean(body.deviceHash, 200);

    if (!key) {
      return response(req, res, 400, {
        success: false,
        error: "License key is required."
      });
    }

    if (!deviceHash) {
      return response(req, res, 400, {
        success: false,
        error: "Device information is required."
      });
    }

    const licenses = getLicenseKeys();
    const license = licenses[key];

    if (!license) {
      return response(req, res, 403, {
        success: false,
        error: "Invalid license key."
      });
    }

    if (license.status === "revoked") {
      return response(req, res, 403, {
        success: false,
        error: "This license key has been revoked."
      });
    }

    if (
      license.deviceHash &&
      license.deviceHash !== deviceHash
    ) {
      return response(req, res, 403, {
        success: false,
        error: "This license is already linked to another device."
      });
    }

    return response(req, res, 200, {
      success: true,
      premium: true,
      message: "Premium activated successfully."
    });

  } catch (error) {
    console.error("License activation error:", error);

    return response(req, res, 500, {
      success: false,
      error: "License activation service failed."
    });
  }
                  }
