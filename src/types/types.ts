import express from 'express';
import { Knex } from 'knex';
import { ApiError } from '@lib';
import { components, paths } from './Generated';

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
export type AppController<T extends ResponseKeys, A extends RequestBodyKeys> = (
  req: AppRequest<RequestBodyParams<A>, ControllerReturnType<T>>,
) => Promise<ControllerReturnType<T>>;

type AuthAppRequest<ReqBody, ResBody> = { user: { id: number } } & express.Request<
  { [key: string]: string },
  ResBody,
  ReqBody
>;
export type AuthAppController<T extends ResponseKeys, A extends RequestBodyKeys> = (
  req: AuthAppRequest<RequestBodyParams<A>, ControllerReturnType<T>>,
) => Promise<ControllerReturnType<T>>;

export type QueryParamsKeys = Pick<
  paths,
  | '/api/dashboard/'
  | '/api/business/sites'
  | '/api/site/states'
  | '/api/business/patterns'
  | '/api/utility/consumptions'
  | '/api/utility/emissions'
  | '/api/dashboard/reports'
>;
export type QueryParams<T extends keyof QueryParamsKeys> = QueryParamsKeys[T]['get']['parameters']['query'];

type AuthGetAppRequest<ResBody, QueryBody = never, PathParameters = { [key: string]: string }> = {
  user: { id: number };
} & express.Request<PathParameters, ResBody, never, QueryBody>;
export type AuthGetAppController<T extends ResponseKeys, A extends keyof QueryParamsKeys = never> = (
  req: AuthGetAppRequest<ControllerReturnType<T>, QueryParams<A>>,
) => Promise<ControllerReturnType<T>>;

export type MixAppController<T extends ResponseKeys, A extends RequestBodyKeys, F extends keyof QueryParamsKeys> =
  | AppController<T, A>
  | AuthAppController<T, A>
  | AuthGetAppController<T, F>;

export interface Transactionable {
  txr?: Knex.Transaction;
}
