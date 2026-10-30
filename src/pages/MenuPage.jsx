import { useEffect, useState } from 'react';
import Header from '../components/layout/Header';
import HeroBanner from '../components/home/HeroBanner';
import CategorySection from '../components/categories/CategorySection';
import OffersSection from '../components/offers/OffersSection';
import ProductGrid from '../components/products/ProductGrid';
import CartButton from '../components/cart/CartButton';
import FoodIcon from '../components/ui/FoodIcon';
import { useMenu } from '../context/MenuContext';
import MenuState from '../components/ui/MenuState';
import { useCart } from '../context/CartContext';
import { formatCategoryCount } from '../utils/format';

export default function MenuPage() {
  const { categories, products, loading, error, store } = useMenu();
  const [selected, setSelected] = useState('broast');
  const { count } = useCart();
  useEffect(() => {
    const sections = [...document.querySelectorAll('[data-category]')];
    let frame;
    function updateSelection() {
      frame = undefined;
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
      const offset = (document.querySelector('.category-section')?.offsetHeight || 100) + 45;
      const active = atBottom ? sections.at(-1) : sections.filter((section) => section.getBoundingClientRect().top <= offset).at(-1);
      setSelected(active?.dataset.category || 'broast');
    }
    function scheduleUpdate() {
      if (frame === undefined) frame = requestAnimationFrame(updateSelection);
    }
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    const hash = window.location.hash;
    if (hash.startsWith('#category-')) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    scheduleUpdate();
    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      cancelAnimationFrame(frame);
    };
  }, [categories]);

  return (
    <div className={count ? 'menu-page has-cart' : 'menu-page'}>
      <div className="masthead"><Header /><HeroBanner /></div>
      <main id="main-content" className="menu-content" tabIndex={-1}>
        {loading || error ? <MenuState /> : <><CategorySection selected={selected} onSelect={setSelected} />
        <div className="menu-sections">
          {store && (!store.isOpen || !store.acceptingOrders) && <p className="store-availability-notice" role="status">{!store.isOpen ? 'المطعم مغلق حاليًا، يمكنك تصفح المنيو ولكن لا يمكن إرسال طلب جديد.' : 'استقبال الطلبات متوقف حاليًا. يمكنك تصفح المنيو والمحاولة لاحقًا.'}</p>}
          {store?.announcement && <p className="store-availability-notice">{store.announcement}</p>}
          {products.length ? <OffersSection /> : <p className="store-availability-notice">القائمة قيد التحديث، جرّب مرة أخرى لاحقًا.</p>}
          <div className="menu-divider"><span /><p>كل لقمة إلها حكاية</p><span /></div>
          {categories.map((category) => <section key={category.id} id={`category-${category.id}`} data-category={category.id} className="menu-category" aria-labelledby={`heading-${category.id}`}>
            <div className="section-heading"><div className="category-heading"><span className="section-icon"><FoodIcon name={category.icon} /></span><div><p className="section-eyebrow">على ذوقك</p><h2 id={`heading-${category.id}`}>{category.name}</h2></div></div><span className="section-hint">{formatCategoryCount(products.filter((product) => product.categoryId === category.id && product.isAvailable).length)}</span></div>
            <ProductGrid products={products.filter((product) => product.categoryId === category.id && product.isAvailable)} />
          </section>)}
        </div></>}
      </main>
      {!loading && !error && <CartButton />}
    </div>
  );
}
