'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const bcrypt = require('bcrypt'); // eslint-disable-line
    const dotenv = require('dotenv'); // eslint-disable-line
    dotenv.config();
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    console.log(process.env.SALT_ROUNDS);
    await queryInterface.bulkInsert(
      'users',
      [
        {
          username: 'kingvi',
          first_name: 'Trung Truc',
          last_name: 'Nguyen',
          position: 'Leader',
          phone_number: '0909090909',
          email: 'trucnguyen.dofuu@gmail.com',
          address: 'HCMC',
          password: bcrypt.hashSync('123456', bcrypt.genSaltSync(10)),
          is_active: true,
          roles: '["super_admin", "user"]',
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
      {},
    );
  },

  async down(queryInterface) {
    /**
     * Add commands to revert seed here.
     *
     * Example:
     * await queryInterface.bulkDelete('People', null, {});
     */
    return queryInterface.bulkDelete('users', null, {});
  },
};
