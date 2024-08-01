'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      userId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        field: 'user_id',
      },
      username: {
        allowNull: false,
        type: Sequelize.STRING(50),
      },
      firstName: {
        allowNull: false,
        type: Sequelize.STRING(50),
        field: 'first_name',
      },
      lastName: {
        allowNull: false,
        type: Sequelize.STRING(50),
        field: 'last_name',
      },
      position: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      phoneNumber: {
        allowNull: false,
        type: Sequelize.STRING(20),
        field: 'phone_number',
      },
      email: {
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      address: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      password: {
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      isActive: {
        allowNull: false,
        type: Sequelize.BOOLEAN,
        field: 'is_active',
      },
      roles: {
        allowNull: false,
        type: Sequelize.JSON,
      },
      avatar: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      dateOfBirth: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'date_of_birth',
      },
      joinDate: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'join_date',
      },
      contractSignDate: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'contract_sign_date',
      },
      contractExpireDate: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'contract_expire_date',
      },
      contractType: {
        allowNull: true,
        type: Sequelize.STRING(50),
        field: 'contract_type',
      },
      contractCount: {
        allowNull: true,
        type: Sequelize.INTEGER,
        field: 'contract_count',
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'created_at',
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'updated_at',
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('users');
  },
};
