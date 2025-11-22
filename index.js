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

// ✅ Store Online Users Globally
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

/* ------------ SOCKET LOGIC ------------- */
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // When a user joins (from frontend)
  socket.on("userOnline", (userId) => {
    global.onlineUsers.set(userId, socket.id);
    io.emit("onlineUsers", Array.from(onlineUsers.keys())); // Send updated list
  });

  // Join conversation room
  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
  });

  // Private messaging
  socket.on('sendMessage', (data) => {
    io.to(data.conversationId).emit('receiveMessage', data);
  });

  // Broadcast Announcements
  socket.on("sendAnnouncement", (message) => {
    io.emit("receiveAnnouncement", message);
  });

  // When user disconnects
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);

    // Remove offline user from map
    for (let [userId, sockId] of onlineUsers.entries()) {
      if (sockId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }

    io.emit("onlineUsers", Array.from(onlineUsers.keys())); // update list
  });
});

app.get('/', (req, res) => {
  res.send("U-Chat Backend Running Successfully ✅");
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
