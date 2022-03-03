export class ApiError extends Error {
  constructor(message = 'API error', public code: number = 400) {
    super(message);

    // Set the prototype explicitly.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
