// background.js - Service Worker

// State to manage multiple keys and keep track of which one is "active"
let activeGeminiKeys = [];
let activeGroqKeys = [];
let activeOpenRouterKeys = [];

let currentGeminiKeyIndex = 0;
let currentGroqKeyIndex = 0;
let currentOpenRouterKeyIndex = 0;

const GROQ_MODELS = [
  "llama-3.3-70b-versatile"
];

const OPENROUTER_MODELS = [
  "mistralai/mistral-7b-instruct:free"
];

const GEMINI_MODELS = [
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b"
];


/**
 * Loads API keys from the local .env file.
 */
async function loadApiKeys() {
  if (activeGeminiKeys.length > 0 || activeGroqKeys.length > 0) return;

  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    if (!response.ok) throw new Error("Could not find .env file");

    const envText = await response.text();

    const lines = envText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      const parsedValue = value ? value.trim() : "";

      if (key && parsedValue && !parsedValue.includes("replace_with_actual_key")) {
        const uKey = key.toUpperCase();
        if (uKey.includes("GROQ")) {
          activeGroqKeys.push(parsedValue);
        } else if (uKey.includes("OPENROUTER")) {
          activeOpenRouterKeys.push(parsedValue);
        } else if (uKey.includes("GEMINI") || parsedValue.startsWith("AIza")) {
          activeGeminiKeys.push(parsedValue);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to load .env file", error);
  }
}

// State for LinkedIn import flow
let linkedinImportTabId = null;
let creatingOffscreenDocument = null;

// Load ElevenLabs, Tavily, OCR.space and Filestack keys from .env
let keysLoaded = false;
let elevenLabsKey = '';
let tavilyKey = '';
let ocrSpaceKey = 'K86725043488957'; // Default from user
let filestackKey = 'AMVxhc0q5TQaKa663pnQ2z'; // Default from user

async function loadAllKeys() {
  if (keysLoaded && (activeGeminiKeys.length > 0 || activeGroqKeys.length > 0)) return;

  await loadApiKeys();
  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    if (!response.ok) {
      keysLoaded = true;
      return;
    }
    const envText = await response.text();
    const lines = envText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const parts = trimmed.split('=');
      const key = parts[0]?.trim().toUpperCase();
      const value = parts.slice(1).join('=')?.trim();
      if (!value || value.includes('replace_with_actual_key')) continue;
      if (key.includes('ELEVENLABS') || key.includes('ELEVEN_LABS')) elevenLabsKey = value;
      if (key.includes('TAVILY')) tavilyKey = value;
      if (key.includes('OCR_SPACE') || key.includes('OCRSPACE')) ocrSpaceKey = value;
      if (key.includes('FILESTACK')) filestackKey = value;
    }
    keysLoaded = true;
  } catch (e) {
    console.warn("Failed to load extra API keys", e);
    keysLoaded = true;
  }
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => typeof item === 'string' ? item.trim() : item)
    .filter(item => item !== null && item !== undefined && item !== '');
}

function mergeUniqueArray(existing, incoming) {
  const base = normalizeArray(existing);
  const next = normalizeArray(incoming);
  const seen = new Set(base.map(item => typeof item === 'object' ? JSON.stringify(item) : String(item).toLowerCase()));
  const merged = [...base];

  for (const item of next) {
    const key = typeof item === 'object' ? JSON.stringify(item) : String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mergeVaultData(currentVault, updates) {
  const merged = { ...(currentVault || {}) };
  if (!updates || typeof updates !== 'object') return merged;

  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      merged[key] = trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      merged[key] = mergeUniqueArray(merged[key], value);
      continue;
    }

    if (typeof value === 'object') {
      const existingObject = (merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])) ? merged[key] : {};
      merged[key] = { ...existingObject, ...value };
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

async function upsertVault(updates, sources = []) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['user_vault'], (res) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }

      const currentVault = res.user_vault || {};
      const mergedVault = mergeVaultData(currentVault, updates);
      const sourceList = Array.isArray(sources) ? sources : [sources];
      mergedVault.sources = mergeUniqueArray(mergedVault.sources || [], sourceList);
      mergedVault.updatedAt = new Date().toISOString();

      chrome.storage.local.set({ user_vault: mergedVault }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(mergedVault);
      });
    });
  });
}

