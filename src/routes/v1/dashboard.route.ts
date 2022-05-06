import express from 'express';
import { AuthMiddleware, ExpressAsync } from '@middleware';
import { DashboardController } from '@controllers';
import {
  GetDashboardCarbonFootprintPath,
  GetDashboardDataPath,
  GetDashboardEnergyWastePath,
  GetDashboardPortfolioPath,
  GetDashboardReportsPath,
} from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/', GetDashboardDataPath, AuthMiddleware, ExpressAsync(DashboardController.getDataByYear));
authRoutes.get('/reports', GetDashboardReportsPath, AuthMiddleware, ExpressAsync(DashboardController.getReporData));
authRoutes.get(
  '/carbonFootprint',
  GetDashboardCarbonFootprintPath,
  AuthMiddleware,
  ExpressAsync(DashboardController.getcarbonFootprint),
);

authRoutes.get(
  '/portfolio',
  GetDashboardPortfolioPath,
  AuthMiddleware,
  ExpressAsync(DashboardController.getReportData),
);

authRoutes.get(
  '/energyWaste',
  GetDashboardEnergyWastePath,
  AuthMiddleware,
  ExpressAsync(DashboardController.getEnergyWaste),
);

export default authRoutes;
