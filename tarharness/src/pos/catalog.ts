import type { ActionDefinition } from '../registry/catalog.ts';

const posInterfaceActions = [
  { id: 'pos.open', title: 'Open POS', roles: ['owner', 'admin', 'member'], effects: [] },
  { id: 'pos.setup', title: 'Manage POS', roles: ['owner', 'admin'], effects: ['settings_update'] },
  { id: 'pos.product.save', title: 'Save product', roles: ['owner', 'admin'], effects: ['product_update', 'stock_movement'] },
  { id: 'pos.product.content.save', title: 'Save product content', roles: ['owner', 'admin'], effects: ['product_content_update'] },
  { id: 'pos.stock.adjust', title: 'Adjust stock', roles: ['owner', 'admin'], effects: ['stock_movement'] },
  { id: 'pos.customer.save', title: 'Save customer', roles: ['owner', 'admin', 'member'], effects: ['customer_update'] },
  { id: 'pos.order.save', title: 'Save order for Now', roles: ['owner', 'admin', 'member'], effects: ['order_create', 'inbox'] },
  { id: 'pos.order.item.update', title: 'Update order item', roles: ['owner', 'admin', 'member'], effects: ['order_item_update', 'inbox'] },
  { id: 'pos.order.cancel', title: 'Cancel open order', roles: ['owner', 'admin', 'member'], effects: ['order_cancel', 'inbox'] },
  { id: 'pos.checkout', title: 'Complete sale', roles: ['owner', 'admin', 'member'], effects: ['order_create', 'payment_record', 'stock_movement'] },
  { id: 'pos.refund', title: 'Return sale', roles: ['owner', 'admin'], effects: ['refund_record', 'stock_movement'] },
  { id: 'pos.register.open', title: 'Open register', roles: ['owner', 'admin', 'member'], effects: ['register_open'] },
  { id: 'pos.register.close', title: 'Close register', roles: ['owner', 'admin', 'member'], effects: ['register_close'] },
].map((action) => ({ ...action, version: 1, type: 'app', description: action.title,
  interfaceKey: 'pos', fields: [], output: ['result'],
})) as readonly ActionDefinition[];

export const posActions: readonly ActionDefinition[] = [
  ...posInterfaceActions,
  { id: 'pos.register.count', version: 1, type: 'app', title: 'Count register cash', description: 'Save the drawer count for the assigned workspace review.', interfaceKey: 'form',
    fields: [{ key: 'counted', label: 'Cash counted', kind: 'number', required: true }],
    output: ['register'], roles: ['owner', 'admin', 'member'], effects: ['register_count'] },
];
