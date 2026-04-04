const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file
const envStr = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
let url, key;
envStr.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
});

const supabase = createClient(url, key);

const items = [
  { code: 'SP-001', name: 'Kerala Cardamom (8mm)',    category: 'SPICES',     pack: 'KG',  price: 2800, stock_quantity: 10,  low_stock_alert: 3  },
  { code: 'SP-002', name: 'Ceylon Cinnamon Quills',   category: 'SPICES',     pack: 'KG',  price: 1500, stock_quantity: 25,  low_stock_alert: 5  },
  { code: 'SP-003', name: 'Tellicherry Black Pepper',  category: 'SPICES',     pack: 'KG',  price: 850,  stock_quantity: 50,  low_stock_alert: 10 },
  { code: 'SP-004', name: 'Clove Premium',             category: 'SPICES',     pack: 'KG',  price: 1200, stock_quantity: 2,   low_stock_alert: 3  }, // LOW STOCK
  { code: 'SP-005', name: 'Kashmiri Saffron',          category: 'SPICES',     pack: 'NOS', price: 300,  stock_quantity: 100, low_stock_alert: 20 },
  { code: 'CH-001', name: 'Dark Truffle 70%',          category: 'CHOCOLATES', pack: 'NOS', price: 450,  stock_quantity: 40,  low_stock_alert: 10 },
  { code: 'CH-002', name: 'Belgian Hazelnut Praline',  category: 'CHOCOLATES', pack: 'NOS', price: 650,  stock_quantity: 4,   low_stock_alert: 5  }, // LOW STOCK
  { code: 'CH-003', name: 'Milk Cocoa Bar',            category: 'CHOCOLATES', pack: 'NOS', price: 120,  stock_quantity: 150, low_stock_alert: 20 },
  { code: 'CH-004', name: 'White Ivory Chocolate',     category: 'CHOCOLATES', pack: 'NOS', price: 250,  stock_quantity: 20,  low_stock_alert: 5  },
  { code: 'TE-001', name: 'Darjeeling First Flush',    category: 'TEA',        pack: 'KG',  price: 1200, stock_quantity: 15,  low_stock_alert: 3  },
  { code: 'TE-002', name: 'Assam CTC Premium',         category: 'TEA',        pack: 'KG',  price: 450,  stock_quantity: 40,  low_stock_alert: 8  },
  { code: 'CF-001', name: 'Arabica Roasted Beans',     category: 'COFFEE',     pack: 'KG',  price: 900,  stock_quantity: 40,  low_stock_alert: 8  },
  { code: 'CF-002', name: 'Robusta Espresso Blend',    category: 'COFFEE',     pack: 'KG',  price: 600,  stock_quantity: 3,   low_stock_alert: 5  }, // LOW STOCK
  { code: 'NT-001', name: 'Premium Cashew W240',       category: 'NUTS',       pack: 'KG',  price: 800,  stock_quantity: 20,  low_stock_alert: 4  },
  { code: 'NT-002', name: 'California Almonds',        category: 'NUTS',       pack: 'KG',  price: 950,  stock_quantity: 25,  low_stock_alert: 5  },
];

// Sample past sales for Reports testing
const sales = [
  { total_amount: 4500.00, payment_method: 'CASH',        items_json: [{ name: 'Kerala Cardamom', qty: 1, price: 2800 }, { name: 'Milk Cocoa Bar', qty: 5, price: 120 }], created_at: '2026-03-20T09:30:00Z' },
  { total_amount: 2310.00, payment_method: 'CARD/RAZORPAY',items_json: [{ name: 'Dark Truffle 70%', qty: 3, price: 450 }, { name: 'Kashmiri Saffron', qty: 5, price: 300 }], created_at: '2026-03-21T11:15:00Z' },
  { total_amount: 1890.00, payment_method: 'UPI/GPAY',    items_json: [{ name: 'Darjeeling First Flush', qty: 1, price: 1200 }, { name: 'Arabica Roasted Beans', qty: 0.75, price: 900 }], created_at: '2026-03-22T14:00:00Z' },
  { total_amount: 3675.00, payment_method: 'CASH',        items_json: [{ name: 'Ceylon Cinnamon Quills', qty: 1.5, price: 1500 }, { name: 'Belgian Hazelnut Praline', qty: 2, price: 650 }], created_at: '2026-03-24T16:45:00Z' },
  { total_amount: 1260.00, payment_method: 'UPI/GPAY',    items_json: [{ name: 'Premium Cashew W240', qty: 1, price: 800 }, { name: 'White Ivory Chocolate', qty: 1, price: 250 }], created_at: '2026-03-26T10:00:00Z' },
  { total_amount: 5850.00, payment_method: 'CARD/RAZORPAY',items_json: [{ name: 'Kerala Cardamom', qty: 2, price: 2800 }], created_at: '2026-03-27T09:00:00Z' },
];

// Sample purchases for Reports testing
const purchases = [
  { supplier: 'Kerala Spice Traders', total_amount: 18500, items_json: [{ name: 'Kerala Cardamom', qty: 5, rate: 2600 }], created_at: '2026-03-15T09:00:00Z' },
  { supplier: 'Cocoa World Imports',  total_amount: 12400, items_json: [{ name: 'Dark Truffle 70%', qty: 20, rate: 400 }, { name: 'Belgian Hazelnut Praline', qty: 10, rate: 580 }], created_at: '2026-03-18T11:00:00Z' },
  { supplier: 'Nilgiri Tea Co.',      total_amount: 9800,  items_json: [{ name: 'Darjeeling First Flush', qty: 5, rate: 1100 }, { name: 'Assam CTC', qty: 10, rate: 380 }], created_at: '2026-03-22T14:00:00Z' },
];

async function seed() {
  console.log('\n🌱  Monsoon Meridian — Seeding database...\n');

  // Items
  console.log('📦  Inserting items...');
  const { error: itemErr } = await supabase.from('items').insert(items);
  if (itemErr) console.error('   ❌ Items failed:', itemErr.message, '\n   ➡  Make sure you have run supabase_schema.sql in your Supabase SQL Editor first!');
  else console.log(`   ✅ ${items.length} items inserted`);

  // Sales
  console.log('💳  Inserting sample sales...');
  const { error: saleErr } = await supabase.from('sales').insert(sales);
  if (saleErr) console.error('   ❌ Sales failed:', saleErr.message);
  else console.log(`   ✅ ${sales.length} sales records inserted`);

  // Purchases
  console.log('🧾  Inserting sample purchases...');
  const { error: purErr } = await supabase.from('purchases').insert(purchases);
  if (purErr) console.error('   ❌ Purchases failed:', purErr.message);
  else console.log(`   ✅ ${purchases.length} purchase records inserted`);

  // Settings
  console.log('⚙️   Inserting default settings...');
  const { data: existing } = await supabase.from('settings').select('id').limit(1);
  if (!existing?.length) {
    const { error: setErr } = await supabase.from('settings').insert([{ company_name: 'Monsoon Meridian', shop_name: 'Monsoon Meridian', address: '123 Premium Arcade, Business Bay', phone: '+91 9876543210', email: 'info@monsoonmeridian.com', gst_no: '32AABCU9603R1ZX', upi_id: 'monsoonmeridian@upi' }]);
    if (setErr) console.error('   ❌ Settings failed:', setErr.message);
    else console.log('   ✅ Default settings inserted');
  } else {
    console.log('   ⏭  Settings already exist, skipping.');
  }

  console.log('\n✨  Seeding complete. Refresh your app to see the data!\n');
}

seed();
