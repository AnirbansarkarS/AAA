// Outreach Composer - Generates emails and messages

import { OUTREACH_PROMPT } from '../prompts/outreachPrompt.js';

export class OutreachComposer {
  constructor() {
    this.apiKey = null; // Will be loaded from storage
  }

  /**
   * Compose outreach message (email, LinkedIn DM, etc.)
   */
  async compose(data, userProfile) {
    try {
      const prompt = this.buildPrompt(data, userProfile);

      const response = await this.callGeminiAPI(prompt);

      return {
        message: response.message,
        subject: response.subject,
        tone: response.tone
      };
    } catch (error) {
      console.error('OutreachComposer.compose error:', error);
      throw error;
    }
  }

  buildPrompt(data, userProfile) {
    return OUTREACH_PROMPT + `

    OUTREACH TYPE: ${data.type}
    TARGET: ${data.target || 'Not specified'}
    PURPOSE: ${data.purpose || 'General networking'}

    USER PROFILE:
    Name: ${userProfile.name}
    Title: ${userProfile.title}
    Company: ${userProfile.company}
    
    TONE: ${data.tone || 'professional'}

    TASK: Generate a compelling outreach message that:
    1. Opens with a personalized hook
    2. Clearly states intent
    3. Shows mutual interest/connection
    4. Has a clear call-to-action
    5. Matches the specified tone

    Return JSON: { subject, message, tone }
    `;
  }

  async callGeminiAPI(prompt) {
    // TODO: Implement actual Gemini API call
    // For now, return mock response
    return {
      subject: "Let's connect on [Topic]",
      message: "Hi [Name],\n\nI came across your profile and found your work on [Topic] interesting...",
      tone: "professional"
    };
  }
}
