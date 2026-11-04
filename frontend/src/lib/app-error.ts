/** Typed adapter failure (spine Consistency Conventions): features map to sonner toasts.
 *  Moved verbatim from src/data/errors.ts at the Apollo cutover (epic P2-8 T1) —
 *  the closed api enum (extensions.code) maps onto these codes via src/api/errors.ts. */
export class AppError extends Error {
  code: string;
  messageKey?: string;

  constructor(code: string, messageKey?: string) {
    super(code);
    this.name = "AppError";
    this.code = code;
    this.messageKey = messageKey;
  }
}
