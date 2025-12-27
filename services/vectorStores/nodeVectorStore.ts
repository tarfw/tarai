// TARAI Node Vector Store
// Using all-MiniLM-L6-v2 (384D) for semantic search
// Following: https://blog.swmansion.com/building-an-ai-powered-note-taking-app-in-react-native-part-1-text-semantic-search

import { RecursiveCharacterTextSplitter } from 'react-native-rag';
import { OPSQLiteVectorStore } from '@react-native-rag/op-sqlite';
import { ExecuTorchEmbeddings } from '@react-native-rag/executorch';
import { ALL_MINILM_L6_V2 } from 'react-native-executorch';

console.log('[VectorStore] Initializing with ALL_MINILM_L6_V2:', JSON.stringify(ALL_MINILM_L6_V2, null, 2));

// Vector store with embedding model (exactly as blog shows)
export const nodeVectorStore = new OPSQLiteVectorStore({
  name: 'tarai_node_vectors',
  embeddings: new ExecuTorchEmbeddings(ALL_MINILM_L6_V2),
});

console.log('[VectorStore] OPSQLiteVectorStore created');

// Convert node to searchable string
export const nodeToString = (node: {
  title: string;
  type: string;
  data?: string;
}) => {
  const parsed = node.data ? JSON.parse(node.data) : {};
  return `${node.type}: ${node.title}. ${parsed.desc || ''} ${parsed.tags || ''}`;
};

// Text splitter for long content
export const nodeSplitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 100,
});

// Commerce categories (12 types)
export const COMMERCE_CATEGORIES: Record<
  string,
  { icon: string; label: string; examples: string[] }
> = {
  product: {
    icon: '📦',
    label: 'Products',
    examples: ['Electronics', 'Fashion', 'Home', 'Grocery', 'Books'],
  },
  digital: {
    icon: '💾',
    label: 'Digital',
    examples: ['Software', 'eBooks', 'Music', 'Templates', 'Courses'],
  },
  service: {
    icon: '🔧',
    label: 'Services',
    examples: ['Plumbing', 'Electrical', 'Cleaning', 'Repair', 'Painting'],
  },
  subscription: {
    icon: '🔄',
    label: 'Subscriptions',
    examples: ['Memberships', 'SaaS', 'Streaming', 'Fitness', 'Meal Plans'],
  },
  booking: {
    icon: '📅',
    label: 'Bookings',
    examples: ['Salon', 'Doctor', 'Spa', 'Consultant', 'Restaurant'],
  },
  rental: {
    icon: '🏠',
    label: 'Rentals',
    examples: ['Cars', 'Equipment', 'Bikes', 'Tools', 'Venues'],
  },
  event: {
    icon: '🎉',
    label: 'Events',
    examples: ['Concerts', 'Workshops', 'Sports', 'Festivals', 'Shows'],
  },
  food: {
    icon: '🍔',
    label: 'Food',
    examples: ['Restaurant', 'Cloud Kitchen', 'Homemade', 'Bakery', 'Tiffin'],
  },
  transport: {
    icon: '🚗',
    label: 'Transport',
    examples: ['Taxi', 'Auto', 'Courier', 'Moving', 'Logistics'],
  },
  education: {
    icon: '📚',
    label: 'Education',
    examples: ['Tutoring', 'Courses', 'Coaching', 'Training', 'Classes'],
  },
  realestate: {
    icon: '🏢',
    label: 'Real Estate',
    examples: ['Apartments', 'Houses', 'PG', 'Commercial', 'Land'],
  },
  healthcare: {
    icon: '🏥',
    label: 'Healthcare',
    examples: ['Consultation', 'Lab Tests', 'Pharmacy', 'Therapy', 'Nursing'],
  },
};

// Task type categories
export const TASK_CATEGORIES: Record<
  string,
  { icon: string; label: string; examples: string[] }
> = {
  pay: { icon: '💳', label: 'Payment', examples: ['Pay for order'] },
  confirm: { icon: '✅', label: 'Confirm', examples: ['Accept order'] },
  prepare: { icon: '👨‍🍳', label: 'Prepare', examples: ['Cook food', 'Pack items'] },
  pickup: { icon: '📍', label: 'Pickup', examples: ['Collect package'] },
  deliver: { icon: '🚚', label: 'Deliver', examples: ['Drop to customer'] },
  receive: { icon: '📬', label: 'Receive', examples: ['Confirm delivery'] },
  rate: { icon: '⭐', label: 'Rate', examples: ['Review order'] },
  checkin: { icon: '🎫', label: 'Check-in', examples: ['Arrive at venue'] },
  serve: { icon: '🛎️', label: 'Serve', examples: ['Provide service'] },
  complete: { icon: '🏁', label: 'Complete', examples: ['Mark done'] },
};

// Person role categories
export const ROLE_CATEGORIES: Record<
  string,
  { icon: string; label: string }
> = {
  seller: { icon: '🏪', label: 'Seller' },
  buyer: { icon: '🛒', label: 'Buyer' },
  staff: { icon: '👔', label: 'Staff' },
  driver: { icon: '🚗', label: 'Driver' },
  host: { icon: '🎤', label: 'Host' },
  instructor: { icon: '👨‍🏫', label: 'Instructor' },
  student: { icon: '🎓', label: 'Student' },
  doctor: { icon: '👨‍⚕️', label: 'Doctor' },
  patient: { icon: '🤒', label: 'Patient' },
  landlord: { icon: '🏠', label: 'Landlord' },
  tenant: { icon: '🔑', label: 'Tenant' },
  agent: { icon: '🤝', label: 'Agent' },
  manager: { icon: '👨‍💼', label: 'Manager' },
  support: { icon: '🎧', label: 'Support' },
};
