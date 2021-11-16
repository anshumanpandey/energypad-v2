import express from 'express';
import { AuthMiddleware, ExpressAsync } from '@middleware';
import { DashboardController } from '@controllers';
import { GetDashboardDataPath } from '@openApi';

const authRoutes = express.Router();

authRoutes.get('/', GetDashboardDataPath, AuthMiddleware, ExpressAsync(DashboardController.getDataByYear));

export default authRoutes;
