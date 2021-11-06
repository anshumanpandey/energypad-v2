import express from "express";
import { default as userRoute } from './user.route';

const routes = express();

routes.use("/user",userRoute)

export default routes;