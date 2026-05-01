const express = require("express");
const router = express.Router();
const authoriseuser = require("../middleware/authMiddleware");

const {
  sendOtp,
  verifyOtp,
  updateProfile,
  updateStatus,
  getUsers,
  getSelfUser
} = require("../controllers/authController");

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);

router.put("/update-profile", authoriseuser, updateProfile);
router.patch("/update-status", authoriseuser, updateStatus);

router.get("/user", authoriseuser, getUsers);
router.get("/self-user", authoriseuser, getSelfUser);

module.exports = router;