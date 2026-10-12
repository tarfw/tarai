/**
 * The store a recipe is checked against at build time (parai §5.4). It is deliberately
 * ordinary and mirrors the shapes the builder really has: a `Brief` of goal and audience,
 * a `Facts` bag of what the merchant told us, the page anchors the compiler points at, and
 * a handful of photos, items and services. A recipe that could never be filled from a real
 * store fails here instead of in a merchant's preview.
 */

import { type Facts } from '../../src/site/build.ts';
import type { Asset, Brief } from '../../src/site/document.ts';
import type { SlotFacts } from '../../src/site/recipes/slots.ts';

export const sampleBrief: Brief = {
  goal: 'Fresh food, made to order',
  audience: 'neighbours within three kilometres',
  tone: 'warm',
  voice: 'plain and short',
};

export const sampleStoreFacts: Facts = {
  name: 'Sample Store',
  city: 'Chennai',
  notice: 'Kitchen open until midnight this week',
  hours: ['Tue to Sun, 11:00 to 22:00'],
  address: '12 Beach Road, Chennai',
  phone: '+91 90000 00000',
  email: 'hello@example.test',
  proofs: ['1,200 orders filled'],
  season: 'Pongal',
  minimum: '200',
  features: ['Cooked to order', 'Ready in twenty minutes'],
  questions: [{ q: 'Do you deliver?', a: 'Within three kilometres.' }],
  terms: ['Paid on delivery', 'Return within seven days'],
  items: [{ id: 'sample-item', title: 'Filter coffee', price: 90 }],
  services: [{ id: 'sample-service', title: 'Table for four' }],
};

export const samplePhotos: Asset[] = ['sample-photo', 'sample-photo-two', 'sample-photo-three'].map((id) => ({
  id,
  kind: 'image',
  key: `workspaces/sample/sites/sample/${id}.jpg`,
  mime: 'image/jpeg',
  bytes: 1,
  hash: id,
  width: 1200,
  height: 900,
  alt: `${id} photo`,
  rights: { source: 'merchant', license: 'owned by the store', approved: true },
}));

export const sampleFacts: SlotFacts = {
  brief: { ...sampleBrief },
  facts: { ...sampleStoreFacts },
  route: {
    primary: '#menu',
    catalog: '#catalog',
    menu: '#menu',
    booking: '#booking',
    story: '#story',
    contact: '/contact',
  },
  photos: samplePhotos.map((asset) => asset.id),
  items: [
    { title: 'Filter coffee', price: '90', description: 'Two hundred millilitres.' },
    { title: 'Ghee roast', price: '180', description: 'Served with chutney.' },
  ],
  services: [
    { title: 'Table for four', price: 'free', description: 'Reserved for an hour.' },
  ],
};
