// Context Reasoner - Analyzes page context and scores relevance

import { CONTEXT_PROMPT } from '../prompts/contextPrompt.js';

export class ContextReasoner {
  constructor() {
    this.apiKey = null; // Will be loaded from storage
  }

  /**
   * Analyze page context and determine relevance
   */
  async analyze(context, userProfile, mode) {
    try {
      // Prepare analysis prompt
      const prompt = this.buildPrompt(context, userProfile, mode);

      // Call Gemini API
      const response = await this.callGeminiAPI(prompt);

      // Parse response
      const reasoning = this.parseResponse(response);

      return {
        summary: reasoning.summary,
        relevanceScore: reasoning.relevance,
        suggestedAction: reasoning.action,
        detectedFields: context.formFields,
        pageTitle: context.title
      };
    } catch (error) {
      console.error('ContextReasoner.analyze error:', error);
      throw error;
    }
  }

  buildPrompt(context, userProfile, mode) {
    return CONTEXT_PROMPT + `

    Page Title: ${context.title}
    Form Fields Detected: ${JSON.stringify(context.formFields, null, 2)}
    Mode: ${mode}
    User Profile: ${JSON.stringify(userProfile, null, 2)}

    TASK: Analyze this page and:
    1. Determine relevance to user's profile (0-1 score)
    2. Identify what form fields match user info
    3. Suggest next action (auto_fill, compose_message, collect_more_info)
    
    Return JSON: { relevance, summary, action, matchedFields }
    `;
  }

  async callGeminiAPI(prompt) {
    // TODO: Implement actual Gemini API call
    // For now, return mock response
    return {
      relevance: 0.75,
      summary: "This appears to be a job application form with relevant fields.",
      action: "auto_fill",
      matchedFields: ["name", "email", "phone"]
    };
  }

  parseResponse(response) {
    // Parse Gemini response
    return {
      relevance: response.relevance || 0.5,
      summary: response.summary || "Analysis complete",
      action: response.action || "collect_more_info"
    };
  }
}
