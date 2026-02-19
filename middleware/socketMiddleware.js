const verifyToken = require("./verifyToken");

module.exports = function (socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    

    const decoded = verifyToken(`${token}`);
    

    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error("Unauthorized"));
  }
};
