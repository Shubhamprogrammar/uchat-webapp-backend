const verifyToken = require("./verifyToken");

module.exports = function (req, res, next) {
  try {
    const token = req.header("Authorization");

    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: err.message || "Invalid or expired token",
    });
  }
};
