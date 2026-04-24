// Reasoning Card - Display AI reasoning and explanations

export function createReasoningCard(title, reasoning, metadata = {}) {
  const card = document.createElement('div');
  card.className = 'reasoning-card';

  const contentHtml = Array.isArray(reasoning) 
    ? reasoning.map(r => `<p>${escapeHtml(r)}</p>`).join('')
    : `<p>${escapeHtml(reasoning)}</p>`;

  card.innerHTML = `
    <div class="reasoning-header">
      <h4>🧠 ${title}</h4>
      <button class="reasoning-toggle">−</button>
    </div>

    <div class="reasoning-content">
      ${contentHtml}

      ${metadata.confidence ? `
        <div class="metadata">
          <span class="confidence-badge">
            Confidence: ${Math.round(metadata.confidence * 100)}%
          </span>
        </div>
      ` : ''}

      ${metadata.sources && metadata.sources.length > 0 ? `
        <div class="sources">
          <h5>Sources</h5>
          <ul>
            ${metadata.sources.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}

      ${metadata.alternatives && metadata.alternatives.length > 0 ? `
        <div class="alternatives">
          <h5>Alternatives considered</h5>
          <ul>
            ${metadata.alternatives.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;

  // Toggle expand/collapse
  let isExpanded = true;
  card.querySelector('.reasoning-toggle').addEventListener('click', () => {
    isExpanded = !isExpanded;
    const content = card.querySelector('.reasoning-content');
    const toggle = card.querySelector('.reasoning-toggle');
    
    if (isExpanded) {
      content.style.display = 'block';
      toggle.textContent = '−';
    } else {
      content.style.display = 'none';
      toggle.textContent = '+';
    }
  });

  return card;
}

/**
 * Create a card showing reasoning steps
 */
export function createReasoningSteps(steps) {
  const container = document.createElement('div');
  container.className = 'reasoning-steps';

  steps.forEach((step, index) => {
    const stepEl = document.createElement('div');
    stepEl.className = 'reasoning-step';
    stepEl.innerHTML = `
      <div class="step-number">${index + 1}</div>
      <div class="step-content">
        <h5>${escapeHtml(step.title)}</h5>
        <p>${escapeHtml(step.description)}</p>
      </div>
    `;
    container.appendChild(stepEl);
  });

  return container;
}

/**
 * Display confidence/certainty level
 */
export function createConfidenceIndicator(level) {
  // level: 0-1
  const percentage = Math.round(level * 100);
  const color = level > 0.7 ? '#28A745' : level > 0.4 ? '#FFC107' : '#DC3545';

  return `
    <div class="confidence-indicator">
      <div class="confidence-bar" style="width: ${percentage}%; background-color: ${color};"></div>
      <span class="confidence-text">${percentage}% confident</span>
    </div>
  `;
}

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}
