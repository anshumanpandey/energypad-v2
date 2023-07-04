import { Knex } from 'knex';
import { buildFakeBusiness, buildFakeSite } from '../../test/testhelp';

export async function seed(knex: Knex): Promise<void> {
  await knex('Businesses').insert([
    buildFakeBusiness({ id: 614, email: 'mail614@mail.com' }),
    buildFakeBusiness({ id: 616, email: 'mail616@mail.com' }),
    buildFakeBusiness({ id: 618, email: 'mail618@mail.com' }),
  ]);

  await knex('Sites').insert([
    buildFakeSite({ id: 604, businessId: 614, name: 'Main Building A', code: '604_main_a', vat: 12.37 }),
    buildFakeSite({ id: 606, businessId: 614, name: 'Main Building B' }),

    buildFakeSite({ id: 608, businessId: 616, name: 'Main Building C', code: '608_main_c' }),
    buildFakeSite({ id: 610, businessId: 616, name: 'Main Building D' }),

    buildFakeSite({ id: 612, businessId: 618, name: 'Main Building F', code: '612_main_f' }),
  ]);
}
