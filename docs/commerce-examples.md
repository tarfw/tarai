# Commerce Agent System - Usage Examples

## Complete guide with practical examples for all commerce tools and workflows

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Basic Operations](#basic-operations)
3. [Product Management](#product-management)
4. [Order Processing](#order-processing)
5. [Service Booking](#service-booking)
6. [Advanced Search](#advanced-search)
7. [Reviews & Ratings](#reviews--ratings)
8. [Workflows](#workflows)
9. [Real-World Scenarios](#real-world-scenarios)

---

## Getting Started

### Import Tools

```typescript
import {
  productTool,
  orderTool,
  serviceTool,
  nodeTool,
  contributorTool,
  taskTool,
  transactionTool,
  searchTool,
  reviewTool,
} from './tools/commerce';
```

### Import Workflows

```typescript
import {
  orderProcessingWorkflow,
  serviceBookingWorkflow,
  productDiscoveryWorkflow,
  taskExecutionWorkflow,
} from './workflows/commerce';
```

---

## Basic Operations

### 1. Create a Business Node

```typescript
// Create a restaurant
const restaurant = await nodeTool.execute({
  action: 'create',
  name: 'Tasty Bites Restaurant',
  type: 'restaurant',
  address: '123 Food Street',
  city: 'Bangalore',
  lat: 12.9716,
  lng: 77.5946,
  phone: '+91 98765 43210',
  email: 'contact@tastybites.com',
});

console.log(`Restaurant created: ${restaurant.nodeid}`);
```

### 2. Create a Customer

```typescript
// Create a customer account
const customer = await contributorTool.execute({
  action: 'create',
  name: 'John Doe',
  email: 'john@example.com',
  phone: '+91 98765 12345',
  role: 'customer',
  address: '456 Main Street',
  city: 'Bangalore',
});

console.log(`Customer created: ${customer.contributorid}`);
```

---

## Product Management

### 1. Create a Product with Variants

```typescript
// Step 1: Create base product
const tshirt = await productTool.execute({
  action: 'create',
  nodeid: 'store-123',
  name: 'Premium Cotton T-Shirt',
  desc: 'Comfortable 100% cotton t-shirt',
  category: 'Apparel',
  price: 599, // Base price
  stock: 0, // Managed via instances
  currency: 'INR',
});

// Step 2: Create variants (instances)
const variants = [
  { name: 'Small - Black', attrs: { size: 'S', color: 'Black' }, qty: 10, priceadd: 0 },
  { name: 'Medium - Black', attrs: { size: 'M', color: 'Black' }, qty: 15, priceadd: 0 },
  { name: 'Large - Black', attrs: { size: 'L', color: 'Black' }, qty: 12, priceadd: 50 },
  { name: 'Small - White', attrs: { size: 'S', color: 'White' }, qty: 8, priceadd: 0 },
  { name: 'Medium - White', attrs: { size: 'M', color: 'White' }, qty: 20, priceadd: 0 },
  { name: 'Large - White', attrs: { size: 'L', color: 'White' }, qty: 10, priceadd: 50 },
];

for (const variant of variants) {
  await productTool.execute({
    action: 'createInstance',
    productId: tshirt.productId,
    nodeid: 'store-123',
    instanceName: variant.name,
    instanceType: 'variant',
    qty: variant.qty,
    attrs: variant.attrs,
    priceadd: variant.priceadd,
  });
}

console.log('Product with 6 variants created!');
```

### 2. Update Product Price

```typescript
// Update base price
await productTool.execute({
  action: 'update',
  productId: 'prod-123',
  price: 699,
});

// Update variant price adjustment
await productTool.execute({
  action: 'updateInstance',
  instanceId: 'instance-large-black',
  priceadd: 100, // Now Large is ₹100 more expensive
});
```

### 3. Check Stock Availability

```typescript
// Check if instance has sufficient stock
const availability = await productTool.execute({
  action: 'checkAvailability',
  instanceId: 'instance-medium-white',
  qty: 5,
});

if (availability.available) {
  console.log(`✅ ${availability.currentQty} units available`);
} else {
  console.log(`❌ Only ${availability.currentQty} units available, need ${availability.requestedQty}`);
}
```

### 4. Search Products

```typescript
// Basic search
const results = await productTool.execute({
  action: 'search',
  query: 't-shirt',
  limit: 20,
});

// Search within specific node
const storeProducts = await productTool.execute({
  action: 'search',
  query: 'cotton',
  nodeid: 'store-123',
  limit: 50,
});
```

---

## Order Processing

### 1. Create a Simple Order

```typescript
const order = await orderTool.execute({
  action: 'create',
  contributorid: 'cust-123',
  nodeid: 'store-123',
  ordertype: 'store',
  items: [
    {
      productId: 'prod-tshirt',
      instanceId: 'instance-medium-black',
      name: 'Premium T-Shirt - Medium Black',
      qty: 2,
      unitprice: 599,
    },
    {
      productId: 'prod-jeans',
      name: 'Blue Jeans',
      qty: 1,
      unitprice: 1299,
    },
  ],
});

console.log(`Order created: ${order.ordernum}`);
console.log(`Total: ₹${order.total}`);
```

### 2. Food Delivery Order

```typescript
const foodOrder = await orderTool.execute({
  action: 'create',
  contributorid: 'cust-456',
  nodeid: 'restaurant-123',
  ordertype: 'food',
  items: [
    {
      productId: 'food-pizza',
      instanceId: 'instance-large-margherita',
      name: 'Large Margherita Pizza',
      qty: 1,
      unitprice: 450,
    },
    {
      productId: 'food-coke',
      name: 'Coca Cola 500ml',
      qty: 2,
      unitprice: 40,
    },
  ],
  address: '789 Delivery Street, Bangalore',
  phone: '+91 98765 11111',
});

console.log(`Food order created: ${foodOrder.ordernum}`);
```

### 3. Track Order Status

```typescript
// Update order through workflow stages
await orderTool.execute({
  action: 'updateStatus',
  orderId: 'order-123',
  status: 'confirmed',
});

await orderTool.execute({
  action: 'updateStatus',
  orderId: 'order-123',
  status: 'preparing',
});

await orderTool.execute({
  action: 'updateStatus',
  orderId: 'order-123',
  status: 'outfordelivery',
});

await orderTool.execute({
  action: 'updateStatus',
  orderId: 'order-123',
  status: 'delivered',
});
```

### 4. Get Customer Order History

```typescript
const history = await orderTool.execute({
  action: 'getByContributor',
  contributorid: 'cust-123',
  limit: 20,
});

console.log(`Customer has ${history.orders.length} orders`);
```

---

## Service Booking

### 1. Create a Service

```typescript
// Create a doctor consultation service
const service = await serviceTool.execute({
  action: 'createService',
  nodeid: 'clinic-123',
  name: 'General Consultation',
  desc: 'General health checkup and consultation',
  category: 'medical',
  price: 500,
  duration: 30, // 30 minutes
});

console.log(`Service created: ${service.serviceId}`);
```

### 2. Generate Time Slots

```typescript
// Create multiple slots for a day
const timeSlots = [
  { start: '09:00', end: '09:30' },
  { start: '09:30', end: '10:00' },
  { start: '10:00', end: '10:30' },
  { start: '10:30', end: '11:00' },
  { start: '11:00', end: '11:30' },
  { start: '14:00', end: '14:30' },
  { start: '14:30', end: '15:00' },
  { start: '15:00', end: '15:30' },
];

for (const slot of timeSlots) {
  await serviceTool.execute({
    action: 'createSlots',
    serviceId: 'service-consultation',
    nodeid: 'clinic-123',
    date: '2025-12-15',
    start: slot.start,
    end: slot.end,
  });
}

console.log(`Created ${timeSlots.length} time slots`);
```

### 3. Book an Appointment

```typescript
// Step 1: Check available slots
const availableSlots = await serviceTool.execute({
  action: 'getAvailableSlots',
  serviceId: 'service-consultation',
  date: '2025-12-15',
});

console.log(`${availableSlots.slots.length} slots available`);

// Step 2: Book a slot
const booking = await serviceTool.execute({
  action: 'createBooking',
  contributorid: 'patient-123',
  serviceId: 'service-consultation',
  nodeid: 'clinic-123',
  slotId: availableSlots.slots[0].id,
  date: '2025-12-15',
  start: '09:00',
  end: '09:30',
  duration: 30,
  price: 500,
  customerName: 'Jane Smith',
  phone: '+91 98765 22222',
  notes: 'First time visit',
});

console.log(`Appointment booked: ${booking.bookingnum}`);
```

### 4. Cancel Booking

```typescript
await serviceTool.execute({
  action: 'cancelBooking',
  bookingId: 'booking-123',
  slotId: 'slot-456', // Will be released
});

console.log('Booking cancelled and slot released');
```

---

## Advanced Search

### 1. Search Products with Filters

```typescript
// Search with price range
const affordableProducts = await searchTool.execute({
  action: 'products',
  query: 'laptop',
  minPrice: 30000,
  maxPrice: 50000,
  limit: 10,
});

console.log(`Found ${affordableProducts.totalFound} laptops in budget`);
```

### 2. Find Nearby Businesses

```typescript
// Find restaurants within 5km
const nearbyRestaurants = await searchTool.execute({
  action: 'nearMe',
  lat: 12.9716,
  lng: 77.5946,
  radius: 5, // km
  type: 'restaurant',
  limit: 20,
});

nearbyRestaurants.nodes.forEach(restaurant => {
  console.log(`${restaurant.name} - ${restaurant.distance}km away`);
});
```

### 3. Search Services by Category

```typescript
const medicalServices = await searchTool.execute({
  action: 'services',
  category: 'medical',
  city: 'Bangalore',
  limit: 15,
});

console.log(`Found ${medicalServices.totalFound} medical services`);
```

### 4. Semantic Search (Natural Language)

```typescript
// Search using natural language
const results = await searchTool.execute({
  action: 'semantic',
  query: 'comfortable running shoes for jogging',
  limit: 10,
});

// Currently falls back to text search
// Future: Will use vector embeddings for better results
```

---

## Reviews & Ratings

### 1. Create a Review

```typescript
const review = await reviewTool.execute({
  action: 'create',
  contributorid: 'cust-123',
  targettype: 'product',
  targetid: 'prod-tshirt',
  rating: 5,
  comment: 'Excellent quality! Very comfortable to wear.',
  images: ['https://example.com/review-image.jpg'],
});

console.log(`Review submitted: ${review.reviewId}`);
```

### 2. Get Product Reviews

```typescript
const productReviews = await reviewTool.execute({
  action: 'getByTarget',
  targettype: 'product',
  targetid: 'prod-tshirt',
  limit: 20,
});

console.log(`Product Rating: ${productReviews.averageRating}/5`);
console.log(`Total Reviews: ${productReviews.totalReviews}`);

productReviews.reviews.forEach(review => {
  console.log(`⭐ ${review.rating}/5 - ${review.comment}`);
});
```

### 3. Review a Service

```typescript
await reviewTool.execute({
  action: 'create',
  contributorid: 'patient-123',
  targettype: 'service',
  targetid: 'service-consultation',
  rating: 4,
  comment: 'Doctor was very professional and helpful.',
});
```

### 4. Review a Business Node

```typescript
await reviewTool.execute({
  action: 'create',
  contributorid: 'cust-789',
  targettype: 'node',
  targetid: 'restaurant-123',
  rating: 5,
  comment: 'Great ambiance, delicious food, excellent service!',
});
```

### 5. Verify Reviews (Admin)

```typescript
// Admin verifies legitimate reviews
await reviewTool.execute({
  action: 'verify',
  reviewId: 'review-123',
});
```

---

## Workflows

### 1. Order Processing Workflow

```typescript
// Complete order workflow with validation, task creation, payment
const result = await orderProcessingWorkflow.run({
  contributorid: 'cust-123',
  nodeid: 'store-456',
  items: [
    {
      productId: 'prod-phone',
      instanceId: 'instance-blue-128gb',
      name: 'Smartphone - Blue 128GB',
      qty: 1,
      unitprice: 25000,
    },
  ],
  ordertype: 'delivery',
  address: '123 Home Street',
  phone: '+91 98765 33333',
});

if (result.success) {
  console.log(`✅ Order ${result.ordernum} processed successfully`);
  console.log(`Total: ₹${result.total}`);
  console.log(`Tasks created: ${result.tasks.length}`);
} else {
  console.log(`❌ ${result.message}`);
}
```

### 2. Service Booking Workflow

```typescript
// Complete booking workflow with slot validation, confirmation
const bookingResult = await serviceBookingWorkflow.run({
  contributorid: 'patient-456',
  serviceId: 'service-haircut',
  nodeid: 'salon-123',
  date: '2025-12-20',
  start: '15:00',
  customerName: 'Alice Johnson',
  phone: '+91 98765 44444',
  email: 'alice@example.com',
  notes: 'Prefer stylist Sarah',
});

if (bookingResult.success) {
  console.log(`✅ Booking ${bookingResult.bookingnum} confirmed`);
} else {
  console.log(`❌ ${bookingResult.message}`);
}
```

### 3. Product Discovery Workflow

```typescript
// Intelligent product discovery with ranking
const discoveryResult = await productDiscoveryWorkflow.run({
  query: 'wireless headphones',
  nodeid: 'electronics-store',
  limit: 10,
});

console.log(`Found ${discoveryResult.totalFound} products`);

discoveryResult.products.forEach(product => {
  console.log(`${product.name} - ₹${product.price} (Score: ${product.score})`);
  console.log(`  Available instances: ${product.availableInstances.length}`);
});
```

### 4. Task Execution Workflow

```typescript
// Execute delivery task with location tracking and OTP
const taskResult = await taskExecutionWorkflow.run({
  taskId: 'task-deliver-123',
  assignedto: 'driver-789',
  lat: 12.9716,
  lng: 77.5946,
  otp: '1234',
});

if (taskResult.success) {
  console.log(`✅ Task completed: ${taskResult.status}`);
}
```

---

## Real-World Scenarios

### Scenario 1: E-Commerce Store Setup

```typescript
// Complete setup for an electronics store

// 1. Create the store
const store = await nodeTool.execute({
  action: 'create',
  name: 'TechHub Electronics',
  type: 'store',
  address: 'MG Road, Bangalore',
  city: 'Bangalore',
  lat: 12.9716,
  lng: 77.5946,
  phone: '+91 80 12345678',
  email: 'info@techhub.com',
});

// 2. Add product catalog
const products = [
  { name: 'iPhone 15', category: 'Smartphones', price: 79900, stock: 10 },
  { name: 'Samsung Galaxy S24', category: 'Smartphones', price: 74999, stock: 15 },
  { name: 'MacBook Air M3', category: 'Laptops', price: 114900, stock: 5 },
  { name: 'Dell XPS 13', category: 'Laptops', price: 109990, stock: 8 },
  { name: 'Sony WH-1000XM5', category: 'Audio', price: 29990, stock: 20 },
];

for (const product of products) {
  await productTool.execute({
    action: 'create',
    nodeid: store.nodeid,
    ...product,
  });
}

// 3. Create product variants
// (Example: iPhone colors and storage)

console.log('✅ Electronics store setup complete!');
```

### Scenario 2: Restaurant with Delivery

```typescript
// Restaurant setup with menu and delivery

// 1. Create restaurant
const restaurant = await nodeTool.execute({
  action: 'create',
  name: 'Pizza Paradise',
  type: 'restaurant',
  address: 'Koramangala, Bangalore',
  city: 'Bangalore',
  lat: 12.9352,
  lng: 77.6245,
  phone: '+91 80 98765432',
});

// 2. Add menu items
const menu = [
  { name: 'Margherita Pizza (Small)', category: 'Pizza', price: 249, stock: 100 },
  { name: 'Margherita Pizza (Large)', category: 'Pizza', price: 449, stock: 100 },
  { name: 'Pepperoni Pizza (Small)', category: 'Pizza', price: 299, stock: 100 },
  { name: 'Pepperoni Pizza (Large)', category: 'Pizza', price: 499, stock: 100 },
  { name: 'Garlic Bread', category: 'Sides', price: 129, stock: 100 },
  { name: 'Coca Cola', category: 'Beverages', price: 50, stock: 100 },
];

for (const item of menu) {
  await productTool.execute({
    action: 'create',
    nodeid: restaurant.nodeid,
    ...item,
  });
}

// 3. Process delivery order
const deliveryOrder = await orderProcessingWorkflow.run({
  contributorid: 'hungry-customer',
  nodeid: restaurant.nodeid,
  items: [
    { productId: 'pizza-margherita-large', name: 'Margherita Large', qty: 2, unitprice: 449 },
    { productId: 'garlic-bread', name: 'Garlic Bread', qty: 1, unitprice: 129 },
    { productId: 'coke', name: 'Coca Cola', qty: 2, unitprice: 50 },
  ],
  ordertype: 'food',
  address: 'HSR Layout, Bangalore',
  phone: '+91 98765 55555',
});

console.log(`Order ${deliveryOrder.ordernum} placed for delivery!`);
```

### Scenario 3: Doctor Clinic with Appointments

```typescript
// Medical clinic with appointment booking

// 1. Create clinic
const clinic = await nodeTool.execute({
  action: 'create',
  name: 'HealthCare Clinic',
  type: 'doctor',
  address: 'Indiranagar, Bangalore',
  city: 'Bangalore',
  lat: 12.9784,
  lng: 77.6408,
  phone: '+91 80 11112222',
  email: 'care@healthcare.com',
});

// 2. Add services
const consultationService = await serviceTool.execute({
  action: 'createService',
  nodeid: clinic.nodeid,
  name: 'General Consultation',
  category: 'medical',
  price: 500,
  duration: 30,
});

const specialistService = await serviceTool.execute({
  action: 'createService',
  nodeid: clinic.nodeid,
  name: 'Specialist Consultation',
  category: 'medical',
  price: 1000,
  duration: 45,
});

// 3. Generate weekly schedule
const days = ['2025-12-15', '2025-12-16', '2025-12-17', '2025-12-18', '2025-12-19'];
const morningSlots = [
  '09:00-09:30', '09:30-10:00', '10:00-10:30', '10:30-11:00', '11:00-11:30'
];
const eveningSlots = [
  '14:00-14:30', '14:30-15:00', '15:00-15:30', '15:30-16:00', '16:00-16:30'
];

for (const day of days) {
  for (const slot of [...morningSlots, ...eveningSlots]) {
    const [start, end] = slot.split('-');
    await serviceTool.execute({
      action: 'createSlots',
      serviceId: consultationService.serviceId,
      nodeid: clinic.nodeid,
      date: day,
      start,
      end,
    });
  }
}

// 4. Book appointment
const appointment = await serviceBookingWorkflow.run({
  contributorid: 'patient-123',
  serviceId: consultationService.serviceId,
  nodeid: clinic.nodeid,
  date: '2025-12-15',
  start: '10:00',
  customerName: 'Bob Wilson',
  phone: '+91 98765 66666',
  email: 'bob@example.com',
  notes: 'Regular checkup',
});

console.log(`Appointment confirmed for Dec 15, 10:00 AM`);
```

### Scenario 4: Multi-Location Inventory

```typescript
// Product available at multiple locations (instances at different nodes)

// 1. Create base product (centralized)
const product = await productTool.execute({
  action: 'create',
  nodeid: 'warehouse-main',
  name: 'Popular T-Shirt Design',
  category: 'Apparel',
  price: 599,
  stock: 0, // Managed via instances
});

// 2. Create instances at different store locations
const locations = [
  { nodeid: 'store-koramangala', qty: 50 },
  { nodeid: 'store-whitefield', qty: 30 },
  { nodeid: 'store-jayanagar', qty: 40 },
];

for (const location of locations) {
  await productTool.execute({
    action: 'createInstance',
    productId: product.productId,
    nodeid: location.nodeid,
    instanceName: `Stock at ${location.nodeid}`,
    instanceType: 'inventory',
    qty: location.qty,
    priceadd: 0,
  });
}

// 3. Check availability across all locations
const instances = await productTool.execute({
  action: 'getInstances',
  productId: product.productId,
});

console.log(`Product available at ${instances.instances.length} locations`);
instances.instances.forEach(instance => {
  console.log(`  ${instance.node.name}: ${instance.qty} units`);
});
```

---

## Best Practices

### 1. Always Check Availability Before Orders

```typescript
// ❌ Bad: Create order without checking
const order = await orderTool.execute({ /* ... */ });

// ✅ Good: Use workflow that includes validation
const result = await orderProcessingWorkflow.run({ /* ... */ });
```

### 2. Use Workflows for Complex Operations

```typescript
// ✅ Workflows handle validation, tasks, transactions automatically
const result = await orderProcessingWorkflow.run({
  /* ... */
});
```

### 3. Update Instance Quantities, Not Product Stock

```typescript
// ❌ Don't update product.stock directly
// ✅ Update instance quantities
await productTool.execute({
  action: 'updateInstance',
  instanceId: 'instance-123',
  qty: newQuantity,
});
```

### 4. Always Create Transactions for Payments

```typescript
// After successful order/booking
await transactionTool.execute({
  action: 'create',
  orderid: order.orderId,
  contributorid: customer.id,
  nodeid: store.id,
  amount: order.total,
  paymethod: 'card',
  payref: paymentGatewayRef,
});
```

### 5. Use Search Tool for Discovery

```typescript
// ❌ Don't manually filter products
// ✅ Use search tool with filters
const results = await searchTool.execute({
  action: 'products',
  query: 'laptop',
  minPrice: 30000,
  maxPrice: 50000,
});
```

---

## Error Handling

```typescript
// Always handle errors properly
try {
  const result = await orderTool.execute({
    action: 'create',
    /* ... */
  });

  if (!result.success) {
    console.error(`Order failed: ${result.message}`);
    // Handle failure case
    return;
  }

  console.log(`Order created: ${result.ordernum}`);
} catch (error) {
  console.error('Unexpected error:', error);
  // Handle exception
}
```

---

## Performance Tips

1. **Batch Operations**: Create multiple instances in parallel
2. **Limit Results**: Always specify reasonable limits for queries
3. **Use Indexed Fields**: Filter by status, date for faster queries
4. **Cache Node Details**: Don't repeatedly fetch same node info
5. **Workflows for Complex Ops**: Let workflows handle coordination

---

## Next Steps

- Explore the **Test Suite** (`src/tests/commerce.test.ts`) for more examples
- Check **Workflow** implementations for best practices
- Read the **Schema Documentation** (`docs/commercefw.md`) for data structures
- Implement **Custom Workflows** for your specific use cases

---

**Happy Building! 🚀**
