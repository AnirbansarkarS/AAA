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
  "gemini-1.5-flash-8b"
];

/**
 * Loads API keys from the local .env file.
 * In a Manifest V3 extension, we can fetch local files included in the extension directory.
 */
async function loadApiKeys() {
  if (activeGeminiKeys.length > 0 || activeGroqKeys.length > 0) return;

  try {
    const response = await fetch(chrome.runtime.getURL('.env'));
    if (!response.ok) throw new Error("Could not find .env file");

    const envText = await response.text();

    // Parse .env to extract keys
    const lines = envText.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Ignore comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      const parts = trimmed.split('=');
      const key = parts[0];
      const value = parts.slice(1).join('='); // Rejoin in case value contains '='
      const parsedValue = value ? value.trim() : "";

      if (key && parsedValue && !parsedValue.includes("replace_with_actual_key")) {
        if (key.toUpperCase().includes("GROQ")) {
          activeGroqKeys.push(parsedValue);
        } else if (key.toUpperCase().includes("OPENROUTER")) {
          activeOpenRouterKeys.push(parsedValue);
        } else if (key.toUpperCase().includes("GEMINI") || parsedValue.startsWith("AIza")) {
          activeGeminiKeys.push(parsedValue);
        }
      }
    }
  } catch (error) {
    console.warn("Failed to load .env file, mapping to fallback", error);
  }
}

// State for LinkedIn import flow
let linkedinImportTabId = null;

// Cache for keys and loading state
let keysLoaded = false;
let elevenLabsKey = '';
let tavilyKey = '';

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
    }
    keysLoaded = true;
  } catch (e) {
    console.warn("Failed to load extra API keys", e);
    keysLoaded = true;
  }
}

