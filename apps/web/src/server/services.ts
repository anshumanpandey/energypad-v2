import 'server-only';
import { db } from './db';
import { FoundationService } from './foundation';
import { mailer } from './mail';

export const foundation = new FoundationService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { SiteService } from './sites';
export const siteService = new SiteService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');

import { EnergyService } from './energy';
export const energyService = new EnergyService(db, mailer, process.env.AUTH_URL ?? 'http://localhost:3100');
