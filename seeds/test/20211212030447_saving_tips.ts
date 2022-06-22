import { Knex } from 'knex';

export async function seed(knex: Knex): Promise<void> {
  // Deletes ALL existing entries
  //await knex("table_name").del();

  // Inserts seed entries
  await knex('EnergySavingTips').insert([
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 1.jpg',
      category: 'Cooling',
      text: 'Raise energy awareness more often to users. This can be via e-mail, face-to-face, webinars or workshops. ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 2.jpg',
      category: 'Cooling',
      text: 'Turn off unused Air Conditioning Systems ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 3.jpg',
      category: 'Cooling',
      text: 'Match air conditioning operating times with building operating times ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 4.jpg',
      category: 'Cooling',
      text: ' Set the time for your cooling systems to come on a little late than normally to ensure your building reduces power whilst not sacrificing thermal comfort ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 5.jpg',
      category: 'Cooling',
      text: 'Clean Vents regularly to reduce colling energy ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 6.jpg',
      category: 'Cooling',
      text: 'Unplug unused servers to reduce colling needs ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 7.jpg',
      category: 'Cooling',
      text: 'Check that the HVAC housing unit is not leaking ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 8.jpg',
      category: 'Cooling',
      text: 'Lower the speed of fans to reduce cooling energy ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 9.jpg',
      category: 'Cooling',
      text: 'Close all windows during cooling to prevent air infiltration ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 10.jpg',
      category: 'Cooling',
      text: 'Shut doors properly to prevent heat infiltration ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 11.jpg',
      category: 'Cooling',
      text: 'Wherever possible, open windows when air conditioning system is off to access free cooling ',
    },
    {
      imageUrl: '/assets/energyTipsImages/cooling/Cooling Energy_Artboard 12.jpg',
      category: 'Cooling',
      text: 'Ensure your air conditioning system is not on while windows are left open  ',
    },
    { imageUrl: null, category: 'Cooling', text: 'Increase cooling set points by 1 degree if possible' },

    {
      text: 'Raise energy awareness more often to users. This can be via e-mail, face-to-face, webinars or workshops. ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 1.jpg',
    },
    {
      text: 'Turn off unused radiators ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 2.jpg',
    },
    {
      text: 'Set the time for your heating to come on a little late than normally to ensure your building reduces heating energy whilst not sacrificing thermal comfort ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 3.jpg',
    },
    {
      text: 'Service your heating systems regularly to increase its operational efficiency to save heating  ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 4.jpg',
    },
    {
      text: 'Close all windows during heating to prevent air infiltration ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 5.jpg',
    },
    {
      text: 'Shut doors during heating properly to prevent air infiltration ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 6.jpg',
    },
    {
      text: 'Draft proof doors ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 7.jpg',
    },
    {
      text: 'Check that insulation on building fabrics are in good condition ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 8.jpg',
    },
    {
      text: 'Check that there are no hot water leaks  ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 9.jpg',
    },
    {
      text: 'Use water efficiently and cut back on hot water use ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 10.jpg',
    },
    {
      text: ' Check that radiator are free of obstructions at all time ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 11.jpg',
    },
    {
      text: 'Reduce heating setpoint by 1 degree if possible ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 12.jpg',
    },
    {
      text: 'Match heating supply to the building with operating times ',
      category: 'Heating',
      imageUrl: '/assets/energyTipsImages/heating/Heating Energy_Artboard 13.jpg',
    },
    {
      text: 'Raise energy awareness more often to users. This can be via e-mail, face-to-face, webinars or workshops. ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 1.jpg',
    },
    {
      text: 'Turn off unused lights off ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 2.jpg',
    },
    {
      text: 'Walk through to turn off lights  ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 3.jpg',
    },
    {
      text: 'Check to see sensors/lighting control systems are working properly in relation to building use ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 4.jpg',
    },
    {
      text: 'Sets your lighting sensors to turn off lighting a little earlier than normally if possible ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 5.jpg',
    },
    {
      text: 'Dim the brightness of your devices and lights, if possible, to reduce electricity use ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 6.jpg',
    },
    {
      text: 'Unplug unused servers ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 7.jpg',
    },
    {
      text: 'Check that to there are no water leaks  ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 8.jpg',
    },
    {
      text: 'Reduce office use and intensive activities during peak times ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 9.jpg',
    },
    {
      text: 'Discourage use of personal phones at work to reduce recharges and save electricity ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 10.jpg',
    },
    {
      text: 'Make sure your security lights off at the earliest point when day light set in ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 11.jpg',
    },
    {
      text: 'Make sure your security lights are switched off during working hours ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 12.jpg',
    },
    {
      text: 'Shut computers off completely when not in use  ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 13.jpg',
    },
    {
      text: 'Switch off lights or reduce the number of lights on when daylighting can be harvested ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 14.jpg',
    },
    {
      text: 'Clean lighting fixtures to improve light reflectance ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 15.jpg',
    },
    {
      text: 'Clean device screenplays ',
      category: 'Power',
      imageUrl: '/assets/energyTipsImages/powerAndLighting/Power and Lighting Energy_Artboard 16.jpg',
    },
  ]);
}
