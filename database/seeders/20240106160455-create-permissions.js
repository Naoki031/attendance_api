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
      'permissions',
      [
        {
          name: 'ALL PRIVILEGES',
          key: 'all_privileges',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'CREATE',
          key: 'create',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'UPDATE',
          key: 'update',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'DELETE',
          key: 'delete',
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          name: 'GRANT OPTION',
          key: 'grant_option',
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
    await queryInterface.bulkDelete('permissions', null, {});
  },
};
