const express = require('express');
const process = require('process');
const cors = require("cors");
const dotenv = require('dotenv');
const path = require('path');
const connectToMongo = require('./models/config');
const http = require('http');
const { Server } = require('socket.io');

connectToMongo();
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use('/api/auth', require('./routes/auth'));
app.use('/api/message', require('./routes/message'));

const PORT = process.env.PORT || 5000;

// Listen for client connections
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('joinConversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.id} joined conversation ${conversationId}`);
  });

  socket.on('sendMessage', (data) => {
    // Emit only to participants in the conversation
    io.to(data.conversationId).emit('receiveMessage', data);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});


app.get('/',(req,res)=>{
    res.send("U-Chat is running successfully");
})
app.listen(PORT,()=>{
    console.log(`U-Chat Web App is listening at port http://localhost:${PORT}`);
})