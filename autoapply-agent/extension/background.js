// Service Worker - Main background process
// Initializes memory and routes incoming messages to orchestrator

import { initMemory } from '../memory/storage.js';
import { Orchestrator } from '../core/orchestrator.js';

let orchestrator = null;

// Initialize on service worker startup
chrome.runtime.onInstalled.addListener(async () => {
  await initMemory();
  orchestrator = new Orchestrator();
  console.log('AutoApply Agent initialized');
});

// Listen for messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'analyze') {
    orchestrator.analyzePage(request.pageContext).then(response => {
      sendResponse(response);
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'generateAnswer') {
    orchestrator.generateAnswer(request.query, request.context).then(response => {
      sendResponse(response);
    });
    return true;
  }

  if (request.action === 'composeOutreach') {
    orchestrator.composeOutreach(request.data).then(response => {
      sendResponse(response);
    });
    return true;
  }
});

// Expose orchestrator for popup/sidebar access
globalThis.orchestrator = orchestrator;
