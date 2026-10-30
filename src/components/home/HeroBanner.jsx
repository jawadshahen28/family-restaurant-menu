import { ChefHat, Heart, Drumstick } from 'lucide-react';

export default function HeroBanner() {
  return (
    <section className="hero-banner" aria-labelledby="hero-title">
      <svg className="hero-swoosh" viewBox="0 0 900 100" preserveAspectRatio="none" aria-hidden="true"><path fill="#ffc63d" d="M0 90C160 0 250 0 430 62S700-50 900 42V90C730 10 650 100 440 90S160 40 0 100Z" /></svg>
      <img className="hero-food" src="/images/hero-chicken.webp" alt="دجاج بروست ذهبي مقرمش مع البطاطا والسلطة والصوص" width="388" height="295" fetchPriority="high" />
      <div className="hero-copy">
        <p className="hero-eyebrow">قرمشة بتجمعنا</p>
        <h1 id="hero-title">أشهى البروست<br /><span>والدجاج المقلي</span></h1>
        <p className="hero-tagline">بطعم العائلة… دايمًا غير</p>
      </div>
      <div className="hero-promises" aria-label="من مطبخ العائلة">
        <span><Heart /><span>طعم لا يُقاوم</span></span>
        <span><ChefHat /><span>وصفتنا الخاصة</span></span>
        <span><Drumstick /><span>مكونات طازجة</span></span>
      </div>
      <div className="hero-flourish" aria-hidden="true"><Drumstick /><Drumstick /><Flourish /></div>
    </section>
  );
}

function Flourish() { return <svg viewBox="0 0 44 44"><path d="m8 22 8 3M17 8l4 9M32 10l-4 8M35 32l-8-3" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>; }
