/**
 * Penalty type constants for cricket predictions
 * These must match the backend Python config in backend/automation/cricket/cricket_config.py
 * 
 * Note: Penalty points are calculated by the backend based on these types.
 * Frontend only records which penalty type was applied.
 */

export const CRICKET_PENALTIES = {
  INCONSISTENT_WINNER: 'inconsistent_winner',
  FIRST_INN_1ST_OVER: 'first_inn_1st_over',
  FIRST_INN_2ND_OVER: 'first_inn_2nd_over',
  FIRST_INN_3RD_OVER: 'first_inn_3rd_over',
  SECOND_INN_1ST_OVER: 'second_inn_1st_over',
} as const;

export type CricketPenaltyType = typeof CRICKET_PENALTIES[keyof typeof CRICKET_PENALTIES];
