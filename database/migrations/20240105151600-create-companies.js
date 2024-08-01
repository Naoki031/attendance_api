'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companies', {
      companyId: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER,
        field: 'company_id',
      },
      countryId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'country_id',
        references: {
          model: {
            tableName: 'countries',
          },
          key: 'country_id',
        },
      },
      cityId: {
        allowNull: false,
        type: Sequelize.INTEGER,
        field: 'city_id',
        references: {
          model: {
            tableName: 'cities',
          },
          key: 'city_id',
        },
      },
      name: {
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      slug: {
        allowNull: false,
        type: Sequelize.STRING(100),
      },
      address: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      phoneNumber: {
        allowNull: true,
        type: Sequelize.STRING(20),
        field: 'phone_number',
      },
      email: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      website: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      descriptions: {
        allowNull: true,
        type: Sequelize.STRING(100),
      },
      foundedDate: {
        allowNull: true,
        type: Sequelize.DATE,
        field: 'founded_date',
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
    await queryInterface.dropTable('companies');
  },
};
