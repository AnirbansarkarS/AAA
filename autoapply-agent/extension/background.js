// background.js - Service Worker
const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY"; // Replace with actual key or load from settings

// Listen for messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("Background received Message", request);
  
  if (request.action === 'CALL_GEMINI') {
    callGeminiAPI(request.prompt)
      .then(response => sendResponse({ success: true, text: response }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    return true; // Indicates asynchronous response
  }
  
  if(request.action === 'CRAFT_ON_PAGE_ANSWERS') {
      const { text, fields, profileData } = request.data;
      generateAnswers(text, fields, profileData)
        .then(response => sendResponse({ success: true, answers: response}))
        .catch(error => sendResponse({ success: false, error }));
      return true;
  }
});

/**
 * 3. Background service worker calling Gemini API
 */
async function callGeminiAPI(promptText) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
     throw new Error("Missing Gemini API Key");
  }
  
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
  
  const payload = {
    contents: [{
      parts: [{ text: promptText }]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
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
    
    const ans = await callGeminiAPI(prompt);
    // basic parse of JSON inside response
    const jsonMatch = ans.match(/```json\n([\s\S]*)\n```/) || ans.match(/\{[\s\S]*\}/);
    if(jsonMatch) {
       return JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
    return ans;
}
