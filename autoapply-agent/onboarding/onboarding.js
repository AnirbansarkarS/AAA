// Onboarding Flow Logic

import { updateProfile, updateSettings } from '../memory/storage.js';

const TOTAL_STEPS = 4;
let currentStep = 1;
let formData = {};
let selectedMode = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  initializeStepIndicator();
  attachFormListeners();
  attachButtonListeners();
  attachModeListeners();
  updateUI();
});

function initializeStepIndicator() {
  const indicator = document.getElementById('stepIndicator');
  for (let i = 1; i <= TOTAL_STEPS; i++) {
    const dot = document.createElement('div');
    dot.className = `step-dot ${i === 1 ? 'active' : ''}`;
    dot.addEventListener('click', () => goToStep(i));
    indicator.appendChild(dot);
  }
}

function attachFormListeners() {
  // Step 1: Basic Info
  document.getElementById('name').addEventListener('change', (e) => {
    formData.name = e.target.value;
  });

  document.getElementById('email').addEventListener('change', (e) => {
    formData.email = e.target.value;
  });

  document.getElementById('phone').addEventListener('change', (e) => {
    formData.phone = e.target.value;
  });

  // Step 2: Professional Info
  document.getElementById('title').addEventListener('change', (e) => {
    formData.title = e.target.value;
  });

  document.getElementById('company').addEventListener('change', (e) => {
    formData.company = e.target.value;
  });

  document.getElementById('yearsExp').addEventListener('change', (e) => {
    formData.yearsOfExperience = parseInt(e.target.value) || 0;
  });

  document.getElementById('skills').addEventListener('change', (e) => {
    formData.skills = e.target.value.split(',').map(s => s.trim()).filter(s => s);
  });

  // Step 3: Goals & Preferences
  document.getElementById('workStyle').addEventListener('change', (e) => {
    formData.workStyle = e.target.value;
  });

  document.getElementById('industries').addEventListener('change', (e) => {
    formData.interestedIndustries = e.target.value.split(',').map(i => i.trim()).filter(i => i);
  });

  document.getElementById('relocate').addEventListener('change', (e) => {
    formData.willing_to_relocate = e.target.checked;
  });

  // Goals checkboxes
  document.querySelectorAll('[id^="goal-"]').forEach(checkbox => {
    checkbox.addEventListener('change', () => {
      const goals = [];
      document.querySelectorAll('[id^="goal-"]:checked').forEach(cb => {
        goals.push(cb.value);
      });
      formData.goals = goals;
    });
  });

  // Step 4: Settings
  document.getElementById('autoInject').addEventListener('change', (e) => {
    formData.autoInjectSidebar = e.target.checked;
  });
}

function attachModeListeners() {
  document.querySelectorAll('.mode-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.mode-option').forEach(o => o.classList.remove('selected'));
      option.classList.add('selected');
      selectedMode = option.dataset.mode;
      formData.primaryMode = selectedMode;
    });
  });
}

function attachButtonListeners() {
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (currentStep > 1) {
      goToStep(currentStep - 1);
    }
  });

  document.getElementById('nextBtn').addEventListener('click', () => {
    if (currentStep < TOTAL_STEPS) {
      goToStep(currentStep + 1);
    } else {
      completeOnboarding();
    }
  });
}

function updateUI() {
  // Update step visibility
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  document.querySelector(`[data-step="${currentStep}"]`).classList.add('active');

  // Update progress bar
  const progress = (currentStep / TOTAL_STEPS) * 100;
  document.querySelector('.progress-fill').style.width = progress + '%';

  // Update step dots
  document.querySelectorAll('.step-dot').forEach((dot, index) => {
    dot.classList.toggle('active', index + 1 === currentStep);
  });

  // Update buttons
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  prevBtn.style.display = currentStep > 1 ? 'flex' : 'none';
  nextBtn.textContent = currentStep === TOTAL_STEPS ? 'Complete ✓' : 'Next →';
}

function goToStep(step) {
  if (step >= 1 && step <= TOTAL_STEPS) {
    currentStep = step;
    updateUI();
  }
}

async function completeOnboarding() {
  try {
    // Validate required fields
    if (!formData.name || !formData.email || !formData.title) {
      alert('Please fill in all required fields');
      goToStep(1);
      return;
    }

    // Show success message
    const successMsg = document.getElementById('successMsg');
    successMsg.style.display = 'block';

    // Save profile
    await updateProfile({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      title: formData.title,
      company: formData.company,
      yearsOfExperience: formData.yearsOfExperience || 0,
      skills: formData.skills || [],
      workStyle: formData.workStyle || 'hybrid',
      interestedIndustries: formData.interestedIndustries || [],
      willing_to_relocate: formData.willing_to_relocate || false,
      goals: formData.goals || [],
      onboarding_completed: true
    });

    // Save settings
    await updateSettings({
      autoInjectSidebar: formData.autoInjectSidebar ?? true,
      primaryMode: selectedMode || 'handshake'
    });

    // Wait a moment then redirect
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Close onboarding and open main extension
    window.close();
  } catch (error) {
    console.error('Onboarding error:', error);
    alert('Error saving profile: ' + error.message);
  }
}
