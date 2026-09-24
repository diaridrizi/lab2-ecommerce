import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const EMPTY = { items: [], subtotal: 0, count: 0 };

// Query string that identifies a cart line (same product in two sizes = two lines)
const sizeQuery = (size) => (size ? `?size=${encodeURIComponent(size)}` : '');

export function CartProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [loaded, setLoaded] = useState(false); // false until the first fetch finishes (so pages don't think the cart is empty)
  const [drawerOpen, setDrawerOpen] = useState(false); // the slide-in mini cart

  const refresh = useCallback(async () => {
    if (!user) return setCart(EMPTY);
    setCart(await api.get('/cart'));
  }, [user]);

  // Reload the cart whenever the logged-in user changes (wait until we know who is logged in)
  useEffect(() => {
    if (authLoading) return;
    refresh()
      .catch(() => setCart(EMPTY))
      .finally(() => setLoaded(true));
  }, [refresh, authLoading]);

  // Every cart endpoint returns the full updated cart, so we just store it
  const addItem = async (productId, quantity = 1, size = null) =>
    setCart(await api.post('/cart/items', { productId, quantity, size }));
  const updateItem = async (productId, size, quantity) =>
    setCart(await api.patch(`/cart/items/${productId}${sizeQuery(size)}`, { quantity }));
  const removeItem = async (productId, size) => setCart(await api.del(`/cart/items/${productId}${sizeQuery(size)}`));
  const clear = () => setCart(EMPTY);

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  return (
    <CartContext.Provider value={{ cart, loaded, refresh, addItem, updateItem, removeItem, clear, drawerOpen, openDrawer, closeDrawer }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
