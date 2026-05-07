// Electron API type definitions
declare global {
  interface Window {
    overlayDesktop: {
      getSettings(): Promise<any>;
      updateSettings(partial: any): Promise<any>;
      showOverlay(): Promise<any>;
      hideOverlay(): Promise<any>;
      reloadOverlay(): Promise<any>;
      resetBounds(): Promise<any>;
      toggleClickThrough(): Promise<any>;
      openControls(): Promise<any>;
      openExternal(url: string): Promise<any>;
      copyText(value: string): Promise<any>;
      showTicker(): Promise<any>;
      hideTicker(): Promise<any>;
      reloadTicker(): Promise<any>;
      resetTickerBounds(): Promise<any>;
      showReaction(): Promise<any>;
      hideReaction(): Promise<any>;
      reloadReaction(): Promise<any>;
      resetReactionBounds(): Promise<any>;
      onSettingsChanged(callback: (settings: any) => void): void;
      onOverlayUrl(callback: (url: string) => void): void;
      fetchWinProbability(url: string): Promise<any>;
      viewScraperDebug(): Promise<any>;
      openScraperSolver(url: string): Promise<any>;
      getScheduleCsv(): Promise<string>;
      showDebug(): Promise<any>;
      setFirebaseMode(mode: string): Promise<any>;
      runScraper(sport: string, matchId: string, teamA: string, teamB: string, scraperOrder: any, matchUrl: string): Promise<any>;
      triggerSchedulerTask(taskId: string): Promise<any>;
      toggleSchedulerTask(taskId: string): Promise<any>;
      updateSchedulerTask(taskId: string, config: any): Promise<any>;
      getSchedulerStatus(): Promise<any>;
      getAutomationStatus(): Promise<any>;
      startOrchestrator(): Promise<any>;
      triggerAutomationTask(taskId: string): Promise<any>;
      updateAutomationConfig(component: string, updates: any): Promise<any>;
      testAutomationScraper(scraperName: string, testMatch: any): Promise<any>;
      getAutomationLogs(component: string, level: string, limit: number): Promise<any>;
      testDiscordNotification(): Promise<any>;
      updateDiscordConfig(config: any): Promise<any>;
      getNotificationStatus(): Promise<any>;
      registerPushDevice(userId: string, deviceInfo: any): Promise<any>;
      unregisterPushDevice(userId: string, deviceId: string): Promise<any>;
      getUserNotificationSettings(userId: string): Promise<any>;
      updateUserNotificationSettings(userId: string, settings: any): Promise<any>;
      getUserDevices(userId: string): Promise<any>;
      testPushNotification(userId?: string): Promise<any>;
      getVapidPublicKey(): Promise<any>;
      openSetupGuide(guideType: string): Promise<any>;
      getSetupGuideContent(guideType: string): Promise<any>;
      processMatchResolution(sport: string, tournamentId: string, matchId: string, innings?: string, force?: boolean, firebaseMode?: string): Promise<any>;
      setWindowVisibilityDefaults(visibility: any): Promise<any>;
    };
    APP_MODE: string;
  }
}

export {};
