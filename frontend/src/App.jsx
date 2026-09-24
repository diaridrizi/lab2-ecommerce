import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import CartDrawer from './components/CartDrawer.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Home from './pages/Home.jsx';
import Shop from './pages/Shop.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Cart from './pages/Cart.jsx';
import Checkout from './pages/Checkout.jsx';
import Orders from './pages/Orders.jsx';
import OrderDetail from './pages/OrderDetail.jsx';
import Account from './pages/Account.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import NotFound from './pages/NotFound.jsx';
import AdminLayout from './pages/admin/AdminLayout.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminProducts from './pages/admin/AdminProducts.jsx';
import AdminCategories from './pages/admin/AdminCategories.jsx';
import AdminOrders from './pages/admin/AdminOrders.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';
import AdminDelivery from './pages/admin/AdminDelivery.jsx';
import AdminBanners from './pages/admin/AdminBanners.jsx';
import AdminReviews from './pages/admin/AdminReviews.jsx';
import AdminSubscribers from './pages/admin/AdminSubscribers.jsx';

export default function App() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Start every new page at the top
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <>
      <Navbar />
      {/* The homepage uses full-width banners, other pages sit in a centered container */}
      <main className={isHome ? 'home-main' : 'container'}>
        {/* key on the path so every page change replays the fade-in */}
        <div key={location.pathname} className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/products/:slug" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Logged-in customers */}
          <Route element={<ProtectedRoute />}>
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/account" element={<Account />} />
          </Route>

          {/* Admins only */}
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="categories" element={<AdminCategories />} />
              <Route path="orders" element={<AdminOrders />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="delivery" element={<AdminDelivery />} />
              <Route path="banners" element={<AdminBanners />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="subscribers" element={<AdminSubscribers />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        </div>
      </main>
      <Footer />
      <CartDrawer />
    </>
  );
}
