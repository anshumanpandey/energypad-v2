import express from 'express';
import { AuthMiddleware, ExpressAsync } from '@middleware';
import { DashboardController } from '@controllers';
import { GetDashboardCarbonFootprintPath, GetDashboardDataPath, GetDashboardReportsPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/', GetDashboardDataPath, AuthMiddleware, ExpressAsync(DashboardController.getDataByYear));
authRoutes.get('/reports', GetDashboardReportsPath, AuthMiddleware, ExpressAsync(DashboardController.getReporData));
authRoutes.get(
  '/carbonFootprint',
  GetDashboardCarbonFootprintPath,
  AuthMiddleware,
  ExpressAsync(DashboardController.getcarbonFootprint),
);

export default authRoutes;
