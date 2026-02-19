const express = require('express');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require('path');
const connectToMongo = require('./models/config');
const http = require('http');
const { Server } = require('socket.io');
const socketAuth=require('./middleware/socketMiddleware');
const Conversation=require('./models/Conversation');
const Message=require('./models/Message');
const {handleMarkSeen,handleSendMessage}=require('./sockets/socket');

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
global.activeConversations = new Map();

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


io.use(socketAuth);

io.on("connection", (socket) => {
  
  const userId = socket.user.id;
  

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log("Socket connected for user:", userId);

  socket.join(userId.toString());

  console.log("[ROOM JOIN]", userId, socket.id);


  global.onlineUsers.set(userId.toString(), socket.id);

  activeConversations.set(userId.toString(), null);

  socket.emit("sync-active-chat");

  socket.on("send-message",(payload)=>{
    handleSendMessage(io,socket,payload);
    console.log("Received send-message:", payload);
  })

    socket.on("mark-seen", (payload) => {
    handleMarkSeen(io, socket, payload);
  });

 socket.on("active-chat", async (conversationId) => {
    try {
      if (!conversationId) return;

      activeConversations.set(userId.toString(), conversationId);

      // 🔥 Mark all unseen messages as seen
      await Message.updateMany(
        { conversationId, receiver: userId, isSeen: false },
        { $set: { isSeen: true } }
      );

      // 🔥 Reset unread count in DB
      await Conversation.updateOne(
        { _id: conversationId },
        { $set: { [`unreadCount.${userId}`]: 0 } }
      );

      socket.emit("unread-reset", { conversationId });
       } catch (err) {
      console.error("active-chat error:", err);
    }
  });


  io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));

  socket.on("disconnect", () => {
    global.onlineUsers.delete(userId.toString());
    io.emit("onlineUsers", Array.from(global.onlineUsers.keys()));
    activeConversations.delete(userId.toString());
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
