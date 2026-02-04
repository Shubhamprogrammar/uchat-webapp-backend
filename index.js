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
    origin: ["http://localhost:5173",
      "https://uchat-webapp.vercel.app"
    ],
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
  const userId = socket.handshake.auth?.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log("Socket connected for user:", userId);

  socket.join(userId.toString());

  global.onlineUsers.set(userId.toString(), socket.id);

  io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));

  socket.on("disconnect", () => {
    global.onlineUsers.delete(userId.toString());
    io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));
    console.log("Socket disconnected:", userId);
  });
});


app.get('/', (req, res) => {
  res.send("U-Chat Backend Running Successfully");
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
