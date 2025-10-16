const mongoose = require('mongoose');
const Category = require('./models/Category');
require('dotenv').config();

const predefinedCategories = [
  {
    id: 'electronics',
    name: 'Electronics',
    image: '/assets/category-electronics.jpg',
    description: 'Latest gadgets, smartphones, laptops, and electronic devices',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'fashion',
    name: 'Fashion',
    image: '/assets/category-fashion.jpg',
    description: 'Clothing, shoes, accessories, and fashion items',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'beauty',
    name: 'Beauty',
    image: '/assets/category-beauty.jpg',
    description: 'Cosmetics, skincare, hair care, and beauty products',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'home-garden',
    name: 'Home & Garden',
    image: '/assets/category-home.svg',
    description: 'Furniture, decor, gardening tools, and home improvement',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'sports',
    name: 'Sports & Outdoors',
    image: '/assets/category-sports.svg',
    description: 'Sports equipment, outdoor gear, and fitness products',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'books',
    name: 'Books & Media',
    image: '/assets/category-books.svg',
    description: 'Books, movies, music, and digital media',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'automotive',
    name: 'Automotive',
    image: '/assets/category-automotive.svg',
    description: 'Car parts, accessories, and automotive supplies',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'health',
    name: 'Health & Wellness',
    image: '/assets/category-health.svg',
    description: 'Health supplements, fitness equipment, and wellness products',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'toys-games',
    name: 'Toys & Games',
    image: '/assets/category-toys.svg',
    description: 'Toys, games, and entertainment for all ages',
    source: 'predefined',
    isActive: true
  },
  {
    id: 'jewelry',
    name: 'Jewelry & Watches',
    image: '/assets/category-jewelry.svg',
    description: 'Jewelry, watches, and luxury accessories',
    source: 'predefined',
    isActive: true
  }
];

async function seedCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ecommerce-marketplace');

    // Drop existing categories
    await Category.deleteMany({});
    console.log('Dropped existing categories');

    // Seed new categories
    await Category.insertMany(predefinedCategories);
    console.log(`✅ Seeded ${predefinedCategories.length} predefined categories`);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding categories:', error);
    process.exit(1);
  }
}

seedCategories();