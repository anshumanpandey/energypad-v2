import express from 'express';
import authRoutes from './auth.route';
import sitesRoutes from './sites.route';
import utilitiesRoutes from './utility.route';
import dashboardRoutes from './dashboard.route';
import businessRoutes from './business.route';

const routes = express.Router();

routes.use('/auth', authRoutes);
routes.use('/site', sitesRoutes);
routes.use('/utility', utilitiesRoutes);
routes.use('/dashboard', dashboardRoutes);
routes.use('/business', businessRoutes);

export default routes;
