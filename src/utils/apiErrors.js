class apiErrors extends Error {
  constructor(
    status,
    message = "Something went wrong",
    errors = [],
    stacks = ""
  ) {
     super(message);
     this.statusCode = status;
     this.data = null;
     this.message = message;
     this.success = false;
     this.errors = errors;
    if (stacks) {
      this.stack = stacks;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default apiErrors;
