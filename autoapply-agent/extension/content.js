// Content Script - Runs in page context
// Detects form fields and injects sidebar

const SIDEBAR_ID = 'autoapply-sidebar-root';

// Detect form fields on the page
function detectFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, select');
  
  inputs.forEach((field, index) => {
    if (field.offsetParent !== null) { // Only visible fields
      fields.push({
        id: field.id || `field-${index}`,
        name: field.name || field.placeholder || `field-${index}`,
        type: field.type || field.tagName.toLowerCase(),
        value: field.value,
        placeholder: field.placeholder
      });
    }
  });

  return fields;
}

// Inject sidebar into DOM
function injectSidebar() {
  if (document.getElementById(SIDEBAR_ID)) {
    return; // Already injected
  }

  const sidebarRoot = document.createElement('div');
  sidebarRoot.id = SIDEBAR_ID;
  sidebarRoot.style.cssText = `
    position: fixed;
    right: 0;
    top: 0;
    width: 400px;
    height: 100vh;
    background: white;
    border-left: 1px solid #ccc;
    z-index: 999999;
    box-shadow: -2px 0 5px rgba(0,0,0,0.1);
    overflow-y: auto;
  `;

  document.body.appendChild(sidebarRoot);

  // Load sidebar HTML
  fetch(chrome.runtime.getURL('sidebar/sidebar.html'))
    .then(r => r.text())
    .then(html => {
      sidebarRoot.innerHTML = html;
      // Load sidebar script
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('sidebar/sidebar.js');
      script.type = 'module';
      document.body.appendChild(script);
    });
}

// Listen for popup trigger
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'injectSidebar') {
    injectSidebar();
    sendResponse({ success: true });
  }

  if (request.action === 'getPageContext') {
    const context = {
      url: window.location.href,
      title: document.title,
      formFields: detectFormFields(),
      bodyText: document.body.innerText.substring(0, 2000)
    };
    sendResponse(context);
  }
});

// Auto-inject sidebar on page load if enabled in settings
document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.local.get(['autoInjectSidebar']);
  if (settings.autoInjectSidebar) {
    injectSidebar();
  }
});
