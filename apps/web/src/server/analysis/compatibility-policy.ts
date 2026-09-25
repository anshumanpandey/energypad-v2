// User-approved comparison tolerance; independent of the application's numerical algorithms.
export const compatibilityPolicy = {
  version: 'workbook-absolute-0.99-v1',
  absolute: 0.99,
  relative: 0,
  approvedBy: 'user',
  approvalSource: 'Conversation: allow a tolerance of 0.99 absolute difference',
  nativeRecalculation: {
    status: 'USER_CONFIRMED',
    source: 'Conversation: the three workbooks been fully recalculated',
    independentlyObserved: false,
  },
} as const;
