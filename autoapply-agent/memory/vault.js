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

/**
 * Save updates to the personal data vault
 */
export async function saveToVault(updates) {
  const currentVault = await getVault();
  const updatedVault = { ...currentVault, ...updates };

  return new Promise((resolve) => {
    chrome.storage.local.set({ [STORAGE_KEY]: updatedVault }, () => {
      resolve(updatedVault);
    });
  });
}
