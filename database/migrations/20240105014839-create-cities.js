'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cities', {
      cityId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        field: 'city_id',
      },
      countryId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'country_id',
        references: {
          model: 'countries',
          key: 'country_id',
        },
      },
      name: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      slug: {
        unique: true,
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      isCapital: {
        allowNull: true,
        type: Sequelize.BOOLEAN,
        field: 'is_capital',
      },
      latitude: {
        allowNull: true,
        type: Sequelize.FLOAT,
      },
      longitude: {
        allowNull: true,
        type: Sequelize.FLOAT,
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
    await queryInterface.dropTable('cities');
  },
};
