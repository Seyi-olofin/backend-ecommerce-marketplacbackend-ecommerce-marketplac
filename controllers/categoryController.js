const Category = require('../models/Category');
const mongoose = require('mongoose');

// Import adapters for fallback
const DummyJSONAdapter = require('../adapters/DummyJSONAdapter');
const FakeStoreAdapter = require('../adapters/FakeStoreAdapter');

const dummyAdapter = new DummyJSONAdapter();
const fakeAdapter = new FakeStoreAdapter();

// Category image mapping function
const getCategoryImage = (categoryName) => {
  const imageMap = {
    'smartphones': '/images/category-electronics.jpg',
    'laptops': '/images/category-electronics.jpg',
    'fragrances': '/images/category-beauty.jpg',
    'skincare': '/images/category-beauty.jpg',
    'groceries': '/images/category-health.svg',
    'home-decoration': '/images/category-home.jpg',
    'furniture': '/images/category-home.jpg',
    'tops': '/images/category-fashion.jpg',
    'womens-dresses': '/images/category-fashion.jpg',
    'womens-shoes': '/images/category-fashion.jpg',
    'mens-shirts': '/images/category-fashion.jpg',
    'mens-shoes': '/images/category-fashion.jpg',
    'mens-watches': '/images/category-jewelry.svg',
    'womens-watches': '/images/category-jewelry.svg',
    'womens-bags': '/images/category-fashion.jpg',
    'womens-jewellery': '/images/category-jewelry.svg',
    'sunglasses': '/images/category-fashion.jpg',
    'automotive': '/images/category-automotive.svg',
    'motorcycle': '/images/category-automotive.svg',
    'lighting': '/images/category-home.svg',
    'sports-accessories': '/images/category-sports.svg',
    'books': '/images/category-books.svg',
    'toys': '/images/category-toys.svg'
  };

  const normalizedName = categoryName.toLowerCase().replace(/\s+/g, '-');
  return imageMap[normalizedName] || '/images/category-placeholder.svg';
};

// Check if MongoDB is connected
const isMongoConnected = () => mongoose.connection.readyState === 1;

// Get all categories
const getCategories = async (req, res) => {
  try {
    // Try MongoDB first if connected
    if (isMongoConnected()) {
      // Check if categories exist in DB, if not seed from external APIs
      const categoryCount = await Category.countDocuments();
      if (categoryCount === 0) {
        console.log('🌍 No categories found in database, seeding from DummyJSON...');
        try {
          const dummyCategories = await dummyAdapter.getCategories();
          const fakeCategories = await fakeAdapter.getCategories();

          // Combine and deduplicate categories
          const allCategories = [...dummyCategories, ...fakeCategories];
          const uniqueCategories = allCategories.filter((cat, index, self) =>
            index === self.findIndex(c => c.name.toLowerCase() === cat.name.toLowerCase())
          );

          const mapped = uniqueCategories.slice(0, 20).map(item => ({
            id: item.id,
            name: item.name,
            image: getCategoryImage(item.name),
            description: item.description || `${item.name} products`,
            source: item.source,
            parentId: item.parentId || null,
            isActive: true
          }));

          await Category.insertMany(mapped);
          console.log(`🌍 Seeded ${mapped.length} categories from external APIs`);
        } catch (seedError) {
          console.error('Failed to seed categories:', seedError);
        }
      }

      const categories = await Category.find({ isActive: true }).lean();
      return res.json(categories);
    }

    // Fallback to adapter system if MongoDB not connected
    console.log('Using adapter system for categories (MongoDB not connected)');

    let categories = [];

    try {
      const dummyCategories = await dummyAdapter.getCategories();
      categories.push(...dummyCategories);
    } catch (error) {
      console.warn('DummyJSON adapter failed for categories:', error.message);
    }

    try {
      const fakeCategories = await fakeAdapter.getCategories();
      categories.push(...fakeCategories);
    } catch (error) {
      console.warn('FakeStore adapter failed for categories:', error.message);
    }

    // Remove duplicates based on name
    const uniqueCategories = categories.filter((cat, index, self) =>
      index === self.findIndex(c => c.name === cat.name)
    );

    res.json(uniqueCategories.slice(0, 20));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ message: 'Failed to fetch categories' });
  }
};

// Get single category by ID
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Try MongoDB first if connected
    if (isMongoConnected()) {
      const category = await Category.findOne({ id, isActive: true }).lean();
      if (category) {
        return res.json(category);
      }
    }

    // Fallback to adapter system
    console.log('Category not found in database, trying adapter system for:', id);

    try {
      const category = await dummyAdapter.getCategories().then(cats =>
        cats.find(cat => cat.id === id)
      );
      if (category) return res.json(category);
    } catch (error) {
      console.warn('DummyJSON adapter failed for category details:', error.message);
    }

    return res.status(404).json({ message: 'Category not found' });
  } catch (error) {
    console.error('Error fetching category:', error);
    res.status(500).json({ message: 'Failed to fetch category' });
  }
};

// Create new category (Admin only)
const createCategory = async (req, res) => {
  try {
    const categoryData = req.body;

    // Generate unique ID if not provided
    if (!categoryData.id) {
      categoryData.id = categoryData.name.toLowerCase().replace(/\s+/g, '-');
    }

    // Check if category ID already exists
    const existingCategory = await Category.findOne({ id: categoryData.id });
    if (existingCategory) {
      return res.status(409).json({ message: 'Category ID already exists' });
    }

    const category = new Category(categoryData);
    await category.save();

    res.status(201).json(category);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to create category' });
  }
};

// Update category (Admin only)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findOneAndUpdate(
      { id },
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(category);
  } catch (error) {
    console.error('Error updating category:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Failed to update category' });
  }
};

// Delete category (Admin only)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findOneAndUpdate(
      { id },
      { isActive: false },
      { new: true }
    );

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({ message: 'Category deleted successfully' });
  } catch (error) {
    console.error('Error deleting category:', error);
    res.status(500).json({ message: 'Failed to delete category' });
  }
};

module.exports = {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
};