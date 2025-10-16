// Normalized product schema used across all APIs
const ProductSchema = {
  id: "string", // Unique identifier (can include source prefix)
  title: "string", // Product name
  description: "string", // Full product description
  price: {
    amount: "number", // Price value
    currency: "string" // Currency code (USD, EUR, etc.)
  },
  images: ["string"], // Array of image URLs
  thumbnail: "string", // Main thumbnail URL
  rating: "number", // Average rating (0-5)
  category: "string", // Category name/path
  source: "string", // API source (ebay, bestbuy, fakestore, etc.)
  availability: {
    stock: "number", // Available quantity
    status: "string" // in_stock, out_of_stock, limited
  },
  specifications: "object", // Key-value pairs of specs
  metadata: "object" // Additional API-specific data
};

const CategorySchema = {
  id: "string",
  name: "string",
  image: "string",
  description: "string",
  source: "string",
  parentId: "string", // For hierarchical categories
  subcategories: "array" // Array of subcategory objects
};

module.exports = {
  ProductSchema,
  CategorySchema
};