import express from 'express';
import authRoutes from './auth.route';
import sitesRoutes from './sites.route';

const routes = express.Router();

routes.use('/auth', authRoutes);
routes.use('/site', sitesRoutes);

export default routes;
