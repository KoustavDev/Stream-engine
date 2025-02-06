const asyncHandler = (fn) => {
  // Function inside a function
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      res.status(error.code || 500).json({ success: false, message: error.message });
    }
  };
};

export default asyncHandler;

// Another method
/*
const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((err) => next(err));
    }
}
*/
