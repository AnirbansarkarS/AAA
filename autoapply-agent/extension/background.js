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

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received Message", request);
  
  if (request.action === 'CALL_LLM') {
    askLLM(request.prompt)
      .then(response => sendResponse({ success: true, text: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Indicates asynchronous response
  }
  
  if (request.action === 'CRAFT_ON_PAGE_ANSWERS') {
      const { text, fields, profileData } = request.data;
      generateAnswers(text, fields, profileData)
        .then(response => sendResponse({ success: true, answers: response}))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

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
 * Answer Crafter logic in background
 */
async function generateAnswers(pageContext, fieldsToFill, userProfile) {
    const prompt = `
    You are an AI Job Assistant helping a candidate fill forms. 
    Here is their profile: ${JSON.stringify(userProfile)}
    Here is the job context text from the page: ${pageContext.substring(0, 1000)}
    
    The user needs to answer these fields: 
    ${fieldsToFill.map(f => f.label).join(", ")}
    
    For each field, generate 2-3 smart answers variations to choose from. Format as JSON mapping field label to an array of answers.
    `;

    try {
      const ans = await askLLM(prompt);
      const jsonMatch = ans.match(/```json\n([\s\S]*)\n```/) || ans.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1] || jsonMatch[0]);
      }
      // If it didn't return JSON, try wrap it in the expected format
      return { "Answer": [ans] };
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
