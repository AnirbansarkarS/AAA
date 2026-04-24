// History Tracker - Tracks usage patterns and what works

import { getHistory, updateHistory } from './storage.js';

export class HistoryTracker {
  /**
   * Track a page visit and analysis
   */
  static async trackPageAnalysis(url, title, mode, relevance) {
    await updateHistory({
      type: 'page_analysis',
      url,
      title,
      mode,
      relevance,
      success: relevance > 0.5
    });
  }

  /**
   * Track an answer being generated
   */
  static async trackAnswerGenerated(query, mode, quality) {
    await updateHistory({
      type: 'answer_generated',
      query,
      mode,
      quality // 1-5 rating
    });
  }

  /**
   * Track an answer being applied/submitted
   */
  static async trackAnswerApplied(answerId, feedback) {
    await updateHistory({
      type: 'answer_applied',
      answerId,
      feedback // 'helpful', 'edited', 'rejected'
    });
  }

  /**
   * Track outreach being composed
   */
  static async trackOutreachComposed(type, platform, tone) {
    await updateHistory({
      type: 'outreach_composed',
      platform, // email, linkedin, twitter, etc
      messageType: type, // greeting, inquiry, follow_up, etc
      tone
    });
  }

  /**
   * Track outreach being sent
   */
  static async trackOutreachSent(outreachId, platform) {
    await updateHistory({
      type: 'outreach_sent',
      outreachId,
      platform
    });
  }

  /**
   * Get success rate for a mode
   */
  static async getModeSuccessRate(mode) {
    const history = await getHistory();
    const modeEntries = history.filter(h => h.mode === mode);

    if (modeEntries.length === 0) return 0;

    const successful = modeEntries.filter(h => h.success).length;
    return successful / modeEntries.length;
  }

  /**
   * Get most used features
   */
  static async getMostUsedFeatures(limit = 5) {
    const history = await getHistory();
    const counts = {};

    history.forEach(entry => {
      counts[entry.type] = (counts[entry.type] || 0) + 1;
    });

    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  /**
   * Get mode preferences (which mode used most)
   */
  static async getModePreferences() {
    const history = await getHistory();
    const modes = {};

    history
      .filter(h => h.mode)
      .forEach(entry => {
        modes[entry.mode] = (modes[entry.mode] || 0) + 1;
      });

    return modes;
  }

  /**
   * Get analytics summary
   */
  static async getAnalyticsSummary() {
    const history = await getHistory();

    return {
      totalInteractions: history.length,
      modePreferences: await this.getModePreferences(),
      mostUsedFeatures: await this.getMostUsedFeatures(),
      lastInteraction: history[history.length - 1]?.timestamp,
      recentErrors: history.filter(h => h.error).slice(-5)
    };
  }
}
