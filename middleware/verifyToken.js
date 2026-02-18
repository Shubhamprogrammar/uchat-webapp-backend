const jwt = require("jsonwebtoken");

module.exports = function verifyToken(token) {
  if (!token) {
    throw new Error("Token missing");
  }

  const tokenParts = token.split(" ");
  if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
    throw new Error("Invalid token format");
  }

  return jwt.verify(tokenParts[1], process.env.JWT_SECRET);
};
