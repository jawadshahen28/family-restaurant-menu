import FoodIcon from '../ui/FoodIcon';
import { useMenu } from '../../context/MenuContext';

export function CategoryCard({ category, selected, onSelect }) {
  return (
    <a href={`#category-${category.id}`} className={`category-card ${selected ? 'is-selected' : ''}`} aria-current={selected ? 'location' : undefined} onClick={() => onSelect(category.id)}>
      <span className="category-visual">
        <img src={category.image} alt="" width="56" height="48" loading="lazy" />
        <FoodIcon name={category.icon} />
      </span>
      <span>{category.name}</span>
    </a>
  );
}

export default function CategorySection({ selected, onSelect }) {
  const { categories } = useMenu();
  return (
    <section className="category-section" aria-labelledby="categories-title">
      <h2 className="sr-only" id="categories-title">تصفح أصنافنا</h2>
      <nav className="category-strip" aria-label="تصفح أصنافنا">
        {categories.map((category) => <CategoryCard key={category.id} category={category} selected={selected === category.id} onSelect={onSelect} />)}
      </nav>
    </section>
  );
}
