# Chennai Commerce Scenarios - Testing Prompts

This document contains example prompts for testing all node types and scenarios in Chennai.

---

## 1. STORE - Clothing Store (T-Shirt Shop in T. Nagar)

### Create Store Node
```
Create a new store node:
- Name: "Chennai Tees"
- Type: store
- Address: "123 Usman Road, T. Nagar, Chennai"
- City: "Chennai"
- Lat: 13.0418
- Lng: 80.2341
- Phone: "+91 98765 43210"
- Email: "sales@chennaitees.com"
- Open: "10:00"
- Close: "21:00"
- Days: "Mon-Sun"
- Commission: 5
- Rating: 4.5
```

### Create Products with Variants
```
Create a product for node ID: [node-id]
- Name: "Classic Cotton T-Shirt"
- Description: "Premium 100% cotton t-shirt with vibrant colors"
- Category: "Apparel"
- Price: 499
- Currency: "INR"
- Stock: 75

Then create variants (instances) for Product ID: [product-id]:
1. Small - Black (Qty: 10, Price add: 0)
2. Medium - Black (Qty: 15, Price add: 0)
3. Large - Black (Qty: 12, Price add: 50)
4. Small - White (Qty: 8, Price add: 0)
5. Medium - White (Qty: 20, Price add: 0)
6. Large - White (Qty: 10, Price add: 50)
```

### Create Order
```
Create an order for customer "Rajesh Kumar" at Chennai Tees:
- Node ID: [node-id]
- User ID: [user-id]
- Items:
  * 2x Medium - Black T-Shirt @ 499 each
  * 1x Large - White T-Shirt @ 549
- Delivery Address: "45 Anna Nagar West, Chennai 600040"
- Phone: "+91 98765 11111"
- Delivery Fee: 50
- Tax: 89
```

---

## 2. STORE - Electronics Store (Mobile Accessories in Ritchie Street)

### Create Store Node
```
Create a new store:
- Name: "Tech Zone Chennai"
- Type: store
- Address: "89 Ritchie Street, Chennai"
- City: "Chennai"
- Phone: "+91 98765 99999"
- Open: "09:00"
- Close: "20:00"
- Days: "Mon-Sat"
- Commission: 3
- Rating: 4.2
```

### Create Products with Inventory Instances
```
Create product "Samsung Fast Charger 25W":
- Category: "Electronics"
- Price: 1299
- Stock: 150
- Description: "Original Samsung 25W fast charger with type-C cable"

Create inventory instances:
1. Warehouse A - Ritchie Street (Qty: 100, Instance type: inventory)
2. Warehouse B - Ambattur (Qty: 50, Instance type: inventory)
```

### Create Product with Unique Instances (Serial Numbers)
```
Create product "Apple AirPods Pro":
- Price: 24900
- Stock: 5

Create unique instances with serial numbers:
1. Serial: AP-CH-001, Status: available
2. Serial: AP-CH-002, Status: available
3. Serial: AP-CH-003, Status: available
4. Serial: AP-CH-004, Status: reserved
5. Serial: AP-CH-005, Status: sold
```

---

## 3. RESTAURANT - South Indian Restaurant (Mylapore)

### Create Restaurant Node
```
Create a restaurant:
- Name: "Saravana Bhavan Express"
- Type: restaurant
- Address: "234 Luz Church Road, Mylapore, Chennai"
- City: "Chennai"
- Lat: 13.0339
- Lng: 80.2619
- Phone: "+91 98765 22222"
- Open: "07:00"
- Close: "22:00"
- Days: "Mon-Sun"
- Commission: 7
- Rating: 4.7
```

### Create Food Products
```
Create products:

1. Masala Dosa
   - Price: 80
   - Category: "Breakfast"
   - Stock: 999 (high availability)
   - Description: "Crispy dosa with potato masala filling"

2. Filter Coffee
   - Price: 40
   - Category: "Beverages"
   - Stock: 999

3. Idli Sambar (Plate)
   - Price: 60
   - Category: "Breakfast"
   - Stock: 999
```

### Create Food Order
```
Create order for "Priya Sharma":
- Node: Saravana Bhavan Express
- Items:
  * 2x Masala Dosa @ 80 each
  * 3x Filter Coffee @ 40 each
  * 1x Idli Sambar @ 60
- Delivery Address: "12 Kutchery Road, Mylapore, Chennai 600004"
- Delivery Fee: 30
- Order Type: "food"
- Notes: "Extra chutney please"
```

