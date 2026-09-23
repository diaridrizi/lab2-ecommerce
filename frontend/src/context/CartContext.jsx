import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const EMPTY = { items: [], subtotal: 0, count: 0 };

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) return setCart(EMPTY);
    setCart(await api.get('/cart'));
  }, [user]);

  // Reload the cart whenever the logged-in user changes
  useEffect(() => {
    refresh().catch(() => setCart(EMPTY));
  }, [refresh]);

  // Every cart endpoint returns the full updated cart, so we just store it
  const addItem = async (productId, quantity = 1) => setCart(await api.post('/cart/items', { productId, quantity }));
  const updateItem = async (productId, quantity) => setCart(await api.patch(`/cart/items/${productId}`, { quantity }));
  const removeItem = async (productId) => setCart(await api.del(`/cart/items/${productId}`));
  const clear = () => setCart(EMPTY);

  return (
    <CartContext.Provider value={{ cart, refresh, addItem, updateItem, removeItem, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
