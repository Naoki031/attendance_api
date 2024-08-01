'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('time_records', {
      timeRecordId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        field: 'time_record_id',
      },
      userId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'user_id',
        },
      },
      timeIn: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'time_in',
      },
      timeOut: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'time_out',
      },
      date: {
        allowNull: false,
        type: Sequelize.DATEONLY,
      },
      qrData: {
        allowNull: true,
        type: Sequelize.STRING(100),
        field: 'qr_data',
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
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('time_records');
  },
};
