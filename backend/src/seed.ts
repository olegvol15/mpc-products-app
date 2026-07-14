import dataSource from './data-source';
import { Product } from './products/product.entity';

const PRODUCTS: Pick<Product, 'name' | 'price' | 'totalQuantity'>[] = [
  { name: 'Aurora Hoodie', price: 89.0, totalQuantity: 25 },
  { name: 'Midnight Runner Sneakers', price: 149.5, totalQuantity: 12 },
  { name: 'Solstice Field Jacket', price: 229.0, totalQuantity: 5 },
  { name: 'Halo Cap', price: 39.0, totalQuantity: 40 },
];

/**
 * Runs on every boot in production, so by default it only fills an empty
 * catalogue — a restart (or a free-tier cold start) must never wipe the stock
 * and reservations of someone mid-purchase. Pass --force to reset the drop.
 */
async function seed(): Promise<void> {
  const force = process.argv.includes('--force');

  await dataSource.initialize();

  try {
    const products = dataSource.getRepository(Product);

    if (force) {
      await dataSource.query(
        'TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE',
      );
    } else if ((await products.count()) > 0) {
      console.log('Products already present, leaving them alone');
      return;
    }

    await products.save(
      PRODUCTS.map((product) => ({
        ...product,
        availableQuantity: product.totalQuantity,
      })),
    );

    console.log(`Seeded ${PRODUCTS.length} products`);
  } finally {
    await dataSource.destroy();
  }
}

seed().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});
