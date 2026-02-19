const express = require("express");
const Message = require("../models/Message.js");
const Conversation = require("../models/Conversation.js");
const User = require("../models/User.js");
const authoriseuser = require("../middleware/authMiddleware.js");

const router = express.Router();

const mongoose = require("mongoose");

router.get("/get-messages/:receiverId", authoriseuser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { receiverId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
            return res.status(400).json({ message: "Invalid receiverId" });
        }

        // Find conversation between these two users
        const conversation = await Conversation.findOne({
            participants: { $all: [userId, receiverId] },
        });
        if (!conversation) {
            return res.status(200).json({ messages: [], message: "No conversation found" });
        }

        // Fetch messages in that conversation
        const messages = await Message.find({ conversationId: conversation._id, is_deleted: false })

            .sort({ createdAt: 1 });


        res.status(200).json({
            conversationId: conversation._id,
            messages,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});


router.put("/edit-message/:messageId", authoriseuser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;
        const { newText } = req.body;

        if (!newText || newText.trim() === "") {
            return res.status(400).json({ message: "Message text cannot be empty" });
        }

        // Find the message
        const message = await Message.findById(messageId);

        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Ensure only the sender can edit
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only edit your own messages" });
        }

        // Update message text
        message.text = newText;
        await message.save();

        // Update lastMessage in conversation if it's the most recent one
        const latestMessage = await Message.findOne({
            conversationId: message.conversationId,
        }).sort({ createdAt: -1 });

        if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                lastMessage: newText,
            });
        }

        // Emit event for real-time updates
        if (req.io) {
            req.io.to(message.conversationId.toString()).emit("messageEdited", message);
        }

        res.status(200).json({
            message: "Message updated successfully",
            data: message,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

// DELETE MESSAGE
router.delete("/delete-message/:messageId", authoriseuser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { messageId } = req.params;

        const message = await Message.findById(messageId);
        if (!message) {
            return res.status(404).json({ message: "Message not found" });
        }

        // Only sender can delete their message
        if (message.sender.toString() !== userId.toString()) {
            return res.status(403).json({ message: "You can only delete your own messages" });
        }

        // Soft delete
        message.is_deleted = true;
        await message.save();

        // Update lastMessage in conversation if it was the latest one
        const latestMessage = await Message.findOne({
            conversationId: message.conversationId,
        }).sort({ createdAt: -1 });

        if (latestMessage && latestMessage._id.toString() === message._id.toString()) {
            await Conversation.findByIdAndUpdate(message.conversationId, {
                lastMessage: "This message was deleted",
            });
        }

        // Emit delete event for live chat updates
        if (req.io) {
            req.io.to(message.conversationId.toString()).emit("messageDeleted", messageId);
        }

        res.status(200).json({ message: "Message deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
});

module.exports = router;
