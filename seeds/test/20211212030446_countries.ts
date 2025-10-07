import { Knex } from 'knex';
import Countries from '../Countries.json';

const reduceData = () => {
  const data = {
    countries: [] as { id: number; name: string }[],
    states: [] as { name: string; countryId: number }[],
  };

  const countryFn = ({ country, states }: any, idx: number) => {
    const countryId = idx + 1;
    data.countries.push({ id: countryId, name: country });

    const stateFn = (state: string, stateIdx: number) => {
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
  await knex('Countries').insert(data.countries).onConflict('id').merge();

  const size = 500;
  for (let i = 0; i < data.states.length; i += size) {
    await knex('States')
      .insert(data.states.slice(i, i + size))
      .onConflict('id')
      .merge(['name', 'countryId']);
  }
}
