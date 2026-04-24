// Orchestrator - Routes tasks to sub-agents
// Main coordinator for the AutoApply Agent logic

import { ContextReasoner } from './agents/contextReasoner.js';
import { AnswerCrafter } from './agents/answerCrafter.js';
import { OutreachComposer } from './agents/outreachComposer.js';
import { getProfile, updateHistory } from '../memory/storage.js';

export class Orchestrator {
  constructor() {
    this.contextReasoner = new ContextReasoner();
    this.answerCrafter = new AnswerCrafter();
    this.outreachComposer = new OutreachComposer();
  }

  /**
   * Main entry point: Analyze page and determine best action
   */
  async analyzePage(context, mode = 'general') {
    try {
      // Get user profile for personalization
      const profile = await getProfile();

      // Step 1: Context reasoning
      const reasoning = await this.contextReasoner.analyze(context, profile, mode);

      // Step 2: Update history with this analysis
      await updateHistory({
        type: 'analysis',
        url: context.url,
        mode: mode,
        timestamp: new Date().toISOString(),
        reasoning: reasoning
      });

      return {
        success: true,
        reasoning: reasoning.summary,
        relevance: reasoning.relevanceScore,
        suggestedAction: reasoning.suggestedAction,
        fields: context.formFields
      };
    } catch (error) {
      console.error('Orchestrator.analyzePage error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generate answer for a given query
   */
  async generateAnswer(query, context) {
    try {
      const profile = await getProfile();

      // Use AnswerCrafter to generate response
      const answer = await this.answerCrafter.craft(query, context, profile);

      // Update history
      await updateHistory({
        type: 'answer_generated',
        query: query,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        answer: answer.text,
        reasoning: answer.reasoning
      };
    } catch (error) {
      console.error('Orchestrator.generateAnswer error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Compose outreach (email, DM, etc.)
   */
  async composeOutreach(data) {
    try {
      const profile = await getProfile();

      const outreach = await this.outreachComposer.compose(data, profile);

      // Update history
      await updateHistory({
        type: 'outreach_composed',
        targetType: data.type,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: outreach.message,
        subject: outreach.subject,
        tone: outreach.tone
      };
    } catch (error) {
      console.error('Orchestrator.composeOutreach error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}
