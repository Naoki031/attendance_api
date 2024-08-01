'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    /**
     * Add seed commands here.
     *
     * Example:
     * await queryInterface.bulkInsert('People', [{
     *   name: 'John Doe',
     *   isBetaMember: false
     * }], {});
     */
    await queryInterface.bulkInsert(
      'permission_groups',
      [
        {
          name: 'Super',
          permissions: '[all_privileges]',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'Admin',
          permissions: '[create, update, delete]',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'User',
          permissions: '[create, update]',
          created_at: new Date(),
          updated_at: new Date(),
        },
        // thêm các permissions khác nếu cần
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
    await queryInterface.bulkDelete('permission_groups', null, {});
  },
};
