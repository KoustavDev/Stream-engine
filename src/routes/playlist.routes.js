import { Router } from "express";
import verifyUser from "../middlewares/auth.middleware.js";
import { createPlayList } from "../controllers/playlist.controller.js";

const playlistRoute = Router();

playlistRoute.use(verifyUser);

playlistRoute.route("/").post(createPlayList);

export default playlistRoute;