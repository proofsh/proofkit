export class UserAbortedError extends Error {
  constructor(message = "User aborted the operation") {
    super(message);
    this.name = "UserAbortedError";
  }
}
