// content.js - Injected into pages
console.log("AutoApply Agent: Content script loaded");

if (typeof window.AutoApplyDetector === 'undefined') {
  window.AutoApplyDetector = class FieldDetector {
    constructor() {
      this.subjectiveKeywords = ["why", "describe", "tell us", "cover letter", "summary"];
    }

    scanForFields() {
      const textareas = document.querySelectorAll('textarea');
      const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="url"]');
      
      const detectedFields = [];

      [...textareas, ...inputs].forEach(field => {
        // Skip hidden or readonly fields
        if (field.type === 'hidden' || field.readOnly || field.disabled || field.style.display === 'none') {
          return;
        }

        let labelText = this.getLabelText(field).toLowerCase();
        
        if (!field.id && !field.name) {
          field.id = 'autoapply-field-' + Math.random().toString(36).substring(7);
        }

        const isSubjective = this.subjectiveKeywords.some(kw => labelText.includes(kw)) || field.tagName.toLowerCase() === 'textarea';

        detectedFields.push({
          id: field.id || field.name,
          tagName: field.tagName.toLowerCase(),
          inputType: field.type || 'textarea',
          label: labelText,
          isSubjective: isSubjective,
          element: field
        });
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
    
    extractPageContext() {
      return document.body.innerText.substring(0, 5000);
    }
  }

  const detector = new window.AutoApplyDetector();

  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCAN_FIELDS') {
      const fields = detector.scanForFields();
      sendResponse(fields.map(f => ({ id: f.id, tagName: f.tagName, inputType: f.inputType, label: f.label, isSubjective: f.isSubjective })));
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
    return true;
  });
}
