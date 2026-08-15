const User = require("../models/User");
const Conversation = require("../models/Conversation");
const Otp = require("../models/Otp");
const jwt = require("jsonwebtoken");
const { sendOtpEmail } = require("../utils/emailService");

// SEND OTP
exports.sendOtp = async (req, res) => {
  try {
    const { email, mobile, username, label } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase().trim();

    if (label === "login") {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(400).json({
          message: "User not found with this email, signup first"
        });
      }
    } else if (label === "signup") {
      // Prevent duplicate accounts with same email, mobile, or username
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        return res.status(400).json({
          message: "User with this email already exists. Please login instead."
        });
      }

      if (mobile) {
        const existingMobile = await User.findOne({ mobile });
        if (existingMobile) {
          return res.status(400).json({
            message: "User with this mobile number already exists."
          });
        }
      }

      if (username) {
        const existingUsername = await User.findOne({ username });
        if (existingUsername) {
          return res.status(400).json({
            message: "Username is already taken. Please choose another."
          });
        }
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.deleteMany({ email: normalizedEmail });
    await Otp.create({ email: normalizedEmail, otp });

    await sendOtpEmail(normalizedEmail, otp);

    res.json({ message: "OTP sent to your email successfully" });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// VERIFY OTP
exports.verifyOtp = async (req, res) => {
  try {
    const { name, email, mobile, gender, dob, username, otp, label } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const validOtp = await Otp.findOne({ email: normalizedEmail, otp });

    if (!validOtp) {
      return res.status(400).json({
        message: "Invalid or expired OTP"
      });
    }

    let user;

    if (label === "signup") {
      // Double check duplicate accounts
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        await Otp.deleteMany({ email: normalizedEmail });
        return res.status(400).json({
          message: "User with this email already exists."
        });
      }

      if (mobile) {
        const existingMobile = await User.findOne({ mobile });
        if (existingMobile) {
          await Otp.deleteMany({ email: normalizedEmail });
          return res.status(400).json({
            message: "User with this mobile number already exists."
          });
        }
      }

      user = await User.create({
        name,
        email: normalizedEmail,
        mobile,
        gender,
        dob,
        username
      });
    } else {
      user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    await Otp.deleteMany({ email: normalizedEmail });

    res.json({
      message: "Success",
      user,
      token
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      req.body,
      { new: true }
    );

    res.json(updatedUser);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// UPDATE STATUS
exports.updateStatus = async (req, res) => {
  try {
    const { userId, action } = req.body;

    let update = {};

    if (action === "block") update.is_blocked = true;
    if (action === "unblock") update.is_blocked = false;
    if (action === "delete") update.is_deleted = true;
    if (action === "restore") update.is_deleted = false;

    const user = await User.findByIdAndUpdate(
      userId,
      update,
      { new: true }
    );

    res.json({
      message: "Status updated",
      user
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET USERS
exports.getUsers = async (req, res) => {
  try {
    const userId = req.user.id;
    const search = req.query.search;

    if (search && search.trim()) {
      // SEARCH MODE: find users matching name or username
      const regex = new RegExp(search.trim(), "i");
      const matchedUsers = await User.find({
        _id: { $ne: userId },
        is_deleted: { $ne: true },
        $or: [{ name: regex }, { username: regex }],
      }).select("name username gender photo about");

      // Enrich with conversation data
      const enriched = await Promise.all(
        matchedUsers.map(async (u) => {
          const convo = await Conversation.findOne({
            participants: { $all: [userId, u._id] },
          });
          return {
            _id: u._id,
            name: u.name,
            username: u.username,
            gender: u.gender,
            photo: u.photo,
            about: u.about,
            receiver: u._id,
            conversationId: convo?._id || null,
            lastMessage: convo?.lastMessage || "",
            unreadCount: convo?.unreadCount?.get(userId.toString()) || 0,
          };
        })
      );

      return res.json(enriched);
    }

    // CONTACT LIST MODE: return users with existing conversations
    const conversations = await Conversation.find({
      participants: userId,
    }).sort({ updatedAt: -1 });

    const contacts = await Promise.all(
      conversations.map(async (convo) => {
        const otherUserId = convo.participants.find(
          (p) => p.toString() !== userId.toString()
        );
        const otherUser = await User.findById(otherUserId).select(
          "name username gender photo about"
        );
        if (!otherUser) return null;
        return {
          _id: otherUser._id,
          name: otherUser.name,
          username: otherUser.username,
          gender: otherUser.gender,
          photo: otherUser.photo,
          about: otherUser.about,
          receiver: otherUser._id,
          conversationId: convo._id,
          lastMessage: convo.lastMessage || "",
          unreadCount: convo.unreadCount?.get(userId.toString()) || 0,
        };
      })
    );

    const filteredContacts = contacts.filter(Boolean);

    // NEW USER: if no conversations, suggest 10 users of the same gender
    if (filteredContacts.length === 0) {
      const currentUser = await User.findById(userId).select("gender");
      const suggestions = await User.find({
        _id: { $ne: userId },
        is_deleted: { $ne: true },
        gender: currentUser?.gender,
      })
        .select("name username gender photo about")
        .limit(10);

      const enriched = suggestions.map((u) => ({
        _id: u._id,
        name: u.name,
        username: u.username,
        gender: u.gender,
        photo: u.photo,
        about: u.about,
        receiver: u._id,
        conversationId: null,
        lastMessage: "",
        unreadCount: 0,
      }));

      return res.json(enriched);
    }

    res.json(filteredContacts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// SELF USER
exports.getSelfUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    res.json(user);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET USER BY ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};