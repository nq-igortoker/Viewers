interface CreateReportWindowConfig {
  createReport?: { baseUrl?: string };
}

/**
 * Whether this deployment has a CreateReport target at all.
 *
 * The same condition `generateReport` checks before doing anything. The lesion
 * chip uses it to stay out of configurations it cannot serve: a chip offering
 * to name the lesion for a capture that will only ever answer "CreateReport
 * base URL is not configured" is worse than no chip.
 */
export function isCreateReportConfigured(): boolean {
  const { config } = window as Window & { config?: CreateReportWindowConfig };
  return !!config?.createReport?.baseUrl;
}
