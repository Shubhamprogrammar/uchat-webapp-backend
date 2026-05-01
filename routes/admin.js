const express = require("express");
const router = express.Router();

const {
  getUsers,
  updateUserStatus,
  sendAnnouncement,
  getStats
} = require("../controllers/adminController");

router.get("/users", getUsers);
router.patch("/user/update-status", updateUserStatus);
router.post("/announce", sendAnnouncement);
router.get("/stats", getStats);

module.exports = router;