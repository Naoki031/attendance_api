'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.bulkInsert(
      'roles',
      [
        {
          name: 'Super Admin',
          key: 'super_admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'Admin',
          key: 'admin',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'User',
          key: 'user',
          created_at: new Date(),
          updated_at: new Date(),
        },
        // thêm các roles khác nếu cần
      ],
      {},
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', null, {});
  },
};
