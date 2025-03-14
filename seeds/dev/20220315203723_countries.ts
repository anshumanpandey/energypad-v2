import { Knex } from 'knex';
import Countries from '../Countries.json';

type Data = {
  countries: any[];
  states: any[];
};
const reduceData = () => {
  const data: Data = {
    countries: [],
    states: [],
  };

  const countryFn: (i: { country: string, states: string[] }, idx: number) => void = ({ country, states }, idx) => {
    const countryId = idx + 1;
    data.countries.push({ id: countryId, name: country });

    const stateFn = (state: string) => {
      data.states.push({ name: state, countryId });
    };
    states.forEach(stateFn);
  };

  (Countries as any).countries.forEach(countryFn);

  return data;
};
export async function seed(knex: Knex): Promise<void> {
  const data = reduceData();

  // Inserts seed entries
  await knex('Countries').insert(data.countries);
  await knex('States').insert(data.states);
}
