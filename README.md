# E-commerce Multi-API Backend

A robust backend service that aggregates product data from multiple e-commerce APIs with intelligent fallback and priority resolution.

## Features

- **Multi-API Integration**: Supports eBay, Best Buy, Etsy, FakeStoreAPI, and more
- **Priority Resolution**: Automatically selects the best API based on region, category, and availability
- **Normalized Schema**: Unified product and category data structure across all APIs
- **Rate Limiting**: Built-in rate limiting and retry logic
- **Caching**: Memory and Redis caching for improved performance
- **Feature Flags**: Enable/disable APIs dynamically
- **Fallback System**: Graceful degradation when APIs are unavailable

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API credentials
   ```

3. **Start the server:**
   ```bash
   npm run dev
   ```

## API Endpoints

### Products
- `GET /api/products` - Get products with optional filtering
- `GET /api/products/:id` - Get product details
- `GET /api/categories/:category/products` - Get products by category

### Categories
- `GET /api/categories` - Get all categories

### Health
- `GET /api/health` - Health check

## API Configuration

### OAuth APIs (Require Token Exchange)

#### eBay
1. Register at [eBay Developer](https://developer.ebay.com/)
2. Create an app and get your App ID
3. Implement OAuth flow to get access token
4. Set environment variables:
   ```env
   EBAY_APP_ID=your_app_id
   EBAY_ACCESS_TOKEN=your_access_token
   ```

#### Etsy
1. Register at [Etsy Developer](https://www.etsy.com/developers)
2. Create an app and get API key
3. Set environment variable:
   ```env
   ETSY_API_KEY=your_api_key
   ```

### API Key APIs

#### Best Buy
1. Register at [Best Buy Developer](https://developer.bestbuy.com/)
2. Get API key
3. Set environment variable:
   ```env
   BESTBUY_API_KEY=your_api_key
   ```

#### MercadoLibre
1. Register at [MercadoLibre Developer](https://developers.mercadolibre.com/)
2. Get API key
3. Set environment variable:
   ```env
   MERCADOLIBRE_API_KEY=your_api_key
   ```

## Priority Resolution

The system automatically selects APIs based on:

1. **Region**: US APIs for US users, LATAM APIs for LATAM users
2. **Category**: Electronics from Best Buy, handmade from Etsy
3. **Availability**: Falls back to next priority if API fails
4. **Rate Limits**: Automatically switches when rate limited

### Priority Order Examples

**US Electronics**: Best Buy → eBay → Etsy → FakeStore
**LATAM General**: MercadoLibre → eBay → Etsy → FakeStore
**Global Handmade**: Etsy → eBay → FakeStore

## Architecture

### Adapters
Each API has its own adapter in `adapters/` that:
- Handles authentication
- Normalizes data to standard schema
- Implements rate limiting
- Provides retry logic

### Priority Resolver
`services/PriorityResolver.js` determines which API to use based on:
- Geographic location
- Product category
- API availability and health
- Feature flags

### Caching
- **Memory Cache**: Fast in-memory caching with TTL
- **Redis Cache**: Optional persistent caching for production

## Development

### Adding a New API

1. Create adapter in `adapters/NewAPIAdapter.js`
2. Extend `BaseAdapter` class
3. Implement required methods
4. Add to adapter initialization in `server.js`
5. Update priority resolver configuration
6. Add environment variables

### Testing

```bash
npm test
```

### Logging

The system provides detailed logging for:
- API selection decisions
- Fallback triggers
- Rate limit hits
- Authentication failures

## Production Deployment

1. Set up Redis for caching
2. Configure all API credentials
3. Enable feature flags for desired APIs
4. Set up monitoring and alerts
5. Configure rate limiting based on API quotas

## Troubleshooting

### Common Issues

**API Authentication Failed**
- Check API credentials in `.env`
- Verify OAuth tokens are not expired
- Check API developer console for account status

**Rate Limited**
- System automatically falls back to next priority API
- Check logs for rate limit warnings
- Consider upgrading API plans

**No Products Returned**
- Check if API is enabled via feature flags
- Verify category/region mapping
- Check fallback to FakeStoreAPI

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

## License

MIT License - see LICENSE file for details.