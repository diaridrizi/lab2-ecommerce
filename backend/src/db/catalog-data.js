// Demo catalog used by seed.js.
// Photos are from Unsplash (free to use, https://unsplash.com/license). `photo` is the
// Unsplash photo id; the downloaded file lives in frontend/public/images/products/<slug>.jpg

export const categories = ['Sneakers', 'Clothing', 'Accessories'];

// Size runs. Products get the run of their category unless they set `sizes` themselves.
// Accessories without `sizes` are "one size".
export const SIZE_RUNS = {
  Sneakers: ['38', '39', '40', '40.5', '41', '42', '42.5', '43', '44', '45', '46'],
  Clothing: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
};
const JEANS = ['28', '30', '32', '34', '36'];
const SOCKS = ['36-40', '41-46'];

// stock     = total stock; for sized products seed.js spreads it over the sizes
// compareAt = old price shown crossed out (null = not on sale)
// daysAgo   = how long ago the product was added (drives "New" badges and "Newest" sort)
export const products = [
  // ---------- Sneakers ----------
  { name: 'Air Jordan 1 Retro High OG "Bred"', brand: 'Jordan', category: 'Sneakers', price: 189.9, compareAt: null, stock: 3, daysAgo: 1,
    photo: '1552346154-21d32810aba3', description: 'The shoe that started it all. Full-grain leather upper in the iconic black and red colourway, Air cushioning and a classic high-top silhouette.' },
  { name: 'Nike Air Max 90', brand: 'Nike', category: 'Sneakers', price: 149.9, compareAt: null, stock: 14, daysAgo: 2,
    photo: '1514989940723-e8e51635b782', description: 'Waffle outsole, stitched overlays and a visible Max Air unit — the 90s runner that became a streetwear legend.' },
  { name: 'Nike SB Dunk High Pro', brand: 'Nike SB', category: 'Sneakers', price: 119.9, compareAt: null, stock: 2, daysAgo: 3,
    photo: '1584735175315-9d5df23860e6', description: 'Padded high-top collar, Zoom Air insole and a grippy cupsole built for skating.' },
  { name: 'Air Jordan 12 Retro "Gym Red"', brand: 'Jordan', category: 'Sneakers', price: 199.9, compareAt: null, stock: 6, daysAgo: 4,
    photo: '1575537302964-96cd47c06b1b', description: 'Tumbled leather upper with stitched radial lines, full-length Zoom Air and a bold all-red look.' },
  { name: 'Nike Air Force 1 Shadow', brand: 'Nike', category: 'Sneakers', price: 129.9, compareAt: null, stock: 11, daysAgo: 5,
    photo: '1595950653106-6c9ebd614d3a', description: 'Layered pastel overlays and a doubled-up Swoosh give the classic AF1 a playful twist.' },
  { name: 'Air Jordan 1 Mid', brand: 'Jordan', category: 'Sneakers', price: 139.9, compareAt: null, stock: 9, daysAgo: 6,
    photo: '1597045566677-8cf032ed6634', description: 'Everyday Jordan: leather and synthetic upper, encapsulated Air in the heel and the famous Wings logo.' },
  { name: 'Nike Air Force 1 High \'07', brand: 'Nike', category: 'Sneakers', price: 139.9, compareAt: null, stock: 8, daysAgo: 9,
    photo: '1512374382149-233c42b6a83b', description: 'Crisp white leather, adjustable ankle strap and the cushioning that made the AF1 an icon.' },
  { name: 'Nike Air Force 1 \'07 LV8 Utility', brand: 'Nike', category: 'Sneakers', price: 129.9, compareAt: null, stock: 10, daysAgo: 12,
    photo: '1543508282-6319a3e2621f', description: 'All-black leather upper with utility details and a toggle lace lock.' },
  { name: 'Nike Air Max 1', brand: 'Nike', category: 'Sneakers', price: 104.9, compareAt: 149.9, stock: 7, daysAgo: 20,
    photo: '1600185365483-26d7a4cc7519', description: 'The original visible-Air runner from 1987, with a mesh and suede upper.' },
  { name: 'Nike Air Force 1 \'07 Premium', brand: 'Nike', category: 'Sneakers', price: 139.9, compareAt: null, stock: 12, daysAgo: 25,
    photo: '1549298916-b41d501d3772', description: 'Wheat-toned nubuck, tonal stitching and a gum-style outsole.' },
  { name: 'Nike Free RN Flyknit', brand: 'Nike', category: 'Sneakers', price: 89.9, compareAt: 129.9, stock: 15, daysAgo: 30,
    photo: '1542291026-7eec264c27ff', description: 'Sock-like Flyknit upper and a flexible sole for a barefoot feel on every run.' },
  { name: 'Nike React Vision', brand: 'Nike', category: 'Sneakers', price: 99.9, compareAt: 139.9, stock: 9, daysAgo: 34,
    photo: '1560769629-975ec94e6a86', description: 'Dream-inspired layers of colour and texture on top of soft React foam.' },
  { name: 'Nike SB Zoom Janoski', brand: 'Nike SB', category: 'Sneakers', price: 84.9, compareAt: 109.9, stock: 13, daysAgo: 40,
    photo: '1460353581641-37baddab0fa2', description: 'Slim, low-profile skate shoe with a breathable mesh upper and Zoom Air insole.' },
  { name: 'Nike SuperRep Go', brand: 'Nike', category: 'Sneakers', price: 69.9, compareAt: 99.9, stock: 18, daysAgo: 45,
    photo: '1606107557195-0e29a4b5b4aa', description: 'Volt training shoe with a wide, stable base for circuit workouts.' },
  { name: 'Nike React Infinity Run', brand: 'Nike', category: 'Sneakers', price: 159.9, compareAt: null, stock: 10, daysAgo: 50,
    photo: '1491553895911-0055eca6402d', description: 'Plush React foam and a rocker shape designed to keep you running.' },
  { name: 'New Balance 247', brand: 'New Balance', category: 'Sneakers', price: 89.9, compareAt: 119.9, stock: 8, daysAgo: 55,
    photo: '1539185441755-769473a23570', description: 'Olive knit upper, REVlite cushioning and a big N on the side.' },
  { name: 'adidas Deerupt Runner', brand: 'adidas', category: 'Sneakers', price: 79.9, compareAt: 109.9, stock: 12, daysAgo: 60,
    photo: '1562183241-b937e95585b6', description: 'Grid-mesh upper wrapped over a slim, flexible runner.' },
  { name: 'Vans Old Skool', brand: 'Vans', category: 'Sneakers', price: 84.9, compareAt: null, stock: 25, daysAgo: 70,
    photo: '1525966222134-fcfa99b8ae77', description: 'Burgundy canvas and suede with the Sidestripe — the skate classic since 1977.' },
  { name: 'Puma Court Classic', brand: 'Puma', category: 'Sneakers', price: 64.9, compareAt: 79.9, stock: 20, daysAgo: 80,
    photo: '1608231387042-66d1773070a5', description: 'Clean white leather tennis-inspired sneaker for every day.' },
  { name: 'Golden Goose Super-Star', brand: 'Golden Goose', category: 'Sneakers', price: 449.0, compareAt: null, stock: 4, daysAgo: 90,
    photo: '1587563871167-1ee9c731aefb', description: 'Handmade in Italy with a star patch and a hand-finished look.' },

  // ---------- Clothing ----------
  { name: 'Club Fleece Hoodie', brand: 'Nike', category: 'Clothing', price: 69.9, compareAt: null, stock: 22, daysAgo: 2,
    photo: '1556821840-3a63f95609a7', description: 'Brushed-back fleece, kangaroo pocket and a relaxed fit.' },
  { name: 'Lucky Cat Graphic Tee', brand: 'Obey', category: 'Clothing', price: 34.9, compareAt: 49.9, stock: 16, daysAgo: 7,
    photo: '1576566588028-4147f3842f27', description: 'Heavyweight cotton tee with a bold front print.' },
  { name: 'Reverse Weave Crewneck', brand: 'Champion', category: 'Clothing', price: 79.9, compareAt: null, stock: 14, daysAgo: 10,
    photo: '1620799140408-edc6dcb6d633', description: 'The original heavyweight sweatshirt, cut on the cross-grain to resist shrinking.' },
  { name: 'Logo Pocket Tee', brand: 'Carhartt WIP', category: 'Clothing', price: 34.9, compareAt: null, stock: 30, daysAgo: 15,
    photo: '1618354691373-d851c5c3a990', description: 'Single-jersey cotton with a small chest logo.' },
  { name: 'Essential Tee Black', brand: 'Stüssy', category: 'Clothing', price: 49.9, compareAt: null, stock: 24, daysAgo: 22,
    photo: '1583743814966-8936f5b7be1a', description: 'Soft black tee with a minimal chest print.' },
  { name: 'Essential Tee White', brand: 'Champion', category: 'Clothing', price: 29.9, compareAt: null, stock: 40, daysAgo: 28,
    photo: '1521572163474-6864f9cf17ab', description: 'Clean white crewneck in 100% cotton — the base of every outfit.' },
  { name: 'MA-1 Bomber Jacket', brand: 'Alpha Industries', category: 'Clothing', price: 169.9, compareAt: 229.9, stock: 6, daysAgo: 35,
    photo: '1591047139829-d91aecb6caea', description: 'Nylon flight jacket with ribbed cuffs and the signature utility pocket.' },
  { name: 'Trucker Denim Jacket', brand: "Levi's", category: 'Clothing', price: 99.9, compareAt: 139.9, stock: 9, daysAgo: 42,
    photo: '1611312449408-fcece27cdbb7', description: 'The original jean jacket in a dark, rigid wash.' },
  { name: '501 Original Jeans', brand: "Levi's", category: 'Clothing', price: 109.9, compareAt: null, stock: 18, daysAgo: 48, sizes: JEANS,
    photo: '1542272604-787c3835535d', description: 'Straight leg, button fly — the blueprint for every pair of jeans.' },
  { name: 'Perfecto Leather Jacket', brand: 'Schott NYC', category: 'Clothing', price: 499.0, compareAt: null, stock: 3, daysAgo: 65,
    photo: '1551028719-00167b16eac5', description: 'Classic motorcycle jacket in heavy cowhide leather.' },

  // ---------- Accessories ----------
  { name: 'Madison Washed Cap', brand: 'Carhartt WIP', category: 'Accessories', price: 29.9, compareAt: 39.9, stock: 20, daysAgo: 3,
    photo: '1521369909029-2afed882baee', description: 'Washed cotton six-panel cap with an adjustable strap.' },
  { name: '9FORTY Trucker Cap', brand: 'New Era', category: 'Accessories', price: 29.9, compareAt: null, stock: 25, daysAgo: 8,
    photo: '1588850561407-ed78c282e89b', description: 'Foam front, mesh back and a snapback closure.' },
  { name: 'Classic Backpack', brand: 'Herschel', category: 'Accessories', price: 64.9, compareAt: null, stock: 12, daysAgo: 18,
    photo: '1553062407-98eeb64c6a62', description: '24 L backpack with a padded laptop sleeve and front pocket.' },
  { name: 'Lips Socks', brand: 'Happy Socks', category: 'Accessories', price: 14.9, compareAt: null, stock: 50, daysAgo: 26, sizes: SOCKS,
    photo: '1586350977771-b3b0abd50c82', description: 'Combed-cotton crew socks with an all-over print.' },
  { name: 'Nova Backpack', brand: 'Herschel', category: 'Accessories', price: 59.9, compareAt: 79.9, stock: 7, daysAgo: 38,
    photo: '1622560480605-d83c853bc5c3', description: 'Rounded daypack in a soft rose colour with a drawstring top.' },
  { name: 'Leather Bifold Wallet', brand: 'Bellroy', category: 'Accessories', price: 69.9, compareAt: null, stock: 15, daysAgo: 58,
    photo: '1627123424574-724758594e93', description: 'Slim vegetable-tanned leather wallet with room for 8 cards and notes.' },
];
