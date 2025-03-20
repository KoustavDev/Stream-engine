import nodemailer from "nodemailer";
import emailOtpTemplete from "./templete.js";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL,
    pass: process.env.EMAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function sendEmail(email, otp) {
  try {
    const mailOptions = {
      from: {
        name: "Stream-engine",
        address: process.env.EMAIL,
      },
      to: email,
      subject: "Email verification!",
      html: emailOtpTemplete(otp),
      replyTo: process.env.EMAIL,
    };

    const result = await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

export default sendEmail;
