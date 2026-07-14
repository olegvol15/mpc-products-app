import dataSource from './data-source';
import { Product } from './products/product.entity';

const PRODUCTS: Pick<Product, 'name' | 'price' | 'totalQuantity'>[] = [
  { name: 'Aurora Hoodie', price: 89.0, totalQuantity: 25 },
  { name: 'Midnight Runner Sneakers', price: 149.5, totalQuantity: 12 },
  { name: 'Solstice Field Jacket', price: 229.0, totalQuantity: 5 },
  { name: 'Halo Cap', price: 39.0, totalQuantity: 40 },
];

async function seed(): Promise<void> {
  await dataSource.initialize();

  try {
    await dataSource.query(
      'TRUNCATE TABLE "reservations", "products" RESTART IDENTITY CASCADE',
    );

    await dataSource.getRepository(Product).save(
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
