import express from 'express';
import { AuthMiddleware, ExpressAsync } from '@middleware';
import { ConversionController } from '@controllers';
import { GetConversionUnitPath } from '@openApi';

const conversionRoutes = express.Router();

conversionRoutes.get(
  '/',
  GetConversionUnitPath,
  AuthMiddleware,
  ExpressAsync(ConversionController.getConversionUnitValues),
);

export default conversionRoutes;
