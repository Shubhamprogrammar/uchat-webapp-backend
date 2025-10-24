const jwt = require("jsonwebtoken");
module.exports = function (req, res, next) {
    const token = req.header("Authorization");

    if (!token) {
        return res.status(401).json({ error: "Access Denied: No Token Provided" });
    }

    try {
        const tokenParts = token.split(" ");
        if (tokenParts.length !== 2 || tokenParts[0] !== "Bearer") {
            return res.status(401).json({ error: "Invalid token format" });
        }

        const decoded = jwt.verify(tokenParts[1], process.env.JWT_SECRET);

        req.user = decoded.user;
        next();
    } catch (err) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
