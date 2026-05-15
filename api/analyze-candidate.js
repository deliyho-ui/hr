const admin = require("firebase-admin");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

const MAX_CV_CHARS = 18000;
const AI_REQUEST_TIMEOUT_MS = 45000;
const DEFAULT_AI_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_ANTHROPIC_VERSION = "2023-06-01";

function initFirebaseAdmin() {
  if (admin.apps.length) return admin.app();

  const serviceAccount = getFirebaseServiceAccount();
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "hr-ai-50d43.firebasestorage.app",
  });
}

function getFirebaseServiceAccount() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const base64Json = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

  if (rawJson?.trim()) {
    return parseServiceAccountJson(rawJson, "FIREBASE_SERVICE_ACCOUNT_JSON");
  }

  if (base64Json?.trim()) {
    const decoded = Buffer.from(base64Json, "base64").toString("utf8");
    return parseServiceAccountJson(decoded, "FIREBASE_SERVICE_ACCOUNT_BASE64");
  }

  throw new Error(
    "Missing Firebase Admin credentials. Add FIREBASE_SERVICE_ACCOUNT_JSON to Vercel with the full downloaded service-account JSON."
  );
}

function parseServiceAccountJson(value, sourceName) {
  try {
    const serviceAccount = JSON.parse(value);
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    return serviceAccount;
  } catch (error) {
    throw new Error(`${sourceName} is not valid JSON. Paste the full service-account .json file content, not the Admin SDK code snippet.`);
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    initFirebaseAdmin();
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    await admin.auth().verifyIdToken(token);

    const { candidateId } = req.body || {};
    if (!candidateId || typeof candidateId !== "string") {
      return res.status(400).json({ error: "Missing candidateId" });
    }

    const db = admin.firestore();
    const candidateRef = db.collection("candidates").doc(candidateId);
    const candidateSnapshot = await candidateRef.get();
    if (!candidateSnapshot.exists) {
      return res.status(404).json({ error: "Candidate not found" });
    }

    await candidateRef.set({
      aiAnalysis: {
        status: "pending",
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    const candidate = candidateSnapshot.data();
    const settingsSnapshot = await db.collection("settings").doc("screening").get();
    const settings = settingsSnapshot.exists ? settingsSnapshot.data() : {};
    const cvText = await extractCandidateCvText(candidate);
    const analysis = await analyzeWithAi(candidate, settings, cvText);

    await candidateRef.set({
      aiAnalysis: {
        status: "completed",
        model: getAiModel(),
        classification: analysis.classification,
        score: analysis.score,
        summary: analysis.summary,
        recommendation: analysis.recommendation,
        strengths: analysis.strengths || [],
        risks: analysis.risks || [],
        questionsToAsk: analysis.questionsToAsk || [],
        rationale: analysis.rationale,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      history: admin.firestore.FieldValue.arrayUnion({
        label: `ניתוח AI הושלם: ${classificationLabel(analysis.classification)} / ${analysis.score}`,
        at: new Date().toISOString(),
      }),
    }, { merge: true });

    return res.status(200).json({ ok: true, analysis });
  } catch (error) {
    console.error(error);
    const candidateId = req.body?.candidateId;
    if (candidateId && admin.apps.length) {
      try {
        await admin.firestore().collection("candidates").doc(candidateId).set({
          aiAnalysis: {
            status: "failed",
            error: error.message || "Unknown AI error",
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } catch (writeError) {
        console.error(writeError);
      }
    }
    return res.status(500).json({ error: error.message || "AI analysis failed" });
  }
};

async function extractCandidateCvText(candidate) {
  const storagePath = candidate?.cvFile?.storagePath;
  if (!storagePath) return "";

  const file = admin.storage().bucket().file(storagePath);
  const [buffer] = await file.download();
  const fileName = candidate.cvFile?.name || storagePath;
  const contentType = candidate.cvFile?.type || "";

  if (contentType.includes("pdf") || fileName.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdfParse(buffer);
    return trimCvText(parsed.text || "");
  }

  if (
    contentType.includes("word") ||
    fileName.toLowerCase().endsWith(".docx") ||
    fileName.toLowerCase().endsWith(".doc")
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return trimCvText(parsed.value || "");
  }

  return "";
}

function trimCvText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_CV_CHARS);
}

async function analyzeWithAi(candidate, settings, cvText) {
  const apiKey = getAiApiKey();
  if (!apiKey) {
    throw new Error("Missing Claude API key. Set ANTHROPIC_API_KEY in Vercel.");
  }

  const model = getAiModel();
  const endpoint = process.env.ANTHROPIC_API_URL || DEFAULT_ANTHROPIC_URL;
  const anthropicVersion = process.env.ANTHROPIC_VERSION || DEFAULT_ANTHROPIC_VERSION;
  const prompt = buildPrompt(candidate, settings, cvText);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(process.env.ANTHROPIC_TIMEOUT_MS || AI_REQUEST_TIMEOUT_MS));

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": anthropicVersion,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(process.env.ANTHROPIC_MAX_TOKENS || 1800),
        temperature: 0.2,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Claude request timed out. Try again or reduce the CV size.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "AI provider request failed");
  }

  const output = extractClaudeText(data);
  return parseAnalysis(output);
}

function getAiApiKey() {
  return process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
}

function getAiModel() {
  return process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || process.env.AI_MODEL || DEFAULT_AI_MODEL;
}

function extractClaudeText(data) {
  if (!Array.isArray(data?.content)) return "";

  return data.content
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

function buildPrompt(candidate, settings, cvText) {
  return `
אתה מסייע למגייס במיון ראשוני של מועמדים לתפקיד בתחום הביטחון/אבטחה.
המטרה: לתת המלצה תפעולית למגייס, לא החלטה משפטית ולא החלטה סופית.

החזר אך ורק JSON תקין במבנה הבא:
{
  "classification": "green|orange|gray|red",
  "score": 0,
  "summary": "תקציר קצר בעברית",
  "recommendation": "המלצה מעשית למגייס",
  "strengths": ["..."],
  "risks": ["..."],
  "questionsToAsk": ["..."],
  "rationale": "הסבר קצר למה התקבלה ההמלצה"
}

כללי צבע:
- green: התאמה טובה וברורה להמשך תהליך
- orange: פוטנציאל טוב אבל דורש בדיקה ידנית
- gray: חסר מידע מהותי או אין מספיק בסיס להחלטה
- red: חוסר התאמה בולט לפי הנתונים שנמסרו

הגדרות סף מהדאשבורד:
${JSON.stringify({
    greenThreshold: settings.greenThreshold ?? 80,
    orangeThreshold: settings.orangeThreshold ?? 60,
    licenseRequirement: settings.licenseRequirement || "יתרון בלבד",
    screeningPrompt: settings.screeningPrompt || "",
    successProfile: settings.successProfile || "",
  }, null, 2)}

נתוני מועמד:
${JSON.stringify({
    fullName: candidate.fullName || "",
    phone: candidate.phone || "",
    email: candidate.email || "",
    city: candidate.city || "",
    address: candidate.address || "",
    birthDate: candidate.birthDate || "",
    maritalStatus: candidate.maritalStatus || "",
    age: candidate.age || "",
    availability: candidate.availability || "",
    securityBackground: candidate.securityBackground || "",
    drivingLicense: candidate.drivingLicense || "",
    answers: candidate.answers || {},
    referredBy: candidate.referredBy || "",
  }, null, 2)}

טקסט קורות חיים:
${cvText || "לא הועלה/לא נקרא טקסט מקורות החיים. נתח לפי השאלון והנתונים הקיימים בלבד."}
`;
}

function parseAnalysis(output) {
  const jsonText = extractJson(output);
  const analysis = JSON.parse(jsonText);
  const classification = ["green", "orange", "gray", "red"].includes(analysis.classification)
    ? analysis.classification
    : "gray";

  return {
    classification,
    score: clampScore(analysis.score),
    summary: String(analysis.summary || "אין תקציר זמין."),
    recommendation: String(analysis.recommendation || "נדרשת בדיקה ידנית."),
    strengths: Array.isArray(analysis.strengths) ? analysis.strengths.slice(0, 8).map(String) : [],
    risks: Array.isArray(analysis.risks) ? analysis.risks.slice(0, 8).map(String) : [],
    questionsToAsk: Array.isArray(analysis.questionsToAsk) ? analysis.questionsToAsk.slice(0, 8).map(String) : [],
    rationale: String(analysis.rationale || ""),
  };
}

function extractJson(output) {
  const text = String(output || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI did not return JSON");
  }
  return text.slice(start, end + 1);
}

function clampScore(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function classificationLabel(classification) {
  return {
    green: "ירוק",
    orange: "כתום",
    gray: "אפור",
    red: "אדום",
  }[classification] || "אפור";
}
