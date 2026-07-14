import { useQuery } from '@tanstack/react-query';
import { getProducts } from '../lib/api';
import ProductCard from '../components/ProductCard';

export default function ProductsPage() {
  const {
    data: products,
    isPending,
    isError,
  } = useQuery({
    queryKey: ['products'],
    queryFn: getProducts,
    // Stock moves under our feet as other buyers reserve, so keep it fresh.
    refetchInterval: 5000,
  });

  if (isPending) return <p className="state">Loading the drop…</p>;
  if (isError)
    return <p className="state state-error">Could not reach the store.</p>;

  return (
    <div className="grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