---

## 4. RESTAURANT - Cloud Kitchen (Multiple Cuisines)

### Create Restaurant
```
Create cloud kitchen:
- Name: "Flavors of Chennai"
- Type: restaurant
- Address: "567 OMR, Sholinganallur, Chennai"
- City: "Chennai"
- Phone: "+91 98765 33333"
- Open: "11:00"
- Close: "23:00"
- Days: "Mon-Sun"
- Commission: 10
```

### Create Products with Customization
```
Create product "Chicken Biryani":
- Price: 250
- Category: "Biryani"

Create variants:
1. Regular (Qty: 50, Price add: 0)
2. Large (Qty: 30, Price add: 100)
3. Family Pack (Qty: 10, Price add: 300)

Create product "Veg Fried Rice":
- Price: 150
- Category: "Chinese"
```

---

## 5. SERVICE - Taxi Service (Airport Transfers)

### Create Service Node
```
Create taxi service:
- Name: "Chennai Cabs 24/7"
- Type: service
- Address: "Airport Road, Meenambakkam, Chennai"
- City: "Chennai"
- Phone: "+91 98765 44444"
- Open: "00:00"
- Close: "23:59"
- Days: "Mon-Sun"
- Commission: 15
- Rating: 4.4
```

### Create Service Offerings
```
Create service "Airport Drop":
- Category: "Transport"
- Price: 500
- Price Type: "fixed"
- Duration: 60 (minutes)
- Description: "Comfortable ride to Chennai Airport"

Create service "Hourly Rental":
- Price: 200
- Price Type: "hourly"
- Duration: 60
```

### Create Asset Instances (Taxi Fleet)
```
Create instances for "Airport Drop" service:

1. Sedan - Swift Dzire (Instance type: asset)
   - Attrs: { model: "Swift Dzire", year: 2022, plate: "TN01AB1234", color: "White" }
   - Status: available

2. Sedan - Honda City (Instance type: asset)
   - Attrs: { model: "Honda City", year: 2021, plate: "TN09CD5678", color: "Silver" }
   - Status: available

3. SUV - Innova Crysta (Instance type: asset)
   - Attrs: { model: "Innova Crysta", year: 2023, plate: "TN07EF9012", color: "Grey" }
   - Price add: 300
   - Status: available
```

### Create Booking
```
Create booking for "Arun Prasad":
- Service: Airport Drop
- Date: "2025-12-15"
- Time: "06:00"
- Instance: TN01AB1234 (Swift Dzire)
- Pickup: "Anna Nagar, Chennai"
- Drop: "Chennai International Airport"
- Notes: "Early morning flight, please be on time"
```

---

## 6. SERVICE - Home Tutoring

### Create Service Node
```
Create tutoring service:
- Name: "Chennai Tutors Hub"
- Type: service
- Address: "789 Adyar, Chennai"
- City: "Chennai"
- Phone: "+91 98765 55555"
- Email: "info@chennaitutors.com"
- Open: "08:00"
- Close: "20:00"
- Days: "Mon-Sat"
- Commission: 20
```

### Create Services with Capacity
```
Create service "Class 10 Maths Coaching":
- Category: "Education"
- Price: 800
- Price Type: "hourly"
- Duration: 60
- Max per slot: 5 (small batch)

Create time slots for date "2025-12-15":
1. 08:00-09:00 (Capacity: 5, Booked: 0)
2. 09:00-10:00 (Capacity: 5, Booked: 3)
3. 16:00-17:00 (Capacity: 5, Booked: 1)
4. 17:00-18:00 (Capacity: 5, Booked: 0)
```

### Create Booking
```
Book slot for "Kavya Menon":
- Service: Class 10 Maths Coaching
- Date: "2025-12-15"
- Slot: 08:00-09:00
- Price: 800
- Notes: "Needs help with algebra and geometry"
```

---

## 7. DOCTOR - Dental Clinic (Adyar)

### Create Doctor Node
```
Create dental clinic:
- Name: "Dr. Ramesh Dental Care"
- Type: doctor
- Address: "456 TTK Road, Adyar, Chennai"
- City: "Chennai"
- Lat: 13.0067
- Lng: 80.2206
- Phone: "+91 98765 66666"
- Email: "appointments@rameshdentalcare.com"
- Open: "09:00"
- Close: "18:00"
- Days: "Mon-Sat"
- Commission: 10
- Rating: 4.8
```

