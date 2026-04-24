// Sidebar UI Logic

const TAB_CONFIG = {
  analysis: '#analysis-tab',
  answer: '#answer-tab',
  history: '#history-tab'
};

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const tabName = e.target.dataset.tab;
    switchTab(tabName);
  });
});

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
  document.querySelector(TAB_CONFIG[tabName]).classList.add('active');
}

// Close button
document.getElementById('closeSidebar').addEventListener('click', () => {
  const sidebar = document.getElementById('autoapply-sidebar-root');
  if (sidebar) {
    sidebar.style.display = 'none';
  }
});

// Get page context and analyze
async function initializeSidebar() {
  const spinner = document.getElementById('analysisSpinner');
  spinner.style.display = 'block';

  const background = chrome.runtime.getBackgroundPage();
  
  // Get page context
  const context = {
    url: window.location.href,
    title: document.title,
    formFields: detectPageFields(),
    bodyText: document.body.innerText.substring(0, 2000)
  };

  // Run analysis
  try {
    const result = await background.orchestrator.analyzePage(context);
    spinner.style.display = 'none';
    displayAnalysisResult(result);
  } catch (error) {
    spinner.style.display = 'none';
    document.getElementById('analysisResult').innerHTML = `
      <div class="error">Error: ${error.message}</div>
    `;
  }
}

function detectPageFields() {
  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, select');
  
  inputs.forEach((field, index) => {
    if (field.offsetParent !== null) {
      fields.push({
        id: field.id || `field-${index}`,
        name: field.name || field.placeholder || `field-${index}`,
        type: field.type || field.tagName.toLowerCase()
      });
    }
  });

  return fields;
}

function displayAnalysisResult(result) {
  const resultDiv = document.getElementById('analysisResult');
  resultDiv.innerHTML = `
    <div class="analysis-card">
      <h4>Page Analysis</h4>
      <div class="reasoning-card">
        <h5>Reasoning</h5>
        <p>${result.reasoning || 'Analysis in progress...'}</p>
      </div>
      <div class="relevance-score">
        <span>Relevance Score:</span>
        <div class="score-bar">
          <div class="score-fill" style="width: ${(result.relevance || 0) * 100}%"></div>
        </div>
        <span>${Math.round((result.relevance || 0) * 100)}%</span>
      </div>
    </div>
  `;
}

// Initialize on load
window.addEventListener('load', initializeSidebar);
