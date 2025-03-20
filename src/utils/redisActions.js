import { redisClient } from "../app.js";

export const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const storeOTP = async (email, otp) => {
  try {
    await redisClient.set(`otp:email:${email}`, otp, "EX", 60);
  } catch (error) {
    console.log("Error storing OTP in Redis:", error);
  }
};

export const verifyOTP = async (email, otp) => {
  try {
    const storedOTP = await redisClient.get(`otp:email:${email}`);
    return storedOTP === otp;
  } catch (error) {
    console.log("Error verifying OTP in Redis:", error);
    return false;
  }
};
