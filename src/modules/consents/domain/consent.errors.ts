export abstract class ConsentDomainError extends Error {
  public abstract readonly statusCode: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ConsentValidationError extends ConsentDomainError {
  public readonly statusCode = 400;

  constructor(message: string) {
    super(message);
  }
}

export class ConsentNotFoundError extends ConsentDomainError {
  public readonly statusCode = 404;

  constructor(idConsentimiento: number) {
    super(`La plantilla de consentimiento con ID ${idConsentimiento} no existe.`);
  }
}

export class InactiveConsentTemplateError extends ConsentDomainError {
  public readonly statusCode = 409;

  constructor(idConsentimiento: number) {
    super(
      `No se puede firmar el consentimiento porque la plantilla con ID ${idConsentimiento} se encuentra inactiva.`
    );
  }
}