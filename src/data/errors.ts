/** Typed adapter failure (spine Consistency Conventions): features map to sonner toasts. */
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
