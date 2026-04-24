// Popup UI Logic

const modes = {
  trophy: { name: 'Achievement Mode', description: 'Optimize for awards and recognition' },
  money: { name: 'Earnings Mode', description: 'Maximize financial opportunities' },
  rocket: { name: 'Growth Mode', description: 'Accelerate progress and expansion' },
  handshake: { name: 'Network Mode', description: 'Build relationships and partnerships' }
};

let selectedMode = null;

// Mode button handlers
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
    selectedMode = e.target.dataset.mode;
    updateMainPanel(selectedMode);
  });
});

function updateMainPanel(mode) {
  const panel = document.getElementById('mainPanel');
  const modeInfo = modes[mode];
  
  panel.innerHTML = `
    <div class="mode-content">
      <h2>${modeInfo.name}</h2>
      <p>${modeInfo.description}</p>
      <button id="analyzeBtn" class="primary-btn">Analyze Page</button>
      <button id="injectSidebarBtn" class="secondary-btn">Open Sidebar</button>
    </div>
  `;

  document.getElementById('analyzeBtn').addEventListener('click', analyzePage);
  document.getElementById('injectSidebarBtn').addEventListener('click', injectSidebar);
}

async function analyzePage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'getPageContext' }, (context) => {
    if (chrome.runtime.lastError) {
      alert('Could not analyze page');
      return;
    }

    const background = chrome.runtime.getBackgroundPage();
    background.orchestrator.analyzePage(context, selectedMode).then(result => {
      console.log('Analysis result:', result);
      updateStatus('Analysis complete');
    });
  });
}

async function injectSidebar() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  chrome.tabs.sendMessage(tab.id, { action: 'injectSidebar' }, (response) => {
    if (response && response.success) {
      updateStatus('Sidebar injected');
      window.close();
    }
  });
}

function updateStatus(msg) {
  document.getElementById('status').textContent = msg;
  setTimeout(() => {
    document.getElementById('status').textContent = 'Ready';
  }, 3000);
}

// Settings and Help
document.getElementById('settingsBtn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage?.();
});

document.getElementById('helpBtn').addEventListener('click', () => {
  alert('AutoApply Agent\n\n' +
    '🏆 Trophy: Awards & recognition\n' +
    '💰 Money: Financial opportunities\n' +
    '🚀 Rocket: Growth & expansion\n' +
    '🤝 Handshake: Relationships\n\n' +
    'Select a mode and click "Analyze Page" to start.');
});
