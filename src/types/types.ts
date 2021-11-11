import express from 'express';
import { ApiError } from '@lib';
import { components } from './Generated';

export type AppModels = components['schemas'];

export type RequestBodies = components['requestBodies'];
export type RequestBodyKeys = keyof components['requestBodies'];
export type RequestBodyParams<T extends RequestBodyKeys> =
  components['requestBodies'][T]['content']['application/json'];

export type ResponseKeys = keyof components['responses'];
export type RequestResponses<T extends ResponseKeys> = components['responses'][T]['content']['application/json'];
export type RequestBodieKeys = keyof components['requestBodies'];

type ControllerReturnType<T extends ResponseKeys> = RequestResponses<T> | ApiError;

type AppRequest<ReqBody, ResBody> = express.Request<{ [key: string]: string }, ResBody, ReqBody>;
export type AppController<T extends ResponseKeys> = (
  req: AppRequest<RequestBodyParams<T>, ControllerReturnType<T>>,
) => Promise<ControllerReturnType<T>>;

type AuthAppRequest<ReqBody, ResBody> = { user: { id: number } } & express.Request<
  { [key: string]: string },
  ResBody,
  ReqBody
>;
export type AuthAppController<T extends ResponseKeys> = (
  req: AuthAppRequest<RequestBodyParams<T>, ControllerReturnType<T>>,
) => Promise<ControllerReturnType<T>>;

export type MixAppController<T extends ResponseKeys> = AppController<T> | AuthAppController<T>;
