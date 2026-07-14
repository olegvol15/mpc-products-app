import { Link } from 'react-router-dom';
import type { Product } from '../types';

const priceFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export default function ProductCard({ product }: { product: Product }) {
  const soldOut = product.availableQuantity === 0;
  const remaining = product.availableQuantity / product.totalQuantity;

  return (
    <Link
      to={`/products/${product.id}`}
      className={`card${soldOut ? ' card-sold-out' : ''}`}
    >
      <div className="card-head">
        <h2>{product.name}</h2>
        <span className="price">{priceFormat.format(product.price)}</span>
      </div>

      <div className="stock">
        <div className="stock-bar">
          <div
            className="stock-bar-fill"
            style={{ width: `${remaining * 100}%` }}
          />
        </div>
        <span className="stock-label">
          {soldOut
            ? 'Sold out'
            : `${product.availableQuantity} of ${product.totalQuantity} left`}
        </span>
      </div>
    </Link>
  );
}
