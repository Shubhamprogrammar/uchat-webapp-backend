const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Otp = require("../models/Otp");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const authoriseuser = require("../middleware/authoriseuser");
require("dotenv").config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Signup and send OTP
router.post("/signup", async (req, res) => {
    try {
        const { name, mobile, city, gender, state, dob } = req.body;

        const existing = await User.findOne({ mobile });
        if (existing) return res.status(400).json({ message: "Mobile number already registered" });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        // Save OTP
        await Otp.create({ mobile, otp });

        // Send OTP via Twilio SMS
        await client.messages.create({
            body: `Your OTP for Chat App signup is ${otp}. It expires in 5 minutes.`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: mobile.startsWith('+') ? mobile : `+91${mobile}` // handle Indian numbers
        });

        res.json({ message: "OTP sent to your mobile number!" });
    } catch (err) {
        console.error("Error sending OTP:", err);
        res.status(500).json({ message: "Failed to send OTP" });
    }
});

//  Verify OTP and create user
router.post("/verify-otp", async (req, res) => {
    try {
        const { name, mobile, city, gender, state, dob, otp, label } = req.body;

        const validOtp = await Otp.findOne({ mobile, otp });
        if (!validOtp) return res.status(400).json({ message: "Invalid or expired OTP" });

        let user;
        if (label === "signup") {

            // Check if user already exists (optional double-check)
            const existingUser = await User.findOne({ mobile });
            if (existingUser) {
                return res.status(400).json({ message: "User already registered, please login" });
            }

            user = new User({
                name,
                mobile,
                city,
                gender,
                state,
                dob
            });

            await newUser.save();
            await Otp.deleteMany({ mobile }); // cleanup

            // res.json({ message: "User registered successfully", user: newUser });
        }
        else if (label === 'login') {
            // Find user for login
            user = await User.findOne({ mobile });
            if (!user) return res.status(400).json({ message: "User not found, please signup" });
        }
        else {
            res.status(400).json({ message: "Invalid label" })
        }

        // Create JWT token
        const token = jwt.sign(
            { id: user._id, mobile: user.mobile },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
        );

        res.json({
            message: label === "signup" ? "User registered successfully" : "Login successful",
            user,
            token
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Update user details
router.put("/:id",authoriseuser,async (req, res) => {
    try {
        const { id } = req.params;

        // Only allow updating own profile
        if (req.user._id.toString() !== id) {
            return res.status(403).json({ message: "You can only update your own profile" });
        }

        // Get only keys that exist in body (e.g. name, city)
        const updates = req.body;

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!updatedUser)
            return res.status(404).json({ message: "User not found" });

        res.json(updatedUser);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

module.exports = router;
