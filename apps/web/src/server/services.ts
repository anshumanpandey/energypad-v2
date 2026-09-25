import 'server-only';
import { db } from './db';
import { FoundationService } from './foundation';
import { mailer } from './mail';

export const foundation = new FoundationService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { SiteService } from './sites';
export const siteService = new SiteService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EnergyService } from './energy';
export const energyService = new EnergyService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EnergyImportService } from './energy-import';
export const energyImportService = new EnergyImportService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { DriverService } from './drivers';
export const driverService = new DriverService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { WeatherJobs } from './weather/jobs';
import { OpenMeteoProvider } from './weather/provider';
export const weatherService = new WeatherJobs(
  db,
  mailer,
  process.env.AUTH_URL ?? 'http://localhost:3100',
  new OpenMeteoProvider({ apiKey: process.env.OPEN_METEO_API_KEY, production: process.env.NODE_ENV === 'production' }),
);

import { TariffService } from './tariffs';
export const tariffService = new TariffService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EnergyCatalogService } from './energy-catalog';
export const energyCatalogService = new EnergyCatalogService(
  db,
  mailer,
  process.env.AUTH_URL ?? 'http://localhost:3100',
);

import { OccupancyService } from './occupancy';
export const occupancyService = new OccupancyService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { PatternService } from './patterns';
export const patternService = new PatternService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EventService } from './events';
export const eventService = new EventService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { AnalysisService } from './analysis/service';
export const analysisService = new AnalysisService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EmissionFactorService } from './emission-factors';
export const emissionFactorService = new EmissionFactorService(
  db,
  mailer,
  process.env.AUTH_URL ?? 'http://localhost:3100',
);

import { CarbonService } from './carbon';
export const carbonService = new CarbonService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { CarbonTargetService } from './carbon-targets';
export const carbonTargetService = new CarbonTargetService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { CarbonImportService } from './carbon-imports';
export const carbonImportService = new CarbonImportService(
  db,
  mailer,
  process.env.AUTH_URL ?? 'http://localhost:3100',
  emissionFactorService,
  carbonTargetService,
);

import { MonthlyPlanService } from './monthly-plans';
export const monthlyPlanService = new MonthlyPlanService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { AnalyticsReportService } from './analytics-reports';
export const analyticsReportService = new AnalyticsReportService(
  db,
  mailer,
  process.env.AUTH_URL ?? 'http://localhost:3100',
);

import { OpportunityService } from './opportunities';
export const opportunityService = new OpportunityService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');
