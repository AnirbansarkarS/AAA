// memory/vault.js
// Personal Data Vault Schema & Storage Utils

const STORAGE_KEY = 'user_vault';

export const DEFAULT_VAULT = {
  // Identity
  fullName: "",
  email: "",
  phone: "",
  dob: "",              // "DD/MM/YYYY"
  gender: "",
  nationality: "Indian",

  // Government IDs (sensitive — store carefully)
  aadhaarLast4: "",     // NEVER store full Aadhaar
  panNumber: "",

  // Address
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  pincode: "",
  country: "India",

  // Education
  tenthSchool: "",
  tenthPercent: "",
  tenthYear: "",
  twelfthCollege: "",
  twelfthPercent: "",
  twelfthYear: "",
  ugCollege: "",
  ugDegree: "",
  ugCGPA: "",
  ugYear: "",
  pgCollege: "",
  pgDegree: "",
  pgCGPA: "",

  // Professional
  currentCompany: "",
  currentRole: "",
  currentCTC: "",
  expectedCTC: "",
  noticePeriod: "",
  totalExperience: "",

  // Online presence
  linkedinURL: "",
  githubURL: "",
  portfolioURL: "",

  // LinkedIn scraped data
  linkedinHeadline: "",
  linkedinAbout: "",
  linkedinExperience: [],  // ["Role | Company | Duration"]
  linkedinEducation: [],   // ["Degree | Institution"]
  linkedinSkills: [],

  // GitHub fetched data
  githubUsername: "",
  githubBio: "",
  githubProjects: [],      // [{ name, description, language, stars }]

  // From resume (richer data)
  skills: [],
  certifications: [],
  projects: [],         // [{ name, description, tech, link }]
  experience: [],       // [{ company, role, duration, bullets }]

  // Source tracking
  sources: []           // ["resume_2024.pdf", "aadhaar.jpg", "linkedin", "github"]

};

/**
 * Get the user's personal data vault
 */
export async function getVault() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      resolve({ ...DEFAULT_VAULT, ...(result[STORAGE_KEY] || {}) });
    });
  });
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map(item => (typeof item === 'string' ? item.trim() : item))
    .filter(item => item !== null && item !== undefined && item !== '');
}

function mergeUniqueArray(existing, incoming) {
  const base = normalizeArray(existing);
  const next = normalizeArray(incoming);
  const seen = new Set(base.map(item => (typeof item === 'object' ? JSON.stringify(item) : String(item).toLowerCase())));
  const merged = [...base];

  for (const item of next) {
    const key = typeof item === 'object' ? JSON.stringify(item) : String(item).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }
  return merged;
}

function mergeVaultData(currentVault, updates) {
  const merged = { ...currentVault };

  for (const [key, value] of Object.entries(updates || {})) {
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) continue;
      merged[key] = trimmed;
      continue;
    }

    if (Array.isArray(value)) {
      merged[key] = mergeUniqueArray(merged[key], value);
      continue;
    }

    if (typeof value === 'object') {
      const existingObj = (merged[key] && typeof merged[key] === 'object' && !Array.isArray(merged[key])) ? merged[key] : {};
      merged[key] = { ...existingObj, ...value };
      continue;
    }

    merged[key] = value;
  }

  return merged;
}

/**
 * Save updates to the personal data vault
 */
export async function saveToVault(updates, sources = []) {
  const currentVault = await getVault();
  const updatedVault = mergeVaultData(currentVault, updates);
  const sourceList = Array.isArray(sources) ? sources : [sources];
  updatedVault.sources = mergeUniqueArray(updatedVault.sources || [], sourceList);
  updatedVault.updatedAt = new Date().toISOString();

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: updatedVault }, () => {
      resolve(updatedVault);
    });
  });
}
