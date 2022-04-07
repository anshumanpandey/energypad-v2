import express from 'express';
import { AuthMiddleware, ExpressAsync } from '@middleware';
import { DashboardController } from '@controllers';
import { GetDashboardDataPath, GetDashboardReportsPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/', GetDashboardDataPath, AuthMiddleware, ExpressAsync(DashboardController.getDataByYear));
authRoutes.get('/reports', GetDashboardReportsPath, AuthMiddleware, ExpressAsync(DashboardController.getReporData));

export default authRoutes;
