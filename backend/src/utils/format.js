// €1,234.50 - same format as the frontend
export const money = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
