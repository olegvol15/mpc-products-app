import { Link, Route, Routes } from 'react-router-dom';
import ProductsPage from './pages/ProductsPage';
import ProductPage from './pages/ProductPage';

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <Link to="/" className="brand">
          MPC <span>Drop</span>
        </Link>
        <p className="tagline">Limited release. Reserved for 15 minutes.</p>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<ProductsPage />} />
          <Route path="/products/:id" element={<ProductPage />} />
        </Routes>
      </main>
    </div>
  );
}
