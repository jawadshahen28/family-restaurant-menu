import { Menu, ShoppingCart, X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { useEffect, useRef, useState } from 'react';
import logo from '../../assets/logo.png';
import { useCart } from '../../context/CartContext';
import { useMenu } from '../../context/MenuContext';
import FoodIcon from '../ui/FoodIcon';
import { formatItemCount } from '../../utils/format';

export default function Header({ compact = false }) {
  const { categories } = useMenu();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const buttonRef = useRef();
  useEffect(() => {
    if (!menuOpen) return;
    function close(event) {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && (menuRef.current?.contains(event.target) || buttonRef.current?.contains(event.target))) return;
      setMenuOpen(false);
      if (event.type === 'keydown') buttonRef.current?.focus();
    }
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, [menuOpen]);

  return (
    <header className={`brand-header ${compact ? 'brand-header--compact' : ''}`}>
      <div className="header-inner">
        <Link to="/cart" className="circle-button header-cart" aria-label={`السلة، ${formatItemCount(count)}`}>
          <ShoppingCart size={25} strokeWidth={1.8} />
          {count > 0 && <span className="count-badge">{count}</span>}
        </Link>
        <Link to="/" className="brand-logo" aria-label="مطعم ومطبخ العائلة — الرئيسية">
          <img src={logo} alt="مطعم ومطبخ العائلة" width="447" height="447" fetchPriority="high" />
        </Link>
        {compact ? (
          <Link to="/" className="circle-button header-menu" aria-label="العودة للقائمة"><ArrowRight size={25} /></Link>
        ) : (
          <button ref={buttonRef} type="button" className="circle-button header-menu" aria-label={menuOpen ? 'إغلاق قائمة الأقسام' : 'فتح قائمة الأقسام'} aria-expanded={menuOpen} aria-controls="header-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={25} /> : <Menu size={25} />}
          </button>
        )}
        {menuOpen && <nav ref={menuRef} id="header-navigation" className="header-navigation" aria-label="أقسام القائمة">
          <strong>شو حاب تاكل اليوم؟</strong>
          {categories.map((category) => <a key={category.id} href={`/#category-${category.id}`} onClick={() => setMenuOpen(false)}><FoodIcon name={category.icon} />{category.name}</a>)}
        </nav>}
      </div>
    </header>
  );
}
