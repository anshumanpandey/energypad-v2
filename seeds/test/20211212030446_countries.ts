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
      data.states.push({ name: state, countryId });
    };
    states.forEach(stateFn);
  };

  (Countries as any).countries.forEach(countryFn);

  return data;
};
export async function seed(knex: Knex): Promise<void> {
  const data = reduceData();

  await knex('Countries').insert(data.countries);

  const size = 100;
  for (let i = 0; i < data.states.length; i += size) {
    await knex('States').insert(data.states.slice(i, i + size));
  }
}
