const express = require("express");
const router = express.Router();

const authoriseuser = require("../middleware/authMiddleware");

const {
  getMessages,
  editMessage,
  deleteMessage
} = require("../controllers/messageController");

router.get("/get-messages/:receiverId", authoriseuser, getMessages);

router.put("/edit-message/:messageId", authoriseuser, editMessage);

router.delete("/delete-message/:messageId", authoriseuser, deleteMessage);

module.exports = router;