import { Route, Routes, Outlet, useLocation } from 'react-router';
import { useEffect } from 'react';
import MenuPage from './pages/MenuPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderSuccessPage from './pages/OrderSuccessPage';
import AdminLoginPage from './pages/admin/AdminLoginPage';
import AdminHomePage from './pages/admin/AdminHomePage';
import CategoriesListPage from './pages/admin/categories/CategoriesListPage';
import CategoryFormPage from './pages/admin/categories/CategoryFormPage';
import ProductsListPage from './pages/admin/products/ProductsListPage';
import ProductFormPage from './pages/admin/products/ProductFormPage';
import OffersListPage from './pages/admin/offers/OffersListPage';
import OfferFormPage from './pages/admin/offers/OfferFormPage';
import SettingsPage from './pages/admin/settings/SettingsPage';
import OrdersListPage from './pages/admin/orders/OrdersListPage';
import OrderDetailsPage from './pages/admin/orders/OrderDetailsPage';
import ProtectedAdminRoute from './components/admin/layout/ProtectedAdminRoute';
import { AdminAuthProvider } from './context/AdminAuthContext';
import Footer from './components/layout/Footer';
import Toast from './components/ui/Toast';
import './styles/checkout.css';
import './styles/api.css';

function AdminBoundary() {
  return (
    <AdminAuthProvider>
      <Outlet />
    </AdminAuthProvider>
  );
}

export default function App() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [pathname]);

  const isAdminRoute = pathname.startsWith('/admin');

  return (
    <div className={isAdminRoute ? 'admin-root' : 'app-shell'}>
      <a className="skip-link" href="#main-content">انتقل إلى المحتوى</a>
      <Routes>
        {/* Customer Facing Routes */}
        <Route path="/" element={<MenuPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:orderId" element={<OrderSuccessPage />} />
        <Route path="/order-success" element={<OrderSuccessPage />} />

        {/* Admin Routes Isolated under AdminAuthProvider */}
        <Route path="/admin" element={<AdminBoundary />}>
          <Route
            index
            element={
              <ProtectedAdminRoute>
                <AdminHomePage />
              </ProtectedAdminRoute>
            }
          />
          <Route path="login" element={<AdminLoginPage />} />
          <Route
            path="categories"
            element={
              <ProtectedAdminRoute>
                <CategoriesListPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="categories/new"
            element={
              <ProtectedAdminRoute>
                <CategoryFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="categories/:id/edit"
            element={
              <ProtectedAdminRoute>
                <CategoryFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="products"
            element={
              <ProtectedAdminRoute>
                <ProductsListPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="products/new"
            element={
              <ProtectedAdminRoute>
                <ProductFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="products/:id/edit"
            element={
              <ProtectedAdminRoute>
                <ProductFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="offers"
            element={
              <ProtectedAdminRoute>
                <OffersListPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="offers/new"
            element={
              <ProtectedAdminRoute>
                <OfferFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="offers/:id/edit"
            element={
              <ProtectedAdminRoute>
                <OfferFormPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedAdminRoute>
                <SettingsPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedAdminRoute>
                <OrdersListPage />
              </ProtectedAdminRoute>
            }
          />
          <Route
            path="orders/:id"
            element={
              <ProtectedAdminRoute>
                <OrderDetailsPage />
              </ProtectedAdminRoute>
            }
          />
        </Route>

        <Route path="*" element={<MenuPage />} />
      </Routes>
      {!isAdminRoute && <Footer />}
      <Toast />
    </div>
  );
}
