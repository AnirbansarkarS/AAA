// Storage Wrapper - Chrome Storage integration

import { DEFAULT_PROFILE, validateProfile } from './profileSchema.js';

const STORAGE_KEYS = {
  PROFILE: 'user_profile',
  HISTORY: 'app_history',
  SETTINGS: 'user_settings',
  API_KEY: 'gemini_api_key'
};

/**
 * Initialize memory/storage on first run
 */
export async function initMemory() {
  const stored = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);

  if (!stored[STORAGE_KEYS.PROFILE]) {
    // First run - create default profile
    await chrome.storage.local.set({
      [STORAGE_KEYS.PROFILE]: DEFAULT_PROFILE,
      [STORAGE_KEYS.HISTORY]: [],
      [STORAGE_KEYS.SETTINGS]: {
        autoInjectSidebar: false,
        analyticsEnabled: true,
        theme: 'light'
      }
    });
  }
}

/**
 * Get user profile
 */
export async function getProfile() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PROFILE);
  return result[STORAGE_KEYS.PROFILE] || DEFAULT_PROFILE;
}

/**
 * Update user profile
 */
export async function updateProfile(updates) {
  const profile = await getProfile();
  const updated = { ...profile, ...updates, updated_at: new Date().toISOString() };

  const validation = validateProfile(updated);
  if (!validation.valid) {
    throw new Error('Profile validation failed: ' + validation.errors.join(', '));
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.PROFILE]: updated
  });

  return updated;
}

/**
 * Get app history
 */
export async function getHistory() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.HISTORY);
  return result[STORAGE_KEYS.HISTORY] || [];
}

/**
 * Add entry to history
 */
export async function updateHistory(entry) {
  const history = await getHistory();
  history.push({
    ...entry,
    timestamp: new Date().toISOString()
  });

  // Keep only last 100 entries
  const trimmed = history.slice(-100);

  await chrome.storage.local.set({
    [STORAGE_KEYS.HISTORY]: trimmed
  });

  return trimmed;
}

/**
 * Get settings
 */
export async function getSettings() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
  return result[STORAGE_KEYS.SETTINGS] || {};
}

/**
 * Update settings
 */
export async function updateSettings(updates) {
  const settings = await getSettings();
  const updated = { ...settings, ...updates };

  await chrome.storage.local.set({
    [STORAGE_KEYS.SETTINGS]: updated
  });

  return updated;
}

/**
 * Store API key (encrypted in production)
 */
export async function setAPIKey(apiKey) {
  await chrome.storage.local.set({
    [STORAGE_KEYS.API_KEY]: apiKey
  });
}

/**
 * Get API key
 */
export async function getAPIKey() {
  const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEY);
  return result[STORAGE_KEYS.API_KEY] || null;
}

/**
 * Clear all data (for testing or reset)
 */
export async function clearAllData() {
  await chrome.storage.local.clear();
  await initMemory();
}
