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
