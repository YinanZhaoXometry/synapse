/**
 * Client-side material bounds (AD-4 quota safety), relocated from the retired
 * src/data adapter at the Apollo cutover (epic P2-8 T1). The per-section text
 * bound keeps one material's extracted sections far below the legacy ~5MB
 * localStorage quota — and well under the api's 100,000-character per-section
 * cap (kickoff delta 6), which remains the hard wire limit (VALIDATION_FAILED
 * beyond).
 */
export const MATERIAL_SECTION_MAX_CHARS = 2000;
