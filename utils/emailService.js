const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const dns = require("dns");

// Resend sends over HTTPS (443), so it works from hosts that block outbound
// SMTP ports (25/465/587) — the usual reason "works locally, fails in production".
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

if (resend) {
  console.log("✅ Resend initialized for production email delivery");
} else if (process.env.NODE_ENV === "production") {
  console.warn(
    "⚠️ WARNING: Running in production but RESEND_API_KEY is missing! Falling back to SMTP, which most hosts block."
  );
}

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
      rejectUnauthorized: false,
    },
  });
};

const defaultFrom =
  process.env.SMTP_FROM || (process.env.SMTP_USER ? `"UChat" <${process.env.SMTP_USER}>` : "no-reply@uchat.com");

/**
 * Unified email sender: Resend (HTTP API) in production, Nodemailer/SMTP
 * otherwise — and as a fallback if Resend errors.
 */
const sendEmail = async ({ to, subject, html, text, from }) => {
  const sender = from || defaultFrom;

  if (process.env.NODE_ENV === "production" && resend) {
    try {
      const { data, error } = await resend.emails.send({
        from: sender,
        to,
        subject,
        html,
        text,
      });
      if (error) throw error;
      console.log(`✅ Resend: Email sent to ${to} (id: ${data?.id})`);
      return;
    } catch (err) {
      console.error("❌ Resend Error:", err.message || err);
      console.log("🔄 Falling back to SMTP...");
    }
  }

  const transporter = createTransporter();
  const mailOptions = { from: sender, to, subject, html, text };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ SMTP: Email sent to ${to}`);
  } catch (err) {
    // If IPv6 route was attempted and failed, retry using IPv4 explicitly
    if (err && err.code === "ENETUNREACH") {
      const retryTransporter = createTransporter();
      await retryTransporter.sendMail(mailOptions);
      console.log(`✅ SMTP (retry): Email sent to ${to}`);
      return;
    }
    throw err;
  }
};

exports.sendOtpEmail = async (toEmail, otp) => {
  const subject = "UChat Verification Code";
  const html = `
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
    `;

  await sendEmail({ to: toEmail, subject, html });
};