### Create Services
```
Create services:

1. General Checkup
   - Price: 500
   - Duration: 30 minutes
   - Category: "Dental"
   - Need Approval: false

2. Root Canal Treatment
   - Price: 8000
   - Duration: 90 minutes
   - Category: "Dental"
   - Need Approval: true

3. Teeth Whitening
   - Price: 5000
   - Duration: 60 minutes
   - Category: "Cosmetic"
   - Need Approval: false
```

### Create Appointment Slots
```
Create slots for "General Checkup" on "2025-12-15":
1. 09:00-09:30
2. 09:30-10:00
3. 10:00-10:30
4. 11:00-11:30
5. 14:00-14:30
6. 14:30-15:00
7. 15:00-15:30
8. 16:00-16:30
```

### Create Booking
```
Book appointment for "Lakshmi Narayan":
- Service: General Checkup
- Date: "2025-12-15"
- Slot: 09:00-09:30
- Phone: "+91 98765 77777"
- Email: "lakshmi@example.com"
- Notes: "Tooth sensitivity issue"
```

---

## 8. DOCTOR - Multi-Doctor Clinic (T. Nagar)

### Create Clinic
```
Create medical clinic:
- Name: "Chennai Wellness Center"
- Type: doctor
- Address: "123 Pondy Bazaar, T. Nagar, Chennai"
- City: "Chennai"
- Phone: "+91 98765 88888"
- Open: "08:00"
- Close: "21:00"
- Days: "Mon-Sun"
- Commission: 8
```

### Create Services for Different Doctors
```
Create services:

1. Dr. Suresh - General Physician
   - Price: 600
   - Duration: 20
   - Max per slot: 3

2. Dr. Meena - Pediatrician
   - Price: 700
   - Duration: 20
   - Max per slot: 2

3. Dr. Kumar - Orthopedic
   - Price: 1000
   - Duration: 30
   - Max per slot: 1
   - Need Approval: true
```

---

## 9. SALON - Unisex Salon (Velachery)

### Create Salon Node
```
Create salon:
- Name: "Style Studio Chennai"
- Type: salon
- Address: "234 Velachery Main Road, Chennai"
- City: "Chennai"
- Lat: 12.9750
- Lng: 80.2167
- Phone: "+91 98765 99000"
- Email: "booking@stylestudio.com"
- Open: "09:00"
- Close: "20:00"
- Days: "Tue-Sun"
- Commission: 12
- Rating: 4.6
```

### Create Services
```
Create services:

1. Men's Haircut
   - Price: 300
   - Duration: 30
   - Category: "Haircut"
   - Max per slot: 2

2. Women's Haircut
   - Price: 500
   - Duration: 45
   - Category: "Haircut"
   - Max per slot: 2

3. Hair Spa Treatment
   - Price: 2000
   - Duration: 90
   - Category: "Treatment"
   - Max per slot: 1

4. Bridal Makeup
   - Price: 8000
   - Duration: 120
   - Category: "Bridal"
   - Max per slot: 1
   - Need Approval: true
```

### Create Time Slots
```
Create slots for "Men's Haircut" on "2025-12-15":
1. 09:00-09:30 (Capacity: 2, Booked: 0)
2. 09:30-10:00 (Capacity: 2, Booked: 1)
3. 10:00-10:30 (Capacity: 2, Booked: 2) - FULL
4. 11:00-11:30 (Capacity: 2, Booked: 0)
5. 14:00-14:30 (Capacity: 2, Booked: 1)
```

### Create Booking
```
Book appointment for "Vikram Patel":
- Service: Men's Haircut
- Date: "2025-12-15"
- Slot: 09:00-09:30
- Phone: "+91 98765 11000"
- Notes: "Regular customer, trim beard also"
```

---

## 10. SALON - Spa & Wellness (Nungambakkam)

### Create Salon
```
Create spa:
- Name: "Serenity Spa Chennai"
- Type: salon
- Address: "567 Nungambakkam High Road, Chennai"
- City: "Chennai"
- Phone: "+91 98765 22000"
- Open: "10:00"
- Close: "22:00"
- Days: "Mon-Sun"
- Commission: 15
- Rating: 4.9
```

### Create Premium Services
```
Create services:

1. Swedish Massage (60 min)
   - Price: 3500
   - Duration: 60
   - Category: "Massage"

2. Full Body Aromatherapy (90 min)
   - Price: 5000
   - Duration: 90
   - Category: "Massage"

3. Couple's Spa Package
   - Price: 12000
   - Duration: 120
   - Category: "Package"
   - Max per slot: 2
```

