// content.js - Injected into pages
console.log("AutoApply Agent: Content script loaded");

// 1. DOM Field Detector
class FieldDetector {
  constructor() {
    this.targetKeywords = ["why", "describe", "tell us", "cover letter", "summary"];
  }

  // Look for inputs, textareas, and their associated labels
  scanForFields() {
    const textareas = document.querySelectorAll('textarea');
    const inputs = document.querySelectorAll('input[type="text"]');
    
    const detectedFields = [];

    [...textareas, ...inputs].forEach(field => {
      let labelText = this.getLabelText(field).toLowerCase();
      
      if (!field.id && !field.name) {
        field.id = 'autoapply-field-' + Math.random().toString(36).substring(7);
      }

      // Check if it's an interesting field based on keywords
      const isInteresting = this.targetKeywords.some(kw => labelText.includes(kw));
      
      if (isInteresting || field.tagName.toLowerCase() === 'textarea') {
        detectedFields.push({
          id: field.id || field.name,
          type: field.tagName.toLowerCase(),
          label: labelText,
          element: field
        });
      }
    });

    console.log("AutoApply Agent - Detected Fields:", detectedFields);
    return detectedFields;
  }

  getLabelText(field) {
    if (field.labels && field.labels.length > 0) {
      return field.labels[0].innerText;
    }
    
    if (field.id) {
      let label = document.querySelector(`label[for="${field.id}"]`);
      if (label) return label.innerText;
    }
    
    return field.placeholder || field.name || 'Unknown Field';
  }
  
  // 2. Page Text Extraction
  extractPageContext() {
    // Basic extraction of visible text for context reasoning
    return document.body.innerText.substring(0, 5000); // Send up to 5000 chars to avoid huge payloads
  }
}

const detector = new FieldDetector();

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'SCAN_FIELDS') {
    const fields = detector.scanForFields();
    // Return serializable data (no DOM elements)
    sendResponse(fields.map(f => ({ id: f.id, type: f.type, label: f.label })));
  } else if (request.action === 'GET_PAGE_CONTEXT') {
    sendResponse({ text: detector.extractPageContext() });
  } else if (request.action === 'FILL_FIELD') {
    const { fieldId, text } = request;
    const el = document.getElementById(fieldId) || document.getElementsByName(fieldId)[0];
    if (el) {
      el.value = text;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Field not found' });
    }
  }
  return true; // Keep channel open for async response
});
