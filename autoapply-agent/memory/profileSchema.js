// User Profile Schema and Defaults

export const PROFILE_SCHEMA = {
  // Basic info
  name: '',
  email: '',
  phone: '',
  
  // Professional info
  title: '',
  company: '',
  industry: '',
  yearsOfExperience: 0,
  
  // Background
  background: '',
  education: [],
  skills: [],
  languages: [],
  
  // Career goals
  goals: [],
  targetRoles: [],
  interestedIndustries: [],
  
  // Preferences
  workStyle: '', // remote, hybrid, office
  salary_range: { min: 0, max: 0 },
  willing_to_relocate: false,
  
  // Personality
  tone_preference: 'professional', // professional, warm, casual, etc
  values: [],
  
  // System
  created_at: null,
  updated_at: null,
  onboarding_completed: false
};

export const DEFAULT_PROFILE = {
  name: '',
  email: '',
  phone: '',
  title: '',
  company: '',
  industry: '',
  yearsOfExperience: 0,
  background: '',
  education: [],
  skills: [],
  languages: [],
  goals: [],
  targetRoles: [],
  interestedIndustries: [],
  workStyle: 'hybrid',
  salary_range: { min: 0, max: 0 },
  willing_to_relocate: false,
  tone_preference: 'professional',
  values: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  onboarding_completed: false
};

/**
 * Validate profile against schema
 */
export function validateProfile(profile) {
  const errors = [];

  // Check required fields
  if (!profile.name) errors.push('Name is required');
  if (!profile.email) errors.push('Email is required');

  // Type checks
  if (profile.yearsOfExperience && typeof profile.yearsOfExperience !== 'number') {
    errors.push('Years of experience must be a number');
  }

  if (profile.skills && !Array.isArray(profile.skills)) {
    errors.push('Skills must be an array');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
