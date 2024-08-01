'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('group_permissions', {
      groupPermissionId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        field: 'group_permission_id',
      },
      permissionGroupId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'permission_group_id',
        references: {
          model: 'permission_groups',
          key: 'permission_group_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      permissionId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'permission_id',
        references: {
          model: 'permissions',
          key: 'permission_id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'created_at',
        defaultValue: Sequelize.NOW,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'updated_at',
        defaultValue: Sequelize.NOW,
      },
      deletedAt: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'deleted_at',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('group_permissions');
  },
};
