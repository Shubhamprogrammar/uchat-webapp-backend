const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Place = require("../models/Place");
const Otp = require("../models/Otp");
const twilio = require("twilio");
const jwt = require("jsonwebtoken");
const authoriseuser = require("../middleware/authoriseuser");
require("dotenv").config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Signup and send OTP
router.post("/send-otp", async (req, res) => {
    try {
        const { name, mobile, gender, dob, username, label } = req.body;
        if (label === "login") {
            const user = await User.findOne({ mobile });
            if (!user) {
                return res.status(400).json({ message: "User not found, please signup first!" });
            }
        }
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
        const { name, mobile, gender, dob, username, otp, label } = req.body;

        const validOtp = await Otp.findOne({ mobile, otp });
        if (!validOtp) return res.status(400).json({ message: "Invalid or expired OTP" });

        let user;
        if (label === "signup") {

            // Check if user already exists (optional double-check)
            const existingUser = await User.findOne({ mobile });
            if (existingUser) {
                return res.status(400).json({ message: "User already registered, please login" });
            }

            const existingUsername = await User.findOne({ username });
            if (existingUsername) {
                return res.status(400).json({ message: "Username already taken, please choose another" });
            }

            if (!name || typeof name !== "string" || name.trim().length < 2) {
                return res.status(400).json({ message: "Please enter a valid name" });
            }

            if (!username || typeof username !== "string" || username.trim().length < 3) {
                return res.status(400).json({ message: "Please enter a valid username" });
            }

            if (!mobile || !/^[6-9]\d{9}$/.test(mobile)) {
                return res.status(400).json({ message: "Please enter a valid 10-digit Indian mobile number" });
            }

            if (!gender || !["male", "female", "other"].includes(gender.toLowerCase())) {
                return res.status(400).json({ message: "Gender must be Male, Female, or Other" });
            }

            if (!dob || isNaN(Date.parse(dob))) {
                return res.status(400).json({ message: "Please enter a valid date of birth (YYYY-MM-DD)" });
            }
            const dobDate = new Date(dob);
            const today = new Date();
            // Normalize today (remove time)
            today.setHours(0, 0, 0, 0);
            if (dobDate >= today) {
                return res.status(400).json({message: "Date of birth must be earlier than today"});
            }

            user = new User({
                name,
                mobile,
                username,
                gender,
                dob
            });

            await user.save();
            await Otp.deleteMany({ mobile }); // cleanup
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
        await Otp.deleteMany({ otp }); // cleanup

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Update user details
router.put("/update/:id", authoriseuser, async (req, res) => {
    try {
        const { id } = req.params;

        // Only allow updating own profile
        if (req.user._id.toString() !== id) {
            return res.status(403).json({ message: "You can only update your own profile" });
        }

        // Get only keys that exist in body (e.g. name, username)
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

// Update user status: block/unblock/delete/restore
router.patch("/update-status", authoriseuser, async (req, res) => {
    try {
        const { userId, action } = req.body;

        if (!userId || !action) {
            return res.status(400).json({ message: "userId and action are required" });
        }

        let updateData = {};

        switch (action) {
            case "block":
                updateData.is_blocked = true;
                break;
            case "unblock":
                updateData.is_blocked = false;
                break;
            case "delete":
                updateData.is_deleted = true;
                break;
            case "restore":
                updateData.is_deleted = false;
                break;
            default:
                return res.status(400).json({ message: "Invalid action" });
        }

        const updatedUser = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!updatedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({
            message: `User ${action} successfully`,
            user: updatedUser
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error" });
    }
});

router.get('/user', authoriseuser, async (req,res)=>{
    try{
        const {gender} = req.query;
        if(gender && !["male","female","other", "all"].includes(gender.toLowerCase())){
            return res.status(400).json({message: "Invalid gender"});
        }
        if(gender && gender.toLowerCase() === "all"){
            const users = await User.find({is_deleted: false}).select('username name');
            return res.json(users);
        }
        else{
        let filter = { is_deleted: false, is_blocked: false };
        if (gender) {
            filter.gender = gender;
        }
        const users = await User.find(filter).select('username name');
        res.json(users);
    }
    }
    catch(err){
        console.error(err);
        res.status(500).json({message: "Internal Server Error"});
    }
})

module.exports = router;
