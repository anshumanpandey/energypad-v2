import express from 'express';
import { ApiError } from '@lib';
import { components } from './Generated';

export type AppModels = components['schemas'];
export type RequestBodies = components['requestBodies'];

export type ResponseKeys = keyof components['responses'];
export type RequestResponses<T extends ResponseKeys> = components['responses'][T]['content']['application/json'];
export type RequestBodieKeys = keyof components['requestBodies'];

type ControllerReturnType<T extends ResponseKeys> = RequestResponses<T> | ApiError;
export type AppController<T extends ResponseKeys> = (req: express.Request) => Promise<ControllerReturnType<T>>;
