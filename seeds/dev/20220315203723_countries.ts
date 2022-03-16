import { Knex } from 'knex';
import Countries from '../Countries.json';

const reduceData = () => {
  const data = {
    countries: [],
    states: [],
  };

  const countryFn = ({ country, states }, idx) => {
    const countryId = idx + 1;
    data.countries.push({ id: countryId, name: country });

    const stateFn = (state, stateIdx) => {
      data.states.push({ id: countryId + (stateIdx + 1), name: state, countryId });
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
