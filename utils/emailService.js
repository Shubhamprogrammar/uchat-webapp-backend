const nodemailer = require("nodemailer");
const dns = require("dns");

const createTransporter = () => {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP credentials (SMTP_USER / SMTP_PASS) are not configured in environment variables.");
  }

  const port = parseInt(process.env.SMTP_PORT || "587");
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Force IPv4 DNS resolution to avoid ENETUNREACH errors on hosts without IPv6
    lookup: (hostname, options, callback) => dns.lookup(hostname, { family: 4 }, callback),
    connectionTimeout: 8000, // 8s connection timeout
    greetingTimeout: 8000,
    socketTimeout: 10000,
    tls: {
      rejectUnauthorized: false
    }
  });
};

exports.sendOtpEmail = async (toEmail, otp) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.SMTP_FROM || `"UChat" <${process.env.SMTP_USER}>`,
    to: toEmail,
    subject: "UChat Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; rounded: 10px;">
        <h2 style="color: #2563eb; text-align: center;">UChat Verification Code</h2>
        <p style="font-size: 16px; color: #333;">Your OTP verification code for UChat is:</p>
        <div style="background-color: #f3f4f6; padding: 15px; text-align: center; border-radius: 8px; font-size: 28px; font-weight: bold; letter-spacing: 5px; color: #1d4ed8; margin: 20px 0;">
          ${otp}
        </div>
        <p style="font-size: 14px; color: #666;">This code is valid for 5 minutes. Please do not share this OTP with anyone.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999; text-align: center;">If you did not request this OTP, please ignore this email.</p>
      </div>
    `,
  };

  try {
    return await transporter.sendMail(mailOptions);
  } catch (err) {
    // If IPv6 route was attempted and failed, retry using IPv4 explicitly
    if (err && err.code === 'ENETUNREACH') {
      const retryTransporter = createTransporter();
      return await retryTransporter.sendMail(mailOptions);
    }
    throw err;
  }
};
