import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 614, email: 'mail614@mail.com' }),
    buildFakeBusiness({ id: 616, email: 'mail616@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 604, businessId: 614, name: 'Main Building A' }),
    buildFakeSite({ id: 606, businessId: 614, name: 'Main Building B' }),

    buildFakeSite({ id: 608, businessId: 616, name: 'Main Building C' }),
    buildFakeSite({ id: 610, businessId: 616, name: 'Main Building D' }),
  ]);
}
