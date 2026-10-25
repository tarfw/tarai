// The catalog slice: the shop's one record, read by the release.
// The menu sheet, the slip and the WhatsApp message all render
// from here, so no two places on the page can ever disagree.

export type MenuItem = {
  id: string;
  name: string;
  desc: string;
  price: number;
  veg: boolean;
  star?: boolean;
};

export type MenuGroup = {
  name: string;
  items: MenuItem[];
};

export const WHATSAPP_NUMBER = "919876543210"; // sample
export const PHONE_DISPLAY = "+91 98765 43210";
export const ADDRESS_LINE_1 = "12, Bazaar Street";
export const ADDRESS_LINE_2 = "Chennai 600001, opposite the flower market";
export const GST_RATE = 0.05;

export const rupees = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const groups: MenuGroup[] = [
  {
    name: "Pizzas",
    items: [
      {
        id: "margherita",
        name: "Margherita",
        desc: "San Marzano tomato, mozzarella, basil",
        price: 149,
        veg: true,
      },
      {
        id: "farmhouse",
        name: "Farmhouse",
        desc: "Onion, capsicum, mushroom, sweet corn",
        price: 249,
        veg: true,
      },
      {
        id: "paneer-tikka",
        name: "Paneer tikka",
        desc: "Tandoori paneer, onion, mint drizzle",
        price: 279,
        veg: true,
        star: true,
      },
      {
        id: "corn-cheese",
        name: "Corn and cheese",
        desc: "Sweet corn, double mozzarella",
        price: 219,
        veg: true,
      },
      {
        id: "chicken-tikka",
        name: "Chicken tikka",
        desc: "Tandoori chicken, onion, coriander",
        price: 329,
        veg: false,
        star: true,
      },
      {
        id: "pepperoni",
        name: "Double pepperoni",
        desc: "Double pepperoni, extra mozzarella",
        price: 349,
        veg: false,
      },
    ],
  },
  {
    name: "Sides",
    items: [
      {
        id: "breadsticks",
        name: "Garlic breadsticks",
        desc: "Eight sticks, butter and herbs",
        price: 99,
        veg: true,
        star: true,
      },
      {
        id: "cheesy-dip",
        name: "Cheesy dip",
        desc: "Molten cheddar and mozzarella",
        price: 49,
        veg: true,
      },
      {
        id: "masala-fries",
        name: "Masala fries",
        desc: "Cha masala, peri-peri dust",
        price: 89,
        veg: true,
      },
      {
        id: "lava-cake",
        name: "Choco lava cake",
        desc: "Warm; one is never enough",
        price: 79,
        veg: true,
      },
    ],
  },
  {
    name: "Drinks",
    items: [
      {
        id: "lemonade",
        name: "Masala lemonade",
        desc: "Squeezed to order",
        price: 60,
        veg: true,
      },
      { id: "cola", name: "Cola", desc: "300 ml, chilled", price: 40, veg: true },
      {
        id: "cold-coffee",
        name: "Cold coffee",
        desc: "Filter kaapi, blended thick",
        price: 90,
        veg: true,
      },
    ],
  },
];

export const allItems: MenuItem[] = groups.flatMap((g) => g.items);

export const itemById = (id: string) => allItems.find((i) => i.id === id);

export const singleOrderLink = (item: MenuItem) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Pizza Corner! One ${item.name} please (${rupees(item.price)}.`
  )}`;

export const slipOrderLink = (lines: { item: MenuItem; qty: number }[]) => {
  const body = lines
    .map((l) => `${l.qty} × ${l.item.name} — ${rupees(l.item.price * l.qty)}`)
    .join("\n");
  const subtotal = lines.reduce((s, l) => s + l.item.price * l.qty, 0);
  const gst = Math.round(subtotal * GST_RATE);
  const text = `Hi Pizza Corner! My order:\n\n${body}\n\nSubtotal ${rupees(
    subtotal
  )} + GST 5% ${rupees(gst)} = ${rupees(subtotal + gst)}.\nMy address: `;
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
};
