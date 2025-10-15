const Product = require('../models/Product');
const Category = require('../models/Category');
const DummyJSONAdapter = require('../adapters/DummyJSONAdapter');
const FakeStoreAdapter = require('../adapters/FakeStoreAdapter');

const dummyAdapter = new DummyJSONAdapter();
const fakeAdapter = new FakeStoreAdapter();

const seedDatabase = async () => {
  try {
    console.log('🌍 Starting database seeding...');

    // Check current counts
    const productCount = await Product.countDocuments();
    const categoryCount = await Category.countDocuments();

    console.log(`📊 Current database state: ${productCount} products, ${categoryCount} categories`);

    // Seed categories if empty
    if (categoryCount === 0) {
      console.log('🌍 Seeding categories...');

      // Predefined categories with specific images
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

      // Get additional categories from adapters (limit to avoid too many)
      const dummyCategories = (await dummyAdapter.getCategories()).slice(0, 5);
      const fakeCategories = (await fakeAdapter.getCategories()).slice(0, 5);

      // Filter out adapter categories that conflict with predefined ones
      const predefinedNames = predefinedCategories.map(cat => cat.name.toLowerCase());
      const filteredDummyCategories = dummyCategories.filter(cat =>
        !predefinedNames.includes(cat.name.toLowerCase())
      );
      const filteredFakeCategories = fakeCategories.filter(cat =>
        !predefinedNames.includes(cat.name.toLowerCase())
      );

      // Combine categories with predefined ones first
      const allCategories = [...predefinedCategories, ...filteredDummyCategories, ...filteredFakeCategories];

      const mappedCategories = uniqueCategories.slice(0, 20).map(item => ({
        id: item.id,
        name: item.name,
        image: item.image,
        description: item.description || `${item.name} products`,
        source: item.source,
        parentId: item.parentId || null,
        isActive: true
      }));

      await Category.insertMany(mappedCategories);
      console.log(`✅ Seeded ${mappedCategories.length} categories`);
    }

    // Seed products if empty
    if (productCount === 0) {
      console.log('🌍 Seeding products...');

      const fallback = await dummyAdapter.getProductsByCategory('general', { limit: 100 });
      const mappedProducts = fallback.map(item => ({
        id: `dummyjson_${item.id}`,
        title: item.title,
        description: item.description,
        price: {
          amount: item.price.amount,
          currency: item.price.currency
        },
        images: item.images,
        thumbnail: item.thumbnail,
        rating: item.rating,
        category: item.category,
        source: item.source,
        availability: item.availability,
        brand: item.brand,
        isActive: true,
        isFeatured: Math.random() > 0.8, // Randomly mark some as featured
        specifications: item.specifications,
        metadata: item.metadata
      }));

      await Product.insertMany(mappedProducts);
      console.log(`✅ Seeded ${mappedProducts.length} products`);
    }

    const finalProductCount = await Product.countDocuments();
    const finalCategoryCount = await Category.countDocuments();

    console.log(`🎉 Seeding completed! Database now has ${finalProductCount} products and ${finalCategoryCount} categories`);

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    throw error;
  }
};

module.exports = { seedDatabase };