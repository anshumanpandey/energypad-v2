import express from 'express';
import { Knex } from 'knex';
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

export type QueryParamsKeys = '/api/dashboard/' | '/api/utility/';
//export type QueryParams<T extends QueryParamsKeys> = paths[T]['get']['parameters']['query'];
export type QueryParams<T extends QueryParamsKeys> = never;

type AuthGetAppRequest<ReqBody, ResBody> = { user: { id: number } } & express.Request<
  { [key: string]: string },
  ResBody,
  never,
  ReqBody
>;
export type AuthGetAppController<T extends ResponseKeys, A extends QueryParamsKeys = never> = (
  req: AuthGetAppRequest<QueryParams<A>, ControllerReturnType<T>>,
) => Promise<ControllerReturnType<T>>;

export type MixAppController<T extends ResponseKeys, A extends RequestBodyKeys, F extends QueryParamsKeys> =
  | AppController<T, A>
  | AuthAppController<T, A>
  | AuthGetAppController<T, F>;

export interface Transactionable {
  txr?: Knex.Transaction;
}
