import ProductCard from './ProductCard';

export default function ProductGrid({ products, featured = false }) {
  return <div className={`product-grid ${featured ? 'product-grid--featured' : ''}`}>
    {products.map((product, index) => <ProductCard key={product.id} product={product} large={featured && index < 2} />)}
  </div>;
}