// Listen for messages from content scripts or popup
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
      .then(extracted => sendResponse({ success: true, data: extracted }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // === Feature 1: LinkedIn Import ===
  if (request.action === 'IMPORT_LINKEDIN') {
    chrome.tabs.create({ url: 'https://www.linkedin.com/in/me', active: true }, (tab) => {
      linkedinImportTabId = tab.id;
      sendResponse({ success: true, message: 'Opening LinkedIn profile...' });
    });
    return true;
  }

  if (request.action === 'LINKEDIN_DATA_SCRAPED') {
    const data = request.data || {};
    // Merge into vault
    chrome.storage.local.get(['user_vault'], (res) => {
      let vault = res.user_vault || {};

      // Merge LinkedIn fields
      if (data.fullName) vault.fullName = vault.fullName || data.fullName;
      if (data.linkedinHeadline) vault.linkedinHeadline = data.linkedinHeadline;
      if (data.linkedinAbout) vault.linkedinAbout = data.linkedinAbout;
      if (data.city) vault.city = vault.city || data.city;
      if (data.linkedinURL) vault.linkedinURL = data.linkedinURL;
      if (data.linkedinSkills && data.linkedinSkills.length > 0) {
        // Merge skills with existing
        const existingSkills = vault.skills || [];
        const merged = [...new Set([...existingSkills, ...data.linkedinSkills])];
        vault.skills = merged;
        vault.linkedinSkills = data.linkedinSkills;
      }
      if (data.linkedinExperience) vault.linkedinExperience = data.linkedinExperience;
      if (data.linkedinEducation) vault.linkedinEducation = data.linkedinEducation;

      // Track source
      if (!vault.sources) vault.sources = [];
      if (!vault.sources.includes('linkedin')) vault.sources.push('linkedin');

      chrome.storage.local.set({ user_vault: vault }, () => {
        console.log("[AutoApply] LinkedIn data merged into vault:", vault);

        // Close the LinkedIn tab if we opened it
        if (linkedinImportTabId && sender?.tab?.id === linkedinImportTabId) {
          chrome.tabs.remove(linkedinImportTabId);
          linkedinImportTabId = null;
        }

        // Notify popup that import is done
        chrome.runtime.sendMessage({ action: 'LINKEDIN_IMPORT_DONE', data: vault });
      });
    });
    sendResponse({ success: true });
    return true;
  }

  // === Feature 1: GitHub Import ===
  if (request.action === 'FETCH_GITHUB') {
    const username = request.username;
    if (!username) {
      sendResponse({ success: false, error: 'No GitHub username provided' });
      return true;
    }

    fetchGitHubData(username)
      .then(ghData => {
        // Merge into vault
        chrome.storage.local.get(['user_vault'], (res) => {
          let vault = res.user_vault || {};
          vault.githubUsername = username;
          vault.githubBio = ghData.bio || '';
          vault.githubURL = ghData.profileUrl || vault.githubURL || '';
          vault.githubProjects = ghData.projects || [];

          // Merge GitHub languages as skills
          const ghSkills = ghData.projects.map(p => p.language).filter(Boolean);
          const existingSkills = vault.skills || [];
          vault.skills = [...new Set([...existingSkills, ...ghSkills])];

          if (!vault.sources) vault.sources = [];
          if (!vault.sources.includes('github')) vault.sources.push('github');

          chrome.storage.local.set({ user_vault: vault }, () => {
            console.log("[AutoApply] GitHub data merged into vault:", vault);
            sendResponse({ success: true, data: ghData });
          });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // === Feature 2: Voice Transcription ===
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
      .then(skills => {
        // Merge into vault
        chrome.storage.local.get(['user_vault'], (res) => {
          let vault = res.user_vault || {};
          const existingSkills = vault.skills || [];
          vault.skills = [...new Set([...existingSkills, ...skills])];

          if (!vault.sources) vault.sources = [];
          if (!vault.sources.includes('voice-input')) vault.sources.push('voice-input');

          chrome.storage.local.set({ user_vault: vault }, () => {
            sendResponse({ success: true, skills: vault.skills });
          });
        });
      })
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  // === Feature 3: ATS Keywords Search ===
  if (request.action === 'SEARCH_ATS_KEYWORDS') {
    const { jobTitle, company } = request;
    searchATSKeywords(jobTitle, company)
      .then(keywords => sendResponse({ success: true, keywords }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

async function extractFromDocument(base64Data, mimeType, docType) {
  await loadApiKeys();
  if (activeGeminiKeys.length === 0) {
    throw new Error("No Gemini keys configured for document parsing.");
  }

  // Strip the Data URL prefix (e.g., "data:image/jpeg;base64,") so we only send the raw base64 encoded string
  const rawBase64 = base64Data.split(',')[1] || base64Data;

  const prompts = {
    resume: `Extract ALL information from this resume. Return a JSON object with these exact keys where found: fullName, email, phone, linkedinURL, githubURL, portfolioURL, ugCollege, ugDegree, ugCGPA, ugYear, skills (array), certifications (array), projects (array of {name, description, tech}), experience (array of {company, role, duration, description}). Only include fields that are actually present. No null values.`,
    aadhaar: `Extract from this Aadhaar card: fullName, dob (DD/MM/YYYY format), gender, addressLine1, city, state, pincode. Also extract aadhaarLast4 (last 4 digits of the Aadhaar number only — do not extract or store the full number). Return JSON only.`,
    pan: `Extract from this PAN card: fullName, panNumber, dob (DD/MM/YYYY). Return JSON only.`,
    marksheet: `Extract: institutionName (map to ugCollege or twelfthCollege based on context), degree or standard, percentage or CGPA, year of passing, subjects if listed. Return JSON only.`,
    offer_letter: `Extract from this offer letter: companyName, role, ctc, joiningDate, location. Return JSON only.`,
    unknown: `This is a document. Extract every piece of personal/professional information you can find that would be useful for filling forms. Return as a flat JSON object with descriptive key names.`
  };


  const prompt = prompts[docType] || prompts.unknown;
  const currentKey = activeGeminiKeys[0]; // Simplest approach for extraction
  // using gemini-1.5-flash as it supports vision and pdf well natively.
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${currentKey}`;

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: mimeType, data: rawBase64 } },
        { text: prompt + "\n\nReturn ONLY valid JSON format. Start your response strictly with `{` and end with `}`. No markdown code blocks." }
      ]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  try {
    return JSON.parse(text.replace(/```json|```/gi, "").trim());
  } catch (e) {
    console.error("Extraction Parsing Failed:", e, text);
    throw new Error("Resulting format couldn't be parsed into JSON");
  }
}

async function callGroqAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeGroqKeys.length;
  let lastErrorMessage = "Unknown Groq error";

  while (attempts < maxAttempts) {
    const currentKey = activeGroqKeys[currentGroqKeyIndex];
    if (!currentKey) {
      throw new Error("Missing valid Groq API Key");
    }

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

          if (response.status === 404) continue; // Try next model

          if (response.status === 429) {
            console.warn(`[Groq Rate Limit] Switching to next key.`);
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
        console.error(`[Error] Groq failed.`, error);
        currentGroqKeyIndex = (currentGroqKeyIndex + 1) % activeGroqKeys.length;
        attempts++;
        break;
      }
    }
  }
  throw new Error(lastErrorMessage);
}

/**
 * Background service worker calling Gemini API with 429 Retry Logic
 */
async function callGeminiAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeGeminiKeys.length; // rotate keys on rate-limit/network issues
  let lastErrorMessage = "Unknown Gemini error";

  while (attempts < maxAttempts) {
    const currentKey = activeGeminiKeys[currentGeminiKeyIndex];
    if (!currentKey) {
      throw new Error("Missing valid Gemini API Key");
    }

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

          // If model is unavailable, try next model with same key
          if (response.status === 404) {
            console.warn(`[Model Fallback] ${modelName} unavailable for this key/version. Trying next model.`);
            continue;
          }

          // If key is rate limited, rotate key immediately
          if (response.status === 429) {
            console.warn(`[Rate Limit] Key at index ${currentGeminiKeyIndex} returned 429. Switching to next key.`);
            currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
            attempts++;
            break;
          }

          // For 401/403/400 etc., rotate key and retry loop
          currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
          attempts++;
          break;
        }

        const data = await response.json();
        return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      } catch (error) {
        lastErrorMessage = error.message || "Network error while calling Gemini";
        console.error(`[Error] Request failed on key index ${currentGeminiKeyIndex}, model ${modelName}.`, error);
        currentGeminiKeyIndex = (currentGeminiKeyIndex + 1) % activeGeminiKeys.length;
        attempts++;
        break;
      }
    }
  }

  throw new Error(lastErrorMessage);
}

/**
 * Background service worker calling OpenRouter API with Retry Logic
 */
async function callOpenRouterAPI(promptText) {
  let attempts = 0;
  const maxAttempts = activeOpenRouterKeys.length;
  let lastErrorMessage = "Unknown OpenRouter error";

  while (attempts < maxAttempts) {
    const currentKey = activeOpenRouterKeys[currentOpenRouterKeyIndex];
    if (!currentKey) {
      throw new Error("Missing valid OpenRouter API Key");
    }

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
            console.warn(`[OpenRouter Rate Limit] Switching to next key.`);
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
        console.error(`[Error] OpenRouter failed.`, error);
        currentOpenRouterKeyIndex = (currentOpenRouterKeyIndex + 1) % activeOpenRouterKeys.length;
        attempts++;
        break;
      }
    }
  }
  throw new Error(lastErrorMessage);
}

/**
 * Orchestrator: Try Groq first, fallback to OpenRouter, then fallback to Gemini
 */
async function askLLM(promptText) {
  await loadApiKeys();

  let errors = [];

  // 1) Try Groq if there are keys
  if (activeGroqKeys.length > 0) {
    try {
      console.log("Attempting to craft answers with Groq...");
      const result = await callGroqAPI(promptText);
      if (result) return result;
    } catch (e) {
      console.warn("Groq failed. Will attempt OpenRouter fallback...", e);
      errors.push(`Groq Error: ${e.message}`);
    }
  } else {
    errors.push("No Groq keys configured.");
  }

  // 2) Try OpenRouter as Fallback
  if (activeOpenRouterKeys.length > 0) {
    try {
      console.log("Attempting to craft answers with OpenRouter...");
      const result = await callOpenRouterAPI(promptText);
      if (result) return result;
    } catch (e) {
      console.warn("OpenRouter failed. Will attempt Gemini fallback...", e);
      errors.push(`OpenRouter Error: ${e.message}`);
    }
  } else {
    errors.push("No OpenRouter keys configured for fallback.");
  }

  // 3) Try Gemini as final Fallback
  if (activeGeminiKeys.length > 0) {
    try {
      console.log("Attempting to craft answers with Gemini...");
      const result = await callGeminiAPI(promptText);
      if (result) return result;
    } catch (e) {
      console.error("Gemini failed.", e);
      errors.push(`Gemini Error: ${e.message}`);
    }
  } else {
    errors.push("No Gemini keys configured for fallback.");
  }

  throw new Error(`All LLM integrations failed. Details:\n` + errors.join('\n'));
}

/**
 * Answer Crafter logic in background — now with ATS keyword injection
 */
async function generateAnswers(pageContext, fieldsToFill, userProfile) {
  await loadAllKeys();

  // Get vault data for richer context
  const vaultData = await new Promise(resolve => {
    chrome.storage.local.get(['user_vault'], res => resolve(res.user_vault || {}));
  });

  // Extract job title and company from page context for ATS search
  const pageSnippet = pageContext.substring(0, 2000);
  let jobTitle = '';
  let company = '';
  const titleMatch = pageSnippet.match(/(?:position|role|job title|opening)[:\s]*([^\n,|]{3,60})/i);
  if (titleMatch) jobTitle = titleMatch[1].trim();
  const companyMatch = pageSnippet.match(/(?:at|company|employer|organization)[:\s]*([^\n,|]{3,50})/i);
  if (companyMatch) company = companyMatch[1].trim();

  // Search for ATS keywords
  let atsKeywords = [];
  if (jobTitle && tavilyKey) {
    try {
      atsKeywords = await searchATSKeywords(jobTitle, company);
      console.log("[AutoApply] ATS Keywords found:", atsKeywords);
    } catch (e) {
      console.warn("[AutoApply] ATS keyword search failed:", e);
    }
  }

  // Build enriched context
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
    ? `\n\nATS keywords to naturally weave in (use 2-3 per answer naturally, don't force all):\n[${atsKeywords.join(', ')}]`
    : '';

  const prompt = `
    You are an AI Job Assistant helping a candidate fill forms. 
    Here is their profile: ${JSON.stringify(enrichedProfile)}
    Here is the job context text from the page: ${pageSnippet.substring(0, 1000)}
    
    The user needs to answer these fields: 
    ${fieldsToFill.map(f => f.label).join(", ")}
    ${atsSection}
    
    For each field, generate 2-3 smart answer variations to choose from. Format as JSON mapping field label to an array of answers.
    `;

  try {
    const ans = await askLLM(prompt);
    const jsonMatch = ans.match(/```json\n([\s\S]*?)\n```/) || ans.match(/\{[\s\S]*\}/);
    let answers;
    if (jsonMatch) {
      try {
        answers = JSON.parse(jsonMatch[1] || jsonMatch[0]);
      } catch (parseError) {
        console.warn("JSON parse failed, falling back to raw answer:", parseError);
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


function buildLocalFallbackAnswers(fieldsToFill, userProfile, pageContext) {
  const profileName = userProfile?.name || "the candidate";
  const profileSkills = userProfile?.skills || "problem-solving, collaboration, and technical execution";
  const profileProject = userProfile?.project || "a recent production project";
  const profileGoal = userProfile?.goal || "to grow in a high-impact engineering role";
  const tone = userProfile?.tone || "Professional & concise";
  const companyHint = extractCompanyHint(pageContext);

  const answersByField = {};

  for (const field of fieldsToFill || []) {
    const label = field?.label || "application question";
    const labelLower = label.toLowerCase();

    if (labelLower.includes("why")) {
      answersByField[label] = [
        `I want to work at ${companyHint} because the role aligns with my strengths in ${profileSkills} and my goal ${profileGoal}. I enjoy ownership, fast learning cycles, and building products that users rely on.`,
        `${companyHint} stands out to me for its product focus and growth opportunity. In my recent work on ${profileProject}, I delivered measurable improvements and I’m excited to bring the same impact here.`,
        `This position is a strong fit for my background and direction. I bring hands-on execution in ${profileSkills}, and I’m motivated by teams where I can contribute quickly while continuing to level up.`
      ];
      continue;
    }

    if (labelLower.includes("describe") || labelLower.includes("project")) {
      answersByField[label] = [
        `One recent project I led was ${profileProject}. I handled planning, implementation, and delivery, focusing on clean architecture and maintainable code. The stack included tools aligned with my strengths in ${profileSkills}.`,
        `Recently, I built ${profileProject} end-to-end. I collaborated with stakeholders, shipped iterative improvements, and tracked outcomes to ensure the solution solved the right problem.`,
        `A project I’m proud of is ${profileProject}. I translated requirements into implementation, improved reliability, and documented the system so the team could scale development smoothly.`
      ];
      continue;
    }

    if (labelLower.includes("summary") || labelLower.includes("goal")) {
      answersByField[label] = [
        `My current goal is ${profileGoal}. I’m building depth in ${profileSkills} while improving leadership, communication, and product thinking.`,
        `I’m focused on roles where I can combine strong implementation with business impact. Long term, my goal is ${profileGoal} while mentoring others and owning meaningful projects.`,
        `Career-wise, I want to keep shipping high-quality work, expand my scope, and move toward ${profileGoal}. I value environments that reward execution, curiosity, and teamwork.`
      ];
      continue;
    }

    answersByField[label] = [
      `I’m ${profileName}, and my background in ${profileSkills} helps me approach this area with structure and measurable execution.`,
      `Based on my experience with ${profileProject}, I would answer this by highlighting practical impact, clear communication, and reliability.`,
      `My response would emphasize fit with the role, demonstrated outcomes, and my goal ${profileGoal}.`
    ];
  }

  return {
    __mode: "local-fallback",
    __note: `Gemini temporarily unavailable. Generated offline answers using your saved profile (${tone} style).`,
    answers: answersByField
  };
}

function extractCompanyHint(pageContext) {
  const text = (pageContext || "").replace(/\s+/g, " ").trim();
  if (!text) return "this company";

  const firstLine = text.split("|")[0].split(".")[0].trim();
  if (firstLine.length > 2 && firstLine.length < 80) {
    return firstLine;
  }

  const match = text.match(/([A-Z][a-zA-Z0-9& ]{2,40})(Inc\.|LLC|Ltd\.|Technologies|Tech)?/);
  return match ? match[0].trim() : "this company";
}

// ============================================================
// Feature 1: GitHub REST API Fetcher
// ============================================================
async function fetchGitHubData(username) {
  const profileRes = await fetch(`https://api.github.com/users/${username}`, {
    headers: { 'Accept': 'application/vnd.github.v3+json' }
  });

  if (!profileRes.ok) {
    throw new Error(`GitHub API error: ${profileRes.status} — user "${username}" not found`);
  }

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
    profileUrl: profile.html_url || `https://github.com/${username}`,
    avatar: profile.avatar_url || '',
    publicRepos: profile.public_repos || 0,
    followers: profile.followers || 0,
    projects
  };
}

// ============================================================
// Feature 2: ElevenLabs Speech-to-Text
// ============================================================
async function transcribeAudio(audioBase64, mimeType) {
  await loadAllKeys();

  if (!elevenLabsKey) {
    throw new Error('NO_ELEVENLABS_KEY');
  }

  // Convert base64 to blob
  const raw = audioBase64.includes(',') ? audioBase64.split(',')[1] : audioBase64;
  const byteString = atob(raw);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mimeType });

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
    throw new Error(`ElevenLabs STT Error: ${response.status} - ${errText}`);
  }

  const data = await response.json();
  return data.text || '';
}

/**
 * Use LLM to extract skill keywords from natural language text
 */
async function parseSkillsFromText(text) {
  await loadApiKeys();

  const prompt = `Extract specific technical skills, tools, frameworks, and programming languages mentioned in this text. Return as a JSON array of strings only, no explanation.

Text: "${text}"

Examples of valid skills: "React", "Docker", "Python", "Machine Learning", "AWS", "Node.js"
Return ONLY a JSON array like ["skill1", "skill2"]. No other text.`;

  const result = await askLLM(prompt);
  try {
    const match = result.match(/\[[\s\S]*\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (e) {
    console.warn("Failed to parse skills from LLM response:", result);
    return text.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 1 && s.length < 30);
  }
}

// ============================================================
// Feature 3: ATS Keyword Search via Tavily
// ============================================================
async function searchATSKeywords(jobTitle, company) {
  try {
    await loadAllKeys();

    if (!tavilyKey) {
      console.warn("[AutoApply] No Tavily API key — skipping ATS keyword search");
      return [];
    }

    const queries = [
      `${jobTitle} ATS resume keywords 2025`,
      company ? `${company} ${jobTitle} skills hiring managers look for` : `${jobTitle} must-have skills 2025`
    ];

    // Run searches in parallel with a timeout for the whole phase
    const searchPromise = Promise.all(queries.map(async (query) => {
      try {
        const res = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: query,
            max_results: 3,
            include_raw_content: false
          })
        });

        if (res.ok) {
          const data = await res.json();
          return (data.results || []).map(r => r.content || '').join('\n');
        }
      } catch (e) {
        console.warn(`[AutoApply] Tavily search failed for "${query}":`, e);
      }
      return '';
    }));

    // 5-second timeout for search phase
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve([]), 5000));
    const results = await Promise.race([searchPromise, timeoutPromise]);

    const allSnippets = results.join('\n').trim();
    if (!allSnippets) return [];

    // Extract keywords using LLM
    const extractPrompt = `From this text, extract the top 10 ATS keywords relevant to a "${jobTitle}" role. Return as a JSON array of strings only. No explanation.
Text: ${allSnippets.substring(0, 3000)}`;

    const result = await askLLM(extractPrompt);
    const match = result.match(/\[[\s\S]*?\]/);
    if (match) {
      return JSON.parse(match[0]);
    }
    return [];
  } catch (e) {
    console.warn("[AutoApply] searchATSKeywords encountered error:", e);
    return [];
  }
}