async function ensureOffscreenDocument(path = 'offscreen.html') {
  if (!chrome.offscreen?.createDocument) {
    throw new Error("Offscreen API is not available in this Chrome version.");
  }

  const offscreenUrl = chrome.runtime.getURL(path);
  const existingContexts = chrome.runtime.getContexts
    ? await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    })
    : [];

  if (existingContexts.length > 0) return;

  if (creatingOffscreenDocument) {
    await creatingOffscreenDocument;
    return;
  }

  creatingOffscreenDocument = chrome.offscreen.createDocument({
    url: path,
    reasons: ['USER_MEDIA'],
    justification: 'Recording voice input for transcription.'
  });

  try {
    await creatingOffscreenDocument;
  } catch (error) {
    if (!String(error?.message || '').includes('Only a single offscreen document')) {
      throw error;
    }
  } finally {
    creatingOffscreenDocument = null;
  }
}

// Listen for messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received Message:", request.action);

  if (request.action === 'CALL_LLM') {
    askLLM(request.prompt)
      .then(response => sendResponse({ success: true, text: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'CRAFT_ON_PAGE_ANSWERS') {
    const { text, fields, profileData } = request.data;
    generateAnswers(text, fields, profileData)
      .then(response => {
        sendResponse({ success: true, answers: response.answers, atsKeywords: response.atsKeywords });
      })
      .catch(error => {
        console.error("generateAnswers failed:", error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  if (request.action === 'EXTRACT_DOCUMENT') {
    const { base64Data, mimeType, docType } = request;
    extractFromDocument(base64Data, mimeType, docType)
      .then(async extracted => {
        const sourceTag = `document:${docType || 'unknown'}`;
        try {
          if (extracted && typeof extracted === 'object') {
            await upsertVault(extracted, sourceTag);
          } else {
            await upsertVault({ extractedText: String(extracted || '') }, sourceTag);
          }
          sendResponse({ success: true, data: extracted, vaultUpdated: true });
        } catch (vaultError) {
          console.warn("[AutoApply] Document extracted but vault upsert failed:", vaultError);
          sendResponse({
            success: true,
            data: extracted,
            vaultUpdated: false,
            warning: `Document extracted but vault update failed: ${vaultError.message}`
          });
        }
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Feature 1: LinkedIn Import
  if (request.action === 'IMPORT_LINKEDIN') {
    chrome.tabs.create({ url: 'https://www.linkedin.com/in/me', active: true }, (tab) => {
      linkedinImportTabId = tab.id;
      sendResponse({ success: true, message: 'Opening LinkedIn profile...' });
    });
    return true;
  }

  if (request.action === 'LINKEDIN_DATA_SCRAPED') {
    const data = request.data || {};
    const linkedinUpdates = {
      fullName: data.fullName || '',
      linkedinHeadline: data.linkedinHeadline || '',
      linkedinAbout: data.linkedinAbout || '',
      city: data.city || '',
      linkedinURL: data.linkedinURL || '',
      linkedinSkills: data.linkedinSkills || [],
      linkedinExperience: data.linkedinExperience || [],
      linkedinEducation: data.linkedinEducation || [],
      skills: data.linkedinSkills || []
    };

    upsertVault(linkedinUpdates, 'linkedin')
      .then((vault) => {
        if (linkedinImportTabId && sender?.tab?.id === linkedinImportTabId) {
          chrome.tabs.remove(linkedinImportTabId);
          linkedinImportTabId = null;
        }
        chrome.runtime.sendMessage({ action: 'LINKEDIN_IMPORT_DONE', data: vault });
        sendResponse({ success: true, data: vault });
      })
      .catch((error) => {
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Feature 1: GitHub Import
  if (request.action === 'FETCH_GITHUB') {
    const username = request.username;
    if (!username) {
      sendResponse({ success: false, error: 'No GitHub username provided' });
      return true;
    }
    fetchGitHubData(username)
      .then(async ghData => {
        const ghSkills = (ghData.projects || []).map(p => p.language).filter(Boolean);
        await upsertVault({
          githubUsername: username,
          githubBio: ghData.bio || '',
          githubURL: ghData.profileUrl || '',
          githubProjects: ghData.projects || [],
          skills: ghSkills
        }, 'github');
        sendResponse({ success: true, data: ghData });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'START_VOICE_RECORDING') {
    ensureOffscreenDocument()
      .then(() => {
        chrome.runtime.sendMessage({ target: 'offscreen', action: 'OFFSCREEN_START_RECORDING' }, (res) => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message });
            return;
          }
          if (!res?.ok) {
            sendResponse({ success: false, error: res?.error || 'Failed to start recording.' });
            return;
          }
          sendResponse({ success: true });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'STOP_VOICE_RECORDING') {
    chrome.runtime.sendMessage({ target: 'offscreen', action: 'OFFSCREEN_STOP_RECORDING' }, (res) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }
      sendResponse({ success: !!res?.ok, error: res?.error });
    });
    return true;
  }

  if (request.action === 'RECORDING_DONE') {
    const { audioBase64, mimeType } = request;
    transcribeAudio(audioBase64, mimeType || 'audio/webm')
      .then(async text => {
        chrome.runtime.sendMessage({ action: 'TRANSCRIPTION_DONE', text });
        try {
          if (chrome.offscreen?.closeDocument) await chrome.offscreen.closeDocument();
        } catch (_) { }
        sendResponse({ success: true });
      })
      .catch(async error => {
        chrome.runtime.sendMessage({ action: 'TRANSCRIPTION_ERROR', error: error.message });
        try {
          if (chrome.offscreen?.closeDocument) await chrome.offscreen.closeDocument();
        } catch (_) { }
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Feature 2: Voice Transcription
  if (request.action === 'TRANSCRIBE_AUDIO') {
    const { audioBase64, mimeType } = request;
    transcribeAudio(audioBase64, mimeType || 'audio/webm')
      .then(text => sendResponse({ success: true, text }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'PARSE_SKILLS_FROM_TEXT') {
    const { text } = request;
    parseSkillsFromText(text)
      .then(async skills => {
        const vault = await upsertVault({ skills }, 'voice-input');
        sendResponse({ success: true, skills: vault.skills || [] });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // Feature 3: ATS Keywords Search
  if (request.action === 'SEARCH_ATS_KEYWORDS') {
    const { jobTitle, company } = request;
    searchATSKeywords(jobTitle, company)
      .then(keywords => sendResponse({ success: true, keywords }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

function getDocumentTargetPrompt(docType) {
  const prompts = {
    resume: `Extract ALL information from this resume text. Return a JSON object with these exact keys where found: fullName, email, phone, linkedinURL, githubURL, portfolioURL, ugCollege, ugDegree, ugCGPA, ugYear, skills (array), certifications (array), projects (array of {name, description, tech}), experience (array of {company, role, duration, description}). Only include fields that are actually present. No null values.`,
    aadhaar: `Extract from this Aadhaar card text: fullName, dob (DD/MM/YYYY format), gender, addressLine1, city, state, pincode. Also extract aadhaarLast4 (last 4 digits only). Return JSON only.`,
    pan: `Extract from this PAN card text: fullName, panNumber, dob (DD/MM/YYYY). Return JSON only.`,
    marksheet: `Extract: institutionName, degree or standard, percentage or CGPA, year of passing, subjects. Return JSON only.`,
    offer_letter: `Extract: companyName, role, ctc, joiningDate, location. Return JSON only.`,
    unknown: `This is extracted text from a document. Structure every piece of personal/professional information into a flat JSON object with descriptive key names.`
  };
  return prompts[docType] || prompts.unknown;
}

function parseModelJson(text) {
  const clean = (text || "").replace(/```json|```/gi, "").trim();
  if (!clean) throw new Error("Model returned an empty response.");
  try {
    return JSON.parse(clean);
  } catch (e) {
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    throw e;
  }
}

async function extractRawTextWithOCRSpace(rawBase64, mimeType) {
  if (!ocrSpaceKey) {
    throw new Error("No OCR.space key configured for document parsing.");
  }

  const dataUri = `data:${mimeType || 'application/octet-stream'};base64,${rawBase64}`;
  const formData = new FormData();
  formData.append('base64Image', dataUri);
  formData.append('language', 'eng');
  formData.append('isOverlayRequired', 'false');
  formData.append('OCREngine', '2');

  console.log(`[AutoApply] Sending ${mimeType} to OCR.space...`);
  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    headers: {
      apikey: ocrSpaceKey
    },
    body: formData
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OCR.space Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    const message = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(' | ')
      : (data.ErrorMessage || data.ErrorDetails || 'Unknown OCR.space processing error');
    throw new Error(`OCR.space processing failed: ${message}`);
  }

  const parsedResults = Array.isArray(data.ParsedResults) ? data.ParsedResults : [];
  const rawText = parsedResults
    .map(result => result?.ParsedText || '')
    .join('\n\n')
    .trim();

  if (!rawText) {
    const message = Array.isArray(data.ErrorMessage)
      ? data.ErrorMessage.join(' | ')
      : (data.ErrorMessage || data.ErrorDetails || 'No text returned from OCR.space');
    throw new Error(`OCR.space returned no text. ${message}`);
  }

  return rawText;
}

async function extractRawTextWithFilestack(rawBase64, mimeType) {
  if (!filestackKey) {
    throw new Error("No Filestack key configured for document parsing.");
  }

  const storeUrl = `https://www.filestackapi.com/api/store/S3?key=${filestackKey}&base64decode=true`;
  console.log(`[AutoApply] Uploading ${mimeType} to Filestack...`);

  const storeRes = await fetch(storeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': mimeType || 'application/octet-stream'
    },
    body: rawBase64
  });

  if (!storeRes.ok) {
    const errText = await storeRes.text();
    throw new Error(`Filestack Upload Error: ${storeRes.status} - ${errText}`);
  }

  const storeRawText = await storeRes.text();
  let storeData = {};
  try {
    storeData = JSON.parse(storeRawText);
  } catch (e) {
    storeData = { raw: storeRawText };
  }

  const handleFromUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const match = url.match(/filestackcontent\.com\/([^/?#]+)/i);
    return match?.[1] || '';
  };

  const handle =
    storeData.handle ||
    storeData.key ||
    handleFromUrl(storeData.url) ||
    handleFromUrl(storeData.cdn_url);

  if (!handle) {
    const detail = storeRawText ? storeRawText.slice(0, 500) : JSON.stringify(storeData).slice(0, 500);
    throw new Error(`Filestack upload did not return a usable handle. Response: ${detail}`);
  }

  console.log(`[AutoApply] Processing OCR for handle: ${handle}`);
  const ocrUrl = `https://cdn.filestackcontent.com/${filestackKey}/ocr/${handle}`;
  const ocrRes = await fetch(ocrUrl);

  if (!ocrRes.ok) {
    const errText = await ocrRes.text();
    throw new Error(`Filestack OCR Error: ${ocrRes.status} - ${errText}`);
  }

  const ocrContentType = (ocrRes.headers.get('content-type') || '').toLowerCase();
  let rawText = '';
  if (ocrContentType.includes('application/json')) {
    const ocrData = await ocrRes.json();
    rawText = ocrData.text || ocrData.extracted_text || ocrData?.data?.text || '';
  } else {
    rawText = await ocrRes.text();
  }

  if (!rawText.trim()) {
    throw new Error("Filestack OCR returned no text from this document.");
  }

  return rawText;
}

async function structureExtractedText(rawText, docType) {
  const structurePrompt = `Raw extracted text from OCR:
"${rawText}"

Target: ${getDocumentTargetPrompt(docType)}
Return ONLY valid JSON. Start with { and end with }. No markdown code blocks.`;

  console.log(`[AutoApply] Structuring OCR text via LLM...`);
  const structuredResult = await askLLM(structurePrompt);
  try {
    return parseModelJson(structuredResult);
  } catch (e) {
    console.error("Document structuring failed:", e, structuredResult);
    return { extractedText: rawText, note: "LLM failed to structure, returning raw OCR." };
  }
}

async function extractWithGeminiVision(rawBase64, mimeType, docType) {
  if (activeGeminiKeys.length === 0) {
    throw new Error("No Gemini keys configured for fallback extraction.");
  }

  const prompt = `${getDocumentTargetPrompt(docType)}

Analyze the attached document and return ONLY valid JSON.
Do not include markdown code blocks. Start with { and end with }.`;

  let lastError = "Unknown Gemini fallback error";

  for (const key of activeGeminiKeys) {
    for (const modelName of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const payload = {
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType || 'application/octet-stream', data: rawBase64 } },
            { text: prompt }
          ]
        }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `Gemini Vision Error: ${response.status} - ${errText}`;
          continue;
        }

        const data = await response.json();
        const modelText = (data?.candidates?.[0]?.content?.parts || [])
          .map(part => part.text || '')
          .join('\n')
          .trim();

        if (!modelText) {
          lastError = "Gemini Vision returned an empty response.";
          continue;
        }

        return parseModelJson(modelText);
      } catch (error) {
        lastError = error.message || "Network error during Gemini fallback extraction";
      }
    }
  }

  throw new Error(lastError);
}

async function extractFromDocument(base64Data, mimeType, docType) {
  await loadAllKeys();
  const rawBase64 = base64Data.split(',')[1] || base64Data;

  let ocrSpaceError = null;
  if (ocrSpaceKey) {
    try {
      const rawText = await extractRawTextWithOCRSpace(rawBase64, mimeType);
      return await structureExtractedText(rawText, docType);
    } catch (error) {
      ocrSpaceError = error;
      console.warn("[AutoApply] OCR.space extraction failed. Attempting Filestack fallback...", error?.message || error);
    }
  } else {
    ocrSpaceError = new Error("No OCR.space key configured for document parsing.");
  }

  let filestackError = null;
  if (filestackKey) {
    try {
      const rawText = await extractRawTextWithFilestack(rawBase64, mimeType);
      return await structureExtractedText(rawText, docType);
    } catch (error) {
      filestackError = error;
      console.warn("[AutoApply] Filestack extraction failed. Attempting Gemini fallback...", error?.message || error);
    }
  } else {
    filestackError = new Error("No Filestack key configured for document parsing.");
  }

  console.log("[AutoApply] Falling back to Gemini direct document extraction...");
  try {
    return await extractWithGeminiVision(rawBase64, mimeType, docType);
  } catch (geminiError) {
    const ocrSpaceMsg = ocrSpaceError?.message || 'not attempted';
    const filestackMsg = filestackError?.message || 'not attempted';
    throw new Error(`Document extraction failed. OCR.space: ${ocrSpaceMsg} | Filestack: ${filestackMsg} | Gemini fallback: ${geminiError.message}`);
  }
}

async function callGroqAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeGroqKeys.length;
  let lastErrorMessage = "Unknown Groq error";

  while (attempts < maxAttempts) {
    const currentKey = activeGroqKeys[currentGroqKeyIndex];
    if (!currentKey) throw new Error("Missing valid Groq API Key");

    for (const modelName of GROQ_MODELS) {
      const url = `https://api.groq.com/openai/v1/chat/completions`;
      const payload = {
        model: modelName,
        messages: [{ role: "user", content: promptText }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastErrorMessage = `Groq API Error: ${response.status} - ${errorText}`;
          if (response.status === 404) continue;
          if (response.status === 429) {
            currentGroqKeyIndex = (currentGroqKeyIndex + 1) % activeGroqKeys.length;
            attempts++;
            break;
          }
          currentGroqKeyIndex = (currentGroqKeyIndex + 1) % activeGroqKeys.length;
          attempts++;
          break;
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || "";
      } catch (error) {
        lastErrorMessage = error.message || "Network error calling Groq";
        currentGroqKeyIndex = (currentGroqKeyIndex + 1) % activeGroqKeys.length;
        attempts++;
        break;
      }
    }
  }
  throw new Error(lastErrorMessage);
}

async function callGeminiAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeGeminiKeys.length;
  let lastErrorMessage = "Unknown Gemini error";

  while (attempts < maxAttempts) {
    const currentKey = activeGeminiKeys[currentGeminiKeyIndex];
    if (!currentKey) throw new Error("Missing valid Gemini API Key");

    for (const modelName of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${currentKey}`;
      const payload = {
        contents: [{ parts: [{ text: promptText }] }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastErrorMessage = `Gemini API Error: ${response.status} - ${errorText}`;
          if (response.status === 404) continue;
          if (response.status === 429) {
            currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
            attempts++;
            break;
          }
          currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
          attempts++;
          break;
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch (error) {
        lastErrorMessage = error.message || "Network error while calling Gemini";
        currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
        attempts++;
        break;
      }
    }
  }
  throw new Error(lastErrorMessage);
}

async function callOpenRouterAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeOpenRouterKeys.length;
  let lastErrorMessage = "Unknown OpenRouter error";

  while (attempts < maxAttempts) {
    const currentKey = activeOpenRouterKeys[currentOpenRouterKeyIndex];
    if (!currentKey) throw new Error("Missing valid OpenRouter API Key");

    for (const modelName of OPENROUTER_MODELS) {
      const url = `https://openrouter.ai/api/v1/chat/completions`;
      const payload = {
        model: modelName,
        messages: [{ role: "user", content: promptText }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errorText = await response.text();
          lastErrorMessage = `OpenRouter API Error: ${response.status} - ${errorText}`;
          if (response.status === 404) continue;
          if (response.status === 429) {
            currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % activeOpenRouterKeys.length;
            attempts++;
            break;
          }
          currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % activeOpenRouterKeys.length;
          attempts++;
          break;
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || "";
      } catch (error) {
        lastErrorMessage = error.message || "Network error calling OpenRouter";
        currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % activeOpenRouterKeys.length;
        attempts++;
        break;
      }
    }
  }
  throw new Error(lastErrorMessage);
}

async function askLLM(promptText) {
  await loadApiKeys();
  let errors = [];

  if (activeGroqKeys.length > 0) {
    try {
      const result = await callGroqAPI(promptText);
      if (result) return result;
    } catch (e) {
      errors.push(`Groq Error: ${e.message}`);
    }
  }

  if (activeOpenRouterKeys.length > 0) {
    try {
      const result = await callOpenRouterAPI(promptText);
      if (result) return result;
    } catch (e) {
      errors.push(`OpenRouter Error: ${e.message}`);
    }
  }

  if (activeGeminiKeys.length > 0) {
    try {
      const result = await callGeminiAPI(promptText);
      if (result) return result;
    } catch (e) {
      errors.push(`Gemini Error: ${e.message}`);
    }
  }

  throw new Error(`All LLM integrations failed. Details:\n` + errors.join('\n'));
}

async function generateAnswers(pageContext, fieldsToFill, userProfile) {
  await loadAllKeys();

  const vaultData = await new Promise(resolve => {
    chrome.storage.local.get(['user_vault'], res => resolve(res.user_vault || {}));
  });

  const pageSnippet = pageContext.substring(0, 2000);
  let jobTitle = '';
  let company = '';
  const titleMatch = pageSnippet.match(/(?:position|role|job title|opening)[:\s]*([^\n,|]{3,60})/i);
  if (titleMatch) jobTitle = titleMatch[1].trim();
  const companyMatch = pageSnippet.match(/(?:at|company|employer|organization)[:\s]*([^\n,|]{3,50})/i);
  if (companyMatch) company = companyMatch[1].trim();

  let atsKeywords = [];
  if (jobTitle && tavilyKey) {
    try {
      atsKeywords = await searchATSKeywords(jobTitle, company);
    } catch (e) {
      console.warn("[AutoApply] ATS keyword search failed:", e);
    }
  }

  const enrichedProfile = {
    ...userProfile,
    vaultSkills: vaultData.skills || [],
    linkedinHeadline: vaultData.linkedinHeadline || '',
    linkedinAbout: vaultData.linkedinAbout || '',
    githubProjects: (vaultData.githubProjects || []).slice(0, 4).map(p => `${p.name} (${p.language}, ★${p.stars}): ${p.description}`),
    experience: vaultData.experience || vaultData.linkedinExperience || [],
    education: vaultData.linkedinEducation || []
  };

  const atsSection = atsKeywords.length > 0
    ? `\n\nATS keywords to naturally weave in (use 2-3 per answer naturally):\n[${atsKeywords.join(', ')}]`
    : '';

  const prompt = `
    You are an AI Job Assistant helping a candidate fill forms. 
    Here is their profile: ${JSON.stringify(enrichedProfile)}
    Here is the job context: ${pageSnippet.substring(0, 1000)}
    
    Needs answers for: ${fieldsToFill.map(f => f.label).join(", ")}
    ${atsSection}
    
    Return JSON mapping field label to array of 2-3 smart answer variations.
    `;

  try {
    const ans = await askLLM(prompt);
    const jsonMatch = ans.match(/```json\n([\s\S]*?)\n```/) || ans.match(/\{[\s\S]*\}/);
    let answers;
    if (jsonMatch) {
      try {
        answers = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (e) {
        answers = { "Answer": [ans] };
      }
    } else {
      answers = { "Answer": [ans] };
    }
    return { answers, atsKeywords };
  } catch (error) {
    console.error("LLM APIs failed:", error);
    throw error;
  }
}

async function fetchGitHubData(username) {
  const profileRes = await fetch(`https://api.github.com/users/${username}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!profileRes.ok) throw new Error(`GitHub API error: ${profileRes.status}`);
  const profile = await profileRes.json();

  const reposRes = await fetch(`https://api.github.com/users/${username}/repos?sort=stars&per_page=6&direction=desc`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });
  let projects = [];
  if (reposRes.ok) {
    const repos = await reposRes.json();
    projects = repos.map(repo => ({
      name: repo.name,
      description: repo.description || '',
      language: repo.language || '',
      stars: repo.stargazers_count || 0,
      url: repo.html_url
    }));
  }
  return {
    bio: profile.bio || '',
    profileUrl: profile.html_url,
    avatar: profile.avatar_url,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    projects
  };
}

async function transcribeAudioWithGemini(audioBase64, mimeType) {
  await loadApiKeys();
  if (activeGeminiKeys.length === 0) {
    throw new Error("No Gemini API key configured for transcription fallback.");
  }

  const raw = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  let lastError = "Unknown Gemini transcription error";

  for (const key of activeGeminiKeys) {
    for (const modelName of GEMINI_MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const payload = {
        contents: [{
          parts: [
            { text: "Transcribe this audio. Return only the spoken text without metadata." },
            { inline_data: { mime_type: mimeType || 'audio/webm', data: raw } }
          ]
        }]
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const errText = await response.text();
          lastError = `Gemini STT Error: ${response.status} - ${errText}`;
          continue;
        }

        const data = await response.json();
        const text = (data?.candidates?.[0]?.content?.parts || [])
          .map(part => part.text || '')
          .join('\n')
          .trim();
        if (text) return text;
        lastError = "Gemini STT returned empty text.";
      } catch (e) {
        lastError = e.message || "Gemini STT request failed.";
      }
    }
  }

  throw new Error(lastError);
}

async function transcribeAudio(audioBase64, mimeType) {
  await loadAllKeys();
  const raw = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const errors = [];

  if (elevenLabsKey) {
    try {
      const byteString = atob(raw);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
      const blob = new Blob([ab], { type: mimeType || 'audio/webm' });

      const formData = new FormData();
      formData.append('audio', blob, 'recording.webm');
      formData.append('model_id', 'scribe_v1');

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': elevenLabsKey },
        body: formData
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`ElevenLabs Error: ${response.status} - ${errText}`);
      }
      const data = await response.json();
      const text = (data.text || '').trim();
      if (text) return text;
      throw new Error("ElevenLabs returned empty transcription.");
    } catch (e) {
      errors.push(e.message || "ElevenLabs transcription failed.");
    }
  } else {
    errors.push("NO_ELEVENLABS_KEY");
  }

  try {
    return await transcribeAudioWithGemini(audioBase64, mimeType || 'audio/webm');
  } catch (e) {
    errors.push(e.message || "Gemini transcription failed.");
  }

  throw new Error(`Voice transcription failed. ${errors.join(' | ')}`);
}

async function parseSkillsFromText(text) {
  const prompt = `Extract technical skills (array of strings) from: "${text}". Return ONLY JSON array.`;
  const result = await askLLM(prompt);
  try {
    const match = result.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (e) {
    return text.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 1);
  }
}

async function searchATSKeywords(jobTitle, company) {
  try {
    await loadAllKeys();
    if (!tavilyKey) return [];
    const normalizedCompany = (company || '').trim();
    const queries = [
      `${jobTitle} ATS resume keywords 2026`,
      normalizedCompany ? `${normalizedCompany} ${jobTitle} hiring skills` : `${jobTitle} hiring skills 2026`
    ];

    const tavilySearch = async (query, timeoutMs = 4500) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            max_results: 3
          }),
          signal: controller.signal
        });

        if (!res.ok) return '';
        const data = await res.json();
        return (data.results || [])
          .map(r => [r.title, r.content].filter(Boolean).join(': '))
          .join('\n');
      } catch (e) {
        return '';
      } finally {
        clearTimeout(timeoutId);
      }
    };

    // Run both queries in parallel and tolerate one failing/timing out.
    const settled = await Promise.allSettled(queries.map(q => tavilySearch(q)));
    const snippets = settled
      .filter(entry => entry.status === 'fulfilled')
      .map(entry => entry.value || '')
      .filter(Boolean);

    const allSnippets = snippets.join('\n').trim();
    if (!allSnippets) return [];

    const result = await askLLM(
      `From the web snippets below, extract the top 10 ATS keywords for the "${jobTitle}" role as a JSON array of strings only.\n\n` +
      allSnippets.substring(0, 3500)
    );
    const match = result.match(/\[[\s\S]*?\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch (e) {
    return [];
  }
}
