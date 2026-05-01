const User = require("../models/User");
const Report = require("../models/Report");

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({success: true,users});
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { userId, action } = req.body;

    if (!userId || !action) {
      return res.status(400).json({
        success: false,
        message: "Missing userId or action"
      });
    }

    let update = {};

    switch (action) {
      case "block":
        update = { is_blocked: true };
        break;

      case "unblock":
        update = { is_blocked: false };
        break;

      case "delete":
        update = { is_deleted: true };
        break;

      case "restore":
        update = { is_deleted: false };
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Invalid action"
        });
    }

    const updatedUser = await User.findByIdAndUpdate( userId, update, { new: true } );

    res.json({ success: true, message: `User ${action}ed successfully`, user: updatedUser });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendAnnouncement = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message required"
      });
    }

    req.io.emit("receiveAnnouncement", message);

    res.json({ success: true, message: "Announcement sent" });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({
      is_blocked: false,
      is_deleted: false
    });

    const blockedUsers = await User.countDocuments({
      is_blocked: true
    });

    const deletedUsers = await User.countDocuments({
      is_deleted: true
    });

    const reportCount = await Report.countDocuments({
      status: "pending"
    });

    res.json({ success: true, stats: { totalUsers, activeUsers, blockedUsers, deletedUsers, reportCount } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};