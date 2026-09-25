// Byte caps for bounded opportunity inputs, not JavaScript character counts.
// A UTF-16 code unit can occupy six JSON bytes (\uXXXX), including control
// characters and lone surrogates. Budgets cover all fields at their schema
// maxima, escaped keys/IDs and structural overhead. Keep boundary fixtures in
// opportunity-body-limits.test.ts in sync when these input schemas change.
// Excess transport whitespace/padding is still subject to these finite caps.
export const opportunityBodyLimits = {
  create: 32 * 1024, // 160 title + 4,000 rationale code units.
  review: 32 * 1024, // 4,000 note code units.
  work: 320 * 1024, // 20 × (200 title + 2,000 evidence) + 4,000 note.
  verification: 64 * 1024, // 4,000 note + 10 × 500 references.
  supporting: 160 * 1024, // Programme: 20 × 1,000 answers + 5,100 other text.
} as const;
