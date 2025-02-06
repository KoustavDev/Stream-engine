import { Router } from "express";
import { registerUser } from "../controllers/user.controller.js";

const userRoute = Router();

userRoute.route("/register").post(registerUser);

export default userRoute;