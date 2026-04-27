document.addEventListener('DOMContentLoaded', () => {
  // Load existing profile if any
  chrome.storage.local.get(['userProfile'], (result) => {
    if (result.userProfile) {
      const p = result.userProfile;
      document.getElementById('pName').value = p.name || '';
      document.getElementById('pSkills').value = p.skills || '';
      document.getElementById('pProject').value = p.project || '';
      document.getElementById('pGoal').value = p.goal || '';
      document.getElementById('pTone').value = p.tone || 'Professional & concise';
    }
  });

  // Handle save
  document.querySelector('form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const userProfile = {
      name: document.getElementById('pName').value,
      skills: document.getElementById('pSkills').value,
      project: document.getElementById('pProject').value,
      goal: document.getElementById('pGoal').value,
      tone: document.getElementById('pTone').value
    };

    chrome.storage.local.set({ userProfile }, () => {
      alert("? Profile Saved to chrome.storage!");
      // Close the tab if it's the active onboarding tab
      chrome.tabs.getCurrent((tab) => {
        if (tab && tab.url.includes('onboarding.html')) {
          chrome.tabs.remove(tab.id);
        }
      });
    });
  });
});
