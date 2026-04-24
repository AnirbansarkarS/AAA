// Intent Selector - Mode picker (🏆💰🚀🤝)

export const MODES = {
  trophy: {
    emoji: '🏆',
    name: 'Achievement Mode',
    description: 'Optimize for awards and recognition',
    color: '#FFD700',
    keywords: ['awards', 'recognition', 'achievement', 'honors', 'prestige'],
    focusAreas: ['prestigious_opportunities', 'award_eligibility', 'recognition'],
    tone: 'aspirational'
  },

  money: {
    emoji: '💰',
    name: 'Money Mode',
    description: 'Focus on financial opportunities',
    color: '#28A745',
    keywords: ['salary', 'compensation', 'revenue', 'payment', 'earnings'],
    focusAreas: ['salary_range', 'equity', 'bonus', 'financial_benefits'],
    tone: 'strategic'
  },

  rocket: {
    emoji: '🚀',
    name: 'Growth Mode',
    description: 'Emphasize speed and expansion',
    color: '#FF6B6B',
    keywords: ['growth', 'expansion', 'speed', 'scale', 'acceleration'],
    focusAreas: ['fast_growth', 'learning_opportunity', 'career_acceleration'],
    tone: 'energetic'
  },

  handshake: {
    emoji: '🤝',
    name: 'Network Mode',
    description: 'Build relationships and partnerships',
    color: '#4169E1',
    keywords: ['network', 'relationship', 'partnership', 'collaboration', 'community'],
    focusAreas: ['relationship_building', 'team_fit', 'culture_alignment'],
    tone: 'warm'
  }
};

/**
 * Create mode selector UI
 */
export function createModeSelector(onModeSelect) {
  const container = document.createElement('div');
  container.className = 'mode-selector';
  container.innerHTML = `
    <div class="modes-grid">
      ${Object.entries(MODES).map(([key, mode]) => `
        <button class="mode-card" data-mode="${key}" title="${mode.name}">
          <div class="mode-emoji">${mode.emoji}</div>
          <div class="mode-name">${mode.name.split(' ')[0]}</div>
          <div class="mode-desc">${mode.description}</div>
        </button>
      `).join('')}
    </div>
  `;

  container.addEventListener('click', (e) => {
    const modeCard = e.target.closest('.mode-card');
    if (modeCard) {
      const mode = modeCard.dataset.mode;
      container.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
      modeCard.classList.add('active');
      onModeSelect(mode);
    }
  });

  return container;
}

/**
 * Get mode configuration
 */
export function getModeConfig(mode) {
  return MODES[mode] || MODES.handshake;
}

/**
 * Apply mode to analysis/generation
 */
export function applyModeContext(mode, data) {
  const config = getModeConfig(mode);

  return {
    ...data,
    mode,
    focusAreas: config.focusAreas,
    tone: config.tone,
    priorityKeywords: config.keywords
  };
}
