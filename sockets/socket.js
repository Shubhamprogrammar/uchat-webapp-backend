const Conversation = require("../models/Conversation");
const Message = require("../models/Message");

const handleSendMessage = async(io,socket,payload)=>{
    try {
    const { receiverId, text, mediaUrl, messageType } = payload;
    const senderId = socket.user.id;

    if (!receiverId || (!text && !mediaUrl)) {
      socket.emit("send-error", { message: "Invalid message payload" });
      return;
    }

    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    const isNewConversation = !conversation;

    if (!conversation) {
      conversation = new Conversation({
        participants: [senderId, receiverId],
        lastMessage: text || "Media",
      });
      await conversation.save();
    }

    const message = new Message({
      conversationId: conversation._id,
      sender: senderId,
      receiver: receiverId,
      text,
      mediaUrl,
      messageType: messageType || "text",
    });

    await message.save();

    const receiverActiveConversation =
      global.activeConversations.get(receiverId.toString());

    if (
      !receiverActiveConversation ||
      receiverActiveConversation.toString() !== conversation._id.toString()
    ) {
      conversation.unreadCount.set(
        receiverId.toString(),
        (conversation.unreadCount.get(receiverId.toString()) || 0) + 1
      );
    }

    conversation.lastMessage = text || "Media";
    await conversation.save();

    const payloadToEmit = {
      ...message.toObject(),
      conversationId: conversation._id,
      isNewConversation,
    };

    io.to(receiverId.toString()).emit("receiveMessage", payloadToEmit);

    socket.emit("send-success", payloadToEmit);
    console.log("payloadToemit",payloadToEmit);

  } catch (err) {
    console.error("Socket send-message error:", err);

    socket.emit("send-error", {
      message: "Message delivery failed",
      error: err.message
    });
  }
};


const handleMarkSeen = async (io, socket, { conversationId, senderId }) => {
  try {
    const userId = socket.user.id;

    let convoId = conversationId;

    if (!convoId && senderId) {
      const convo = await Conversation.findOne({
        participants: { $all: [userId, senderId] }
      });

      if (!convo) return;
      convoId = convo._id;
    }

    if (!convoId) return;

    await Message.updateMany(
      { conversationId: convoId, receiver: userId, isSeen: false },
      { $set: { isSeen: true } }
    );

    await Conversation.updateOne(
      { _id: convoId },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    io.to(userId.toString()).emit("unread-reset", {
      conversationId: convoId,
    });

  } catch (err) {
    console.error("Socket mark-seen error:", err);
  }
};




module.exports = {handleSendMessage,handleMarkSeen}