---

## 11. COMPLETE WORKFLOW SCENARIOS

### Scenario A: Store - Inventory Management
```
1. Create store "Chennai Books" in Egmore
2. Add product "Rich Dad Poor Dad" with 3 warehouse locations:
   - Egmore Store (Qty: 50)
   - Gopalapuram Warehouse (Qty: 200)
   - Online Warehouse (Qty: 100)
3. Customer orders 5 copies
4. Reserve inventory from Egmore Store
5. Complete order and update inventory
```

### Scenario B: Restaurant - Peak Hours
```
1. Create restaurant "Madras Meals" in Mylapore
2. Add lunch items (Meals, Biryani, etc.)
3. Create 10 simultaneous orders between 12:30-13:00
4. Track order preparation tasks
5. Assign delivery drivers
6. Update order statuses
```

### Scenario C: Service - Multi-Asset Booking
```
1. Create taxi service "Chennai Rides"
2. Add 5 vehicles as asset instances
3. Customer books 2 sedans and 1 SUV for wedding
4. Block time slots for all vehicles
5. Assign drivers to each vehicle
6. Track locations in real-time
```

### Scenario D: Doctor - Emergency Slot
```
1. Create clinic "Dr. Kumar Clinic"
2. Set up regular appointment slots
3. Emergency patient needs immediate slot
4. Block a slot and create booking
5. Send confirmation with OTP
6. Complete appointment and update status
```

### Scenario E: Salon - Package Booking
```
1. Create salon "Bridal Beauty Chennai"
2. Create "Complete Bridal Package" service
3. Customer books package for wedding
4. Multiple service instances over 3 days
5. Track each service completion
6. Payment in installments
```

---

## 12. SEARCH & DISCOVERY SCENARIOS

### Location-Based Search
```
"Find all restaurants within 5km of Anna Nagar"
"Show me salons near Adyar that are open now"
"List all stores in T. Nagar with rating above 4.5"
```

### Service Search
```
"Find dentists available tomorrow morning"
"Show taxi services with SUV available"
"Find tutors for Class 10 Maths in Chennai"
```

### Product Search
```
"Search for Samsung chargers under 2000 rupees"
"Show t-shirts in medium size, black color"
"Find biryani restaurants with delivery"
```

---

## 13. INSTANCE TYPE EXAMPLES

### Variant Instances (Size/Color/Model variations)
- T-Shirts: Small/Medium/Large × Colors
- Mobile Phones: Storage variants (64GB/128GB/256GB)
- Shoes: Size variations

### Inventory Instances (Multiple warehouses/locations)
- Books across 3 warehouse locations
- Food items in different branches
- Electronics in multiple stores

### Capacity Instances (Time-based slots)
- Tutoring class slots (max 5 students each)
- Restaurant table bookings
- Gym session slots

### Asset Instances (Physical unique assets)
- Taxi fleet (each car is unique)
- Rental bikes (each tracked separately)
- Medical equipment

### Unique Instances (Serial numbered items)
- iPhones with IMEI numbers
- Laptops with serial numbers
- Warranty-tracked products

---

## 14. CHENNAI-SPECIFIC USE CASES

### Beach Road Food Delivery
```
Create restaurant "Marina Beach Snacks"
Products: Sundal, Murukku, Ice Cream
High volume weekend orders
```

### Silk Saree Store in Kanchipuram
```
Create store "Kumaran Silks"
Products: Kanchipuram silk sarees with unique piece numbers
Price range: 5000-50000 INR
```

### Auto-Rickshaw Service
```
Create service "Chennai Autos"
Asset instances: 50 autos with registration numbers
Fare calculation by distance
```

### Flower Market in Mylapore
```
Create store "Temple Flowers"
Fresh inventory daily
Products: Jasmine, Rose, Marigold
Bulk ordering for weddings
```

### Tiffin Service (Dabba Wala)
```
Create restaurant "Chennai Tiffin Express"
Subscription-based daily meal delivery
Multiple meal plans (Veg/Non-veg)
```

---

**Notes:**
- Replace `[node-id]`, `[product-id]`, `[user-id]` with actual IDs from your InstantDB
- All prices in INR (Indian Rupees)
- Lat/Lng coordinates are approximate Chennai locations
- Phone numbers are examples (use +91 prefix for India)
- Adjust commission % based on your business model
