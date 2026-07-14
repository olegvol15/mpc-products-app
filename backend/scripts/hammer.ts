/**
 * Fires N concurrent reservations at the scarcest seeded product and reports
 * how many succeeded. Used to demonstrate that the drop never oversells.
 *
 *   pnpm hammer [buyers]
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const BUYERS = Number(process.argv[2] ?? 50);

type Product = {
  id: string;
  name: string;
  availableQuantity: number;
  totalQuantity: number;
};

async function main(): Promise<void> {
  const products = (await (
    await fetch(`${API_URL}/products`)
  ).json()) as Product[];

  const target = products
    .filter((product) => product.availableQuantity > 0)
    .sort((a, b) => a.availableQuantity - b.availableQuantity)[0];

  if (!target) {
    console.error('Everything is sold out — run `pnpm seed` first.');
    process.exit(1);
  }

  console.log(
    `${BUYERS} buyers racing for ${target.availableQuantity} units of "${target.name}"\n`,
  );

  const responses = await Promise.all(
    Array.from({ length: BUYERS }, () =>
      fetch(`${API_URL}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: target.id }),
      }),
    ),
  );

  const reserved = responses.filter((res) => res.status === 201).length;
  const soldOut = responses.filter((res) => res.status === 409).length;

  const after = (await (
    await fetch(`${API_URL}/products/${target.id}`)
  ).json()) as Product;

  console.log(`reserved:  ${reserved}`);
  console.log(`sold out:  ${soldOut}`);
  console.log(`stock now: ${after.availableQuantity}`);
  console.log(
    `\n${reserved === target.availableQuantity - after.availableQuantity && after.availableQuantity === 0 ? '✅ no oversell' : '❌ OVERSOLD'}`,
  );
}

void main();
