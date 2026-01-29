const express = require('express');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require('path');
const connectToMongo = require('./models/config');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();
connectToMongo();

const app = express();
app.use(cors());
app.use(express.json());

// Create HTTP server
const httpServer = http.createServer(app);

// Create Socket instance
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Store Online Users Globally
global.onlineUsers = new Map();

// Make io available inside routes
app.use((req, res, next) => {
  req.io = io;
  next();
});

/* ------------ ROUTES ------------- */
app.use('/api/auth', require('./routes/auth'));
app.use('/api/message', require('./routes/message'));
app.use('/api/admin', require('./routes/admin'));

const PORT = process.env.PORT || 5000;

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // SINGLE SOURCE OF TRUTH
  socket.on("joinUser", (userId) => {
    socket.join(userId);
    global.onlineUsers.set(userId, socket.id);

    // Send updated online users list
    io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));
  });

  // 🔊 Broadcast announcements
  socket.on("sendAnnouncement", (message) => {
    io.emit("receiveAnnouncement", message);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);

    let disconnectedUserId = null;

    for (let [userId, sockId] of global.onlineUsers.entries()) {
      if (sockId === socket.id) {
        disconnectedUserId = userId;
        global.onlineUsers.delete(userId);
        break;
      }
    }

    if (disconnectedUserId) {
      io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));
    }
  });
});


app.get('/', (req, res) => {
  res.send("U-Chat Backend Running Successfully");
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
