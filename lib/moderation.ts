/** Report reasons, as public.reports.reason accepts them. */
export const REPORT_REASONS = {
  multi_comptes: "Comptes multiples",
  triche: "Triche ou échanges suspects",
  pseudo: "Pseudo inapproprié",
  avatar: "Avatar inapproprié",
  harcelement: "Harcèlement",
  autre: "Autre",
} as const;

export type ReportReason = keyof typeof REPORT_REASONS;
