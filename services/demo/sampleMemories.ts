// TARAI Demo Data
// 3-table schema: memories, people, tasks

import type { MemoryRecord, MemoryType, TaskType, PersonRole } from '@/types/memory';

// ============================================
// SAMPLE PEOPLE (unique IDs)
// ============================================

export const SAMPLE_PEOPLE = {
  // Sellers
  karuppu: 'person_karuppu',
  selvam: 'person_selvam',
  lakshmi: 'person_lakshmi',
  murugan: 'person_murugan',
  priya: 'person_priya',
  karthik: 'person_karthik',
  raja: 'person_raja',
  ravi: 'person_ravi',
  selvi: 'person_selvi',
  // Buyers
  kumar: 'person_kumar',
  arun: 'person_arun',
  meena: 'person_meena',
  // Drivers
  bala: 'person_bala',
  venkat: 'person_venkat',
  // Staff
  geetha: 'person_geetha',
  anand: 'person_anand',
};

// ============================================
// SAMPLE MEMORIES (commerce entities)
// ============================================

export const SAMPLE_MEMORIES: Omit<MemoryRecord, 'embedding'>[] = [
  // Transport
  {
    id: 'memory_taxi_001',
    type: 'transport',
    title: 'Karuppu - Airport Taxi Service',
    value: 350,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Reliable airport pickup and drop', tags: 'taxi,airport,chennai' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_taxi_002',
    type: 'transport',
    title: 'Selvam - City Cab (AC)',
    value: 380,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'AC cab for city travel', tags: 'taxi,city,ac' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_taxi_003',
    type: 'transport',
    title: 'Ravi - Luxury Car Service',
    value: 500,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Premium luxury car rental with driver', tags: 'luxury,car,premium' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Food
  {
    id: 'memory_food_001',
    type: 'food',
    title: "Lakshmi's Kitchen - Homemade Idli Batter",
    value: 90,
    quantity: 50,
    location: 'T Nagar',
    status: 'active',
    data: JSON.stringify({ desc: 'Fresh homemade idli batter', tags: 'idli,homemade,south indian', cuisine: 'South Indian', veg: true }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_food_002',
    type: 'food',
    title: "Selvi's Tiffin Service - Daily Meals",
    value: 150,
    quantity: 30,
    location: 'Anna Nagar',
    status: 'active',
    data: JSON.stringify({ desc: 'Daily South Indian meals delivered', tags: 'tiffin,meals,daily', cuisine: 'South Indian', veg: true }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_food_003',
    type: 'food',
    title: 'Murugan Biryani - Chicken Biryani',
    value: 250,
    quantity: 100,
    location: 'Mylapore',
    status: 'active',
    data: JSON.stringify({ desc: 'Authentic Chennai style biryani', tags: 'biryani,chicken,non-veg', cuisine: 'Mughlai', veg: false }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Service
  {
    id: 'memory_service_001',
    type: 'service',
    title: 'Selvam Plumbing - Pipe Repair',
    value: 500,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Expert plumbing repair and installation', tags: 'plumber,pipe,repair' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_service_002',
    type: 'service',
    title: 'Karthik Electrician - Wiring & Repairs',
    value: 600,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Electrical wiring and repair services', tags: 'electrician,wiring,repair' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_service_003',
    type: 'service',
    title: 'Raja AC Service - Installation & Repair',
    value: 800,
    quantity: 1,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'AC installation, repair and servicing', tags: 'ac,repair,installation' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Booking
  {
    id: 'memory_booking_001',
    type: 'booking',
    title: 'Priya Beauty Salon - Haircut',
    value: 300,
    quantity: 1,
    location: 'Adyar',
    status: 'active',
    data: JSON.stringify({ desc: 'Professional haircut and styling', tags: 'salon,haircut,beauty', duration: 45, slots: ['10:00', '11:00', '14:00', '15:00'] }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_booking_002',
    type: 'booking',
    title: 'Lakshmi Spa - Full Body Massage',
    value: 1500,
    quantity: 1,
    location: 'Nungambakkam',
    status: 'active',
    data: JSON.stringify({ desc: 'Relaxing full body massage therapy', tags: 'spa,massage,relaxation', duration: 90, slots: ['10:00', '12:00', '14:00', '16:00'] }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Product
  {
    id: 'memory_product_001',
    type: 'product',
    title: 'Murugan Stores - Fresh Vegetables',
    value: 50,
    quantity: 200,
    location: 'Koyambedu',
    status: 'active',
    data: JSON.stringify({ desc: 'Farm fresh vegetables daily', tags: 'vegetables,fresh,organic' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_product_002',
    type: 'product',
    title: 'Selvi Organic Farm - Fresh Fruits',
    value: 100,
    quantity: 150,
    location: 'Koyambedu',
    status: 'active',
    data: JSON.stringify({ desc: 'Organic farm fresh fruits', tags: 'fruits,organic,fresh' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Education
  {
    id: 'memory_edu_001',
    type: 'education',
    title: 'Karthik - Mathematics Tutoring',
    value: 500,
    quantity: 1,
    location: 'Online',
    status: 'active',
    data: JSON.stringify({ desc: 'Math tutoring for 10th-12th students', tags: 'math,tutor,education' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_edu_002',
    type: 'education',
    title: 'Priya - Spoken English Classes',
    value: 400,
    quantity: 1,
    location: 'Online',
    status: 'active',
    data: JSON.stringify({ desc: 'Improve your spoken English skills', tags: 'english,speaking,classes' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Event
  {
    id: 'memory_event_001',
    type: 'event',
    title: 'AR Rahman Concert - Chennai',
    value: 2000,
    quantity: 500,
    location: 'Nehru Stadium',
    status: 'active',
    data: JSON.stringify({ desc: 'Live concert by AR Rahman', tags: 'concert,music,rahman' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_event_002',
    type: 'event',
    title: 'Stand-up Comedy Night',
    value: 500,
    quantity: 100,
    location: 'Bharatiyar Mandapam',
    status: 'active',
    data: JSON.stringify({ desc: 'Tamil stand-up comedy show', tags: 'comedy,standup,tamil' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Rental
  {
    id: 'memory_rental_001',
    type: 'rental',
    title: 'Karuppu - Self-Drive Car Rental',
    value: 1200,
    quantity: 5,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Self-drive car rental per day', tags: 'car,rental,self-drive' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_rental_002',
    type: 'rental',
    title: 'Ravi - Bike Rental (Activa)',
    value: 300,
    quantity: 10,
    location: 'Chennai',
    status: 'active',
    data: JSON.stringify({ desc: 'Activa scooter rental per day', tags: 'bike,scooter,rental' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Digital
  {
    id: 'memory_digital_001',
    type: 'digital',
    title: 'Karthik - React Native Course',
    value: 2999,
    quantity: 1,
    location: 'Online',
    status: 'active',
    data: JSON.stringify({ desc: 'Complete React Native development course', tags: 'react,mobile,course' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Healthcare
  {
    id: 'memory_health_001',
    type: 'healthcare',
    title: 'Dr. Meena - General Consultation',
    value: 500,
    quantity: 1,
    location: 'Apollo Clinic',
    status: 'active',
    data: JSON.stringify({ desc: 'General health consultation', tags: 'doctor,consultation,health', duration: 15 }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Real Estate
  {
    id: 'memory_realestate_001',
    type: 'realestate',
    title: '2BHK Apartment - Anna Nagar',
    value: 25000,
    quantity: 1,
    location: 'Anna Nagar',
    status: 'active',
    data: JSON.stringify({ desc: 'Fully furnished 2BHK for rent', tags: 'apartment,2bhk,rent' }),
    created: Date.now(),
    updated: Date.now(),
  },

  // Sample Orders (type='order') - covering all commerce workflows
  {
    id: 'memory_order_001',
    type: 'order',
    title: 'Food Order - Biryani',
    parent: 'memory_food_003',
    value: 500,
    quantity: 2,
    location: 'T Nagar',
    status: 'pending',
    data: JSON.stringify({ items: [{ variantid: 'memory_food_003', qty: 2 }], total: 500, address: '123 T Nagar, Chennai' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_002',
    type: 'order',
    title: 'Taxi Booking - Airport',
    parent: 'memory_taxi_001',
    value: 350,
    quantity: 1,
    location: 'Airport',
    status: 'pending',
    data: JSON.stringify({ pickup: 'Chennai Airport', drop: 'T Nagar', time: '14:00' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_003',
    type: 'order',
    title: 'Salon Appointment',
    parent: 'memory_booking_001',
    value: 300,
    quantity: 1,
    location: 'Adyar',
    status: 'pending',
    data: JSON.stringify({ slot: '14:00', service: 'Haircut' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_004',
    type: 'order',
    title: 'Product Order - Vegetables',
    parent: 'memory_product_001',
    value: 250,
    quantity: 5,
    location: 'Anna Nagar',
    status: 'pending',
    data: JSON.stringify({ items: [{ variantid: 'memory_product_001', qty: 5 }], total: 250, address: '45 Anna Nagar' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_005',
    type: 'order',
    title: 'Service Order - AC Repair',
    parent: 'memory_service_003',
    value: 800,
    quantity: 1,
    location: 'T Nagar',
    status: 'progress',
    data: JSON.stringify({ service: 'AC servicing', address: '78 T Nagar' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_006',
    type: 'order',
    title: 'Rental Order - Self Drive Car',
    parent: 'memory_rental_001',
    value: 2400,
    quantity: 1,
    location: 'Chennai',
    status: 'progress',
    data: JSON.stringify({ days: 2, pickup: 'Central Station', return: 'Airport' }),
    created: Date.now(),
    updated: Date.now(),
  },
  {
    id: 'memory_order_007',
    type: 'order',
    title: 'Event Order - Concert Ticket',
    parent: 'memory_event_001',
    value: 4000,
    quantity: 2,
    location: 'Nehru Stadium',
    status: 'active',
    data: JSON.stringify({ seats: ['A12', 'A13'], eventDate: '2025-01-15' }),
    created: Date.now(),
    updated: Date.now(),
  },
];

// ============================================
// SAMPLE PEOPLE ASSOCIATIONS
// ============================================

export const SAMPLE_PEOPLE_ASSOCIATIONS: { memoryid: string; personid: string; role: PersonRole }[] = [
  // Transport sellers
  { memoryid: 'memory_taxi_001', personid: SAMPLE_PEOPLE.karuppu, role: 'seller' },
  { memoryid: 'memory_taxi_002', personid: SAMPLE_PEOPLE.selvam, role: 'seller' },
  { memoryid: 'memory_taxi_003', personid: SAMPLE_PEOPLE.ravi, role: 'seller' },

  // Food sellers
  { memoryid: 'memory_food_001', personid: SAMPLE_PEOPLE.lakshmi, role: 'seller' },
  { memoryid: 'memory_food_002', personid: SAMPLE_PEOPLE.selvi, role: 'seller' },
  { memoryid: 'memory_food_003', personid: SAMPLE_PEOPLE.murugan, role: 'seller' },

  // Service sellers
  { memoryid: 'memory_service_001', personid: SAMPLE_PEOPLE.selvam, role: 'seller' },
  { memoryid: 'memory_service_002', personid: SAMPLE_PEOPLE.karthik, role: 'seller' },
  { memoryid: 'memory_service_003', personid: SAMPLE_PEOPLE.raja, role: 'seller' },

  // Booking sellers with staff
  { memoryid: 'memory_booking_001', personid: SAMPLE_PEOPLE.priya, role: 'seller' },
  { memoryid: 'memory_booking_001', personid: SAMPLE_PEOPLE.geetha, role: 'staff' },
  { memoryid: 'memory_booking_002', personid: SAMPLE_PEOPLE.lakshmi, role: 'seller' },
  { memoryid: 'memory_booking_002', personid: SAMPLE_PEOPLE.anand, role: 'staff' },

  // Product sellers
  { memoryid: 'memory_product_001', personid: SAMPLE_PEOPLE.murugan, role: 'seller' },
  { memoryid: 'memory_product_002', personid: SAMPLE_PEOPLE.selvi, role: 'seller' },

  // Education - instructors
  { memoryid: 'memory_edu_001', personid: SAMPLE_PEOPLE.karthik, role: 'instructor' },
  { memoryid: 'memory_edu_002', personid: SAMPLE_PEOPLE.priya, role: 'instructor' },

  // Events - hosts
  { memoryid: 'memory_event_001', personid: SAMPLE_PEOPLE.raja, role: 'host' },
  { memoryid: 'memory_event_002', personid: SAMPLE_PEOPLE.karthik, role: 'host' },

  // Rentals
  { memoryid: 'memory_rental_001', personid: SAMPLE_PEOPLE.karuppu, role: 'seller' },
  { memoryid: 'memory_rental_002', personid: SAMPLE_PEOPLE.ravi, role: 'seller' },

  // Digital
  { memoryid: 'memory_digital_001', personid: SAMPLE_PEOPLE.karthik, role: 'seller' },

  // Healthcare
  { memoryid: 'memory_health_001', personid: SAMPLE_PEOPLE.meena, role: 'doctor' },

  // Real Estate
  { memoryid: 'memory_realestate_001', personid: SAMPLE_PEOPLE.raja, role: 'landlord' },

  // Order associations
  { memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.kumar, role: 'buyer' },
  { memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.murugan, role: 'seller' },
  { memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.bala, role: 'driver' },

  { memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.arun, role: 'buyer' },
  { memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, role: 'driver' },

  { memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.meena, role: 'buyer' },
  { memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.priya, role: 'seller' },
  { memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.geetha, role: 'staff' },

  { memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.arun, role: 'buyer' },
  { memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.murugan, role: 'seller' },
  { memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.venkat, role: 'driver' },

  { memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.kumar, role: 'buyer' },
  { memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.raja, role: 'seller' },
  { memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.anand, role: 'staff' },

  { memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.meena, role: 'buyer' },
  { memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.karuppu, role: 'seller' },

  { memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.kumar, role: 'buyer' },
  { memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.raja, role: 'host' },
  { memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.geetha, role: 'staff' },
];

// ============================================
// SAMPLE TASKS (comprehensive coverage)
// ============================================

export const SAMPLE_TASKS: {
  id: string;
  memoryid: string;
  personid: string;
  type: TaskType;
  title: string;
  status: 'pending' | 'progress' | 'completed' | 'cancelled';
  priority: number;
  due?: number;
  data?: string;
}[] = [
  // ========== FOOD ORDER (memory_order_001) ==========
  { id: 'task_001', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.kumar, type: 'pay', title: 'Pay for biryani order', status: 'completed', priority: 2 },
  { id: 'task_002', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.murugan, type: 'confirm', title: 'Confirm biryani order', status: 'completed', priority: 2 },
  { id: 'task_003', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.murugan, type: 'prepare', title: 'Prepare chicken biryani x2', status: 'progress', priority: 1, data: JSON.stringify({ items: ['Chicken Biryani x2'], special: 'Extra raita' }) },
  { id: 'task_004', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.murugan, type: 'ready', title: 'Mark food ready', status: 'pending', priority: 1 },
  { id: 'task_005', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.bala, type: 'collect', title: 'Collect from restaurant', status: 'pending', priority: 1 },
  { id: 'task_006', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.bala, type: 'enroute', title: 'On way to customer', status: 'pending', priority: 1 },
  { id: 'task_007', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.bala, type: 'handover', title: 'Deliver to customer', status: 'pending', priority: 1, data: JSON.stringify({ address: '123 T Nagar', contact: '+91-9876543210' }) },
  { id: 'task_008', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.kumar, type: 'receive', title: 'Confirm delivery received', status: 'pending', priority: 0 },
  { id: 'task_009', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.kumar, type: 'rate', title: 'Rate your order', status: 'pending', priority: 0 },

  // ========== TAXI BOOKING (memory_order_002) - Transport Tasks ==========
  { id: 'task_010', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.arun, type: 'pay', title: 'Pay for taxi ride', status: 'pending', priority: 2, data: JSON.stringify({ amount: 350, method: 'upi' }) },
  { id: 'task_011', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, type: 'confirm', title: 'Accept ride request', status: 'pending', priority: 2 },
  { id: 'task_012', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, type: 'dispatch', title: 'Start trip to pickup', status: 'pending', priority: 1 },
  { id: 'task_013', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, type: 'board', title: 'Pickup passenger', status: 'pending', priority: 1, due: Date.now() + 2 * 60 * 60 * 1000 },
  { id: 'task_014', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, type: 'travel', title: 'In transit to destination', status: 'pending', priority: 1 },
  { id: 'task_015', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.karuppu, type: 'alight', title: 'Drop passenger', status: 'pending', priority: 1 },
  { id: 'task_016', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.arun, type: 'settle', title: 'Complete payment', status: 'pending', priority: 1 },
  { id: 'task_017', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.arun, type: 'rate', title: 'Rate your ride', status: 'pending', priority: 0 },

  // ========== SALON BOOKING (memory_order_003) - Booking Tasks ==========
  { id: 'task_020', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.meena, type: 'pay', title: 'Pay for salon booking', status: 'completed', priority: 2 },
  { id: 'task_021', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.priya, type: 'confirm', title: 'Confirm appointment', status: 'completed', priority: 2 },
  { id: 'task_022', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.priya, type: 'schedule', title: 'Set appointment slot', status: 'completed', priority: 1 },
  { id: 'task_023', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.meena, type: 'remind', title: 'Reminder: Appointment tomorrow', status: 'completed', priority: 0 },
  { id: 'task_024', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.meena, type: 'checkin', title: 'Check in at salon', status: 'pending', priority: 1, due: Date.now() + 4 * 60 * 60 * 1000, data: JSON.stringify({ slot: '14:00', service: 'Haircut' }) },
  { id: 'task_025', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.geetha, type: 'serve', title: 'Provide haircut service', status: 'pending', priority: 1 },
  { id: 'task_026', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.geetha, type: 'complete', title: 'Mark service complete', status: 'pending', priority: 1 },
  { id: 'task_027', memoryid: 'memory_order_003', personid: SAMPLE_PEOPLE.meena, type: 'rate', title: 'Rate salon experience', status: 'pending', priority: 0 },

  // ========== PRODUCT ORDER (memory_order_004) - Product Tasks ==========
  { id: 'task_030', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.arun, type: 'pay', title: 'Pay for vegetables', status: 'completed', priority: 2 },
  { id: 'task_031', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.murugan, type: 'confirm', title: 'Confirm order', status: 'completed', priority: 2 },
  { id: 'task_032', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.murugan, type: 'pack', title: 'Pack vegetables', status: 'progress', priority: 1 },
  { id: 'task_033', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.murugan, type: 'ship', title: 'Hand to delivery', status: 'pending', priority: 1 },
  { id: 'task_034', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.venkat, type: 'pickup', title: 'Collect package', status: 'pending', priority: 1 },
  { id: 'task_035', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.venkat, type: 'transit', title: 'Package in transit', status: 'pending', priority: 1 },
  { id: 'task_036', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.venkat, type: 'deliver', title: 'Deliver package', status: 'pending', priority: 1 },
  { id: 'task_037', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.arun, type: 'receive', title: 'Confirm receipt', status: 'pending', priority: 0 },
  { id: 'task_038', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.arun, type: 'rate', title: 'Rate your purchase', status: 'pending', priority: 0 },

  // ========== SERVICE ORDER (memory_order_005) - Service Tasks ==========
  { id: 'task_040', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.kumar, type: 'pay', title: 'Pay for AC service', status: 'completed', priority: 2 },
  { id: 'task_041', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.raja, type: 'confirm', title: 'Accept service request', status: 'completed', priority: 2 },
  { id: 'task_042', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.raja, type: 'assign', title: 'Assign technician', status: 'completed', priority: 1 },
  { id: 'task_043', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.anand, type: 'arrive', title: 'Reach customer location', status: 'progress', priority: 1, due: Date.now() + 1 * 60 * 60 * 1000 },
  { id: 'task_044', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.anand, type: 'perform', title: 'Perform AC servicing', status: 'pending', priority: 1 },
  { id: 'task_045', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.kumar, type: 'verify', title: 'Verify work done', status: 'pending', priority: 1 },
  { id: 'task_046', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.kumar, type: 'rate', title: 'Rate service', status: 'pending', priority: 0 },

  // ========== RENTAL ORDER (memory_order_006) - Rental Tasks ==========
  { id: 'task_050', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.meena, type: 'pay', title: 'Pay for car rental', status: 'completed', priority: 2 },
  { id: 'task_051', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.karuppu, type: 'confirm', title: 'Confirm rental', status: 'completed', priority: 2 },
  { id: 'task_052', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.karuppu, type: 'reserve', title: 'Reserve vehicle', status: 'completed', priority: 1 },
  { id: 'task_053', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.meena, type: 'use', title: 'Using rental car', status: 'progress', priority: 1, due: Date.now() + 24 * 60 * 60 * 1000 },
  { id: 'task_054', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.meena, type: 'return', title: 'Return vehicle', status: 'pending', priority: 1, due: Date.now() + 24 * 60 * 60 * 1000 },
  { id: 'task_055', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.karuppu, type: 'inspect', title: 'Inspect returned car', status: 'pending', priority: 1 },
  { id: 'task_056', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.karuppu, type: 'close', title: 'Close rental', status: 'pending', priority: 0 },
  { id: 'task_057', memoryid: 'memory_order_006', personid: SAMPLE_PEOPLE.meena, type: 'rate', title: 'Rate rental experience', status: 'pending', priority: 0 },

  // ========== EVENT ORDER (memory_order_007) - Event Tasks ==========
  { id: 'task_060', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.kumar, type: 'pay', title: 'Pay for concert ticket', status: 'completed', priority: 2 },
  { id: 'task_061', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.raja, type: 'confirm', title: 'Confirm registration', status: 'completed', priority: 2 },
  { id: 'task_062', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.kumar, type: 'register', title: 'Complete registration', status: 'completed', priority: 1 },
  { id: 'task_063', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.raja, type: 'ticket', title: 'Issue e-ticket', status: 'completed', priority: 1 },
  { id: 'task_064', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.geetha, type: 'admit', title: 'Check-in attendee', status: 'pending', priority: 1, due: Date.now() + 48 * 60 * 60 * 1000 },
  { id: 'task_065', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.kumar, type: 'attend', title: 'Attend event', status: 'pending', priority: 0, due: Date.now() + 48 * 60 * 60 * 1000 },
  { id: 'task_066', memoryid: 'memory_order_007', personid: SAMPLE_PEOPLE.kumar, type: 'feedback', title: 'Give event feedback', status: 'pending', priority: 0 },

  // ========== Support & Notification Tasks (misc) ==========
  { id: 'task_070', memoryid: 'memory_order_001', personid: SAMPLE_PEOPLE.kumar, type: 'notify', title: 'Order confirmed notification', status: 'completed', priority: 0 },
  { id: 'task_071', memoryid: 'memory_order_004', personid: SAMPLE_PEOPLE.arun, type: 'support', title: 'Delivery delay inquiry', status: 'progress', priority: 1 },
  { id: 'task_072', memoryid: 'memory_order_002', personid: SAMPLE_PEOPLE.arun, type: 'cancel', title: 'Cancel ride (optional)', status: 'cancelled', priority: 0 },
  { id: 'task_073', memoryid: 'memory_order_005', personid: SAMPLE_PEOPLE.kumar, type: 'refund', title: 'Request partial refund', status: 'pending', priority: 1 },
];

// ============================================
// LOAD DEMO DATA FUNCTION
// ============================================

export async function loadDemoData(forceReload: boolean = false) {
  try {
    // Import services which share same DB instance
    const memoryService = await import('../memoryService');
    const peopleService = await import('../peopleService');
    const taskService = await import('../taskService');

    console.log('Loading demo data...');

    // Check existing data using service functions
    const existingMemories = await memoryService.getAllMemories();
    const existingTasks = await taskService.getAllTasks();
    console.log(`Existing: ${existingMemories.length} memories, ${existingTasks.length} tasks`);

    if (!forceReload && existingMemories.length >= SAMPLE_MEMORIES.length) {
      console.log('Demo data already loaded, skipping...');
      return { memories: existingMemories.length, tasks: existingTasks.length };
    }

    // Clear existing data if force reload - use direct SQL for clean wipe
    if (forceReload) {
      console.log('Force reload: clearing existing data...');
      const { getDb } = await import('@/services/database/db');
      const db = getDb();
      try {
        await db.execute('DELETE FROM tasks');
        await db.execute('DELETE FROM people');
        await db.execute('DELETE FROM memories');
        // Also clear vector store
        const { memoryVectorStore } = await import('@/services/vectorStores/memoryVectorStore');
        await memoryVectorStore.delete({ predicate: () => true });
        console.log('Cleared vector store');
        console.log('Cleared existing data');
      } catch (e: any) {
        console.log('Clear error:', e?.message);
      }
    }

    // Load memories with predefined IDs using service
    console.log(`Creating ${SAMPLE_MEMORIES.length} memories...`);
    let memoryCount = 0;
    for (const memory of SAMPLE_MEMORIES) {
      try {
        await memoryService.createMemory({
          id: memory.id,
          type: memory.type as MemoryType,
          title: memory.title,
          parent: memory.parent,
          data: memory.data,
          quantity: memory.quantity,
          value: memory.value,
          location: memory.location,
          status: memory.status,
        });
        memoryCount++;
      } catch (e: any) {
        console.error(`Memory ${memory.id} error:`, e?.message);
      }
    }
    console.log(`Created ${memoryCount} memories`);

    // Load people associations using service
    console.log(`Creating ${SAMPLE_PEOPLE_ASSOCIATIONS.length} people associations...`);
    let peopleCount = 0;
    for (const assoc of SAMPLE_PEOPLE_ASSOCIATIONS) {
      try {
        await peopleService.addPersonToMemory(assoc.memoryid, assoc.personid, assoc.role);
        peopleCount++;
      } catch (e: any) {
        console.error(`People ${assoc.personid} error:`, e?.message);
      }
    }
    console.log(`Created ${peopleCount} people associations`);

    // Load tasks using service
    console.log(`Creating ${SAMPLE_TASKS.length} tasks...`);
    let taskCount = 0;
    for (const task of SAMPLE_TASKS) {
      try {
        await taskService.createTask({
          memoryid: task.memoryid,
          personid: task.personid,
          type: task.type,
          title: task.title,
          status: task.status,
          priority: task.priority,
          due: task.due,
          data: task.data,
        });
        taskCount++;
      } catch (e: any) {
        console.error(`Task ${task.id} error:`, e?.message);
      }
    }
    console.log(`Created ${taskCount} tasks`);

    // Verify counts using service functions
    const finalMemories = await memoryService.getAllMemories();
    const finalPeople = await peopleService.getAllPeople();
    const finalTasks = await taskService.getAllTasks();

    console.log(`Demo data loaded: ${finalMemories.length} memories, ${finalPeople.length} people, ${finalTasks.length} tasks`);
    return { memories: finalMemories.length, people: finalPeople.length, tasks: finalTasks.length };
  } catch (error: any) {
    console.error('Failed to load demo data:', error?.message || error);
    throw error;
  }
}

// Test queries
export const TEST_QUERIES = [
  'Book taxi from airport',
  'Need plumber for leak',
  'Order food',
  'Haircut near me',
  'Math tutor for 10th',
  'Rent a car',
  'Buy vegetables',
  'Concert tickets',
  'Learn React Native',
  'AC repair service',
];
