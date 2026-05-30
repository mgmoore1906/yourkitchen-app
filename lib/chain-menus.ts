// Chain menu library — matches restaurant name to menu items
// Used when a coordinator selects a chain restaurant via Google Places
// Add/update items here as needed; prices are approximate national averages

export type MenuItem = {
  id:          string
  name:        string
  description: string
  price:       number
  category:    string
  is_favorite?: boolean
}

export type ChainMenu = {
  items: MenuItem[]
}

// Normalize restaurant names for matching
const normalize = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()

// Chain menu database
const CHAIN_MENUS: Record<string, ChainMenu> = {

  'chipotle': {
    items: [
      { id: 'chip-1', name: 'Burrito Bowl', description: 'Rice, beans, protein, toppings of your choice', price: 10.70, category: 'Bowls' },
      { id: 'chip-2', name: 'Burrito', description: 'Flour tortilla with rice, beans, protein, toppings', price: 10.70, category: 'Burritos' },
      { id: 'chip-3', name: 'Tacos (3)', description: 'Choice of protein with toppings on corn or flour tortillas', price: 10.70, category: 'Tacos' },
      { id: 'chip-4', name: 'Quesadilla', description: 'Grilled flour tortilla with cheese and protein', price: 8.75, category: 'Quesadillas' },
      { id: 'chip-5', name: 'Kids Meal', description: 'Smaller portion with a drink and chips', price: 6.50, category: 'Kids' },
    ],
  },

  'chick-fil-a': {
    items: [
      { id: 'cfa-1', name: 'Chicken Sandwich', description: 'Crispy chicken breast on a toasted bun with pickles', price: 5.99, category: 'Sandwiches', is_favorite: true },
      { id: 'cfa-2', name: 'Deluxe Sandwich', description: 'Chicken sandwich with lettuce, tomato, and cheese', price: 7.39, category: 'Sandwiches' },
      { id: 'cfa-3', name: 'Grilled Chicken Sandwich', description: 'Marinated grilled chicken on a multigrain bun', price: 7.19, category: 'Sandwiches' },
      { id: 'cfa-4', name: 'Spicy Chicken Sandwich', description: 'Spiced chicken breast with pickles on a toasted bun', price: 5.99, category: 'Sandwiches' },
      { id: 'cfa-5', name: 'Nuggets (8 count)', description: 'Bite-sized pieces of tender chicken breast', price: 5.85, category: 'Nuggets' },
      { id: 'cfa-6', name: 'Cobb Salad', description: 'Chicken, bacon, eggs, cheese, and vegetables', price: 11.09, category: 'Salads' },
    ],
  },

  'panera bread': {
    items: [
      { id: 'pan-1', name: 'Broccoli Cheddar Soup (bread bowl)', description: 'Classic soup served in a sourdough bread bowl', price: 12.49, category: 'Soups', is_favorite: true },
      { id: 'pan-2', name: 'Fuji Apple Chicken Salad', description: 'Chicken, apple chips, almonds, and gorgonzola', price: 12.69, category: 'Salads' },
      { id: 'pan-3', name: 'Turkey Avocado BLT', description: 'Turkey, avocado, bacon on toasted bread', price: 11.99, category: 'Sandwiches' },
      { id: 'pan-4', name: 'Mac and Cheese', description: 'Creamy Vermont white cheddar pasta', price: 10.99, category: 'Mac & Cheese' },
      { id: 'pan-5', name: 'Tomato Soup + Half Sandwich', description: 'Tomato soup with your choice of half sandwich', price: 12.99, category: 'You Pick Two' },
    ],
  },

  'first watch': {
    items: [
      { id: 'fw-1', name: 'Avocado Toast', description: 'Multigrain toast topped with smashed avocado, cherry tomatoes, and microgreens', price: 12.99, category: 'Toasts', is_favorite: true },
      { id: 'fw-2', name: 'Chickichanga', description: 'Crispy burrito filled with chicken, salsa verde, and cheese', price: 13.99, category: 'Specialties' },
      { id: 'fw-3', name: 'Farmhouse Hash', description: 'Potatoes, roasted pepper, onion, spinach, and eggs', price: 13.99, category: 'Skillets' },
      { id: 'fw-4', name: 'Lemon Ricotta Pancakes', description: 'Fluffy pancakes with lemon zest and fresh berries', price: 11.99, category: 'Pancakes' },
      { id: 'fw-5', name: 'Smoked Salmon Benedict', description: 'Smoked salmon on an English muffin with hollandaise', price: 15.99, category: 'Eggs Benedict' },
    ],
  },

  'cava': {
    items: [
      { id: 'cava-1', name: 'Grain Bowl', description: 'Brown rice or farro base with your choice of protein and toppings', price: 12.45, category: 'Bowls', is_favorite: true },
      { id: 'cava-2', name: 'Greens + Grains Bowl', description: 'Half greens, half grains with dressings and toppings', price: 12.45, category: 'Bowls' },
      { id: 'cava-3', name: 'Pita', description: 'Warm pita stuffed with protein, dips, and toppings', price: 10.95, category: 'Pitas' },
      { id: 'cava-4', name: 'Salad Bowl', description: 'Mixed greens with protein, dressings, and toppings', price: 12.45, category: 'Salads' },
    ],
  },

  'raising cane': {
    items: [
      { id: 'rc-1', name: 'The Box Combo', description: '4 chicken fingers, crinkle fries, Cane\'s sauce, toast, and drink', price: 11.99, category: 'Combos', is_favorite: true },
      { id: 'rc-2', name: '3 Finger Combo', description: '3 chicken fingers, crinkle fries, Cane\'s sauce, and toast', price: 9.99, category: 'Combos' },
      { id: 'rc-3', name: 'Caniac Combo', description: '6 chicken fingers, crinkle fries, 2 Cane\'s sauces, coleslaw, toast, and drink', price: 15.99, category: 'Combos' },
      { id: 'rc-4', name: 'Sandwich Combo', description: 'Chicken finger sandwich with crinkle fries and drink', price: 10.99, category: 'Combos' },
    ],
  },

  'whataburger': {
    items: [
      { id: 'wb-1', name: 'Whataburger', description: 'Fresh beef patty with mustard, lettuce, tomatoes, pickles, and onion', price: 7.49, category: 'Burgers', is_favorite: true },
      { id: 'wb-2', name: 'Double Whataburger', description: 'Two fresh beef patties with all the toppings', price: 9.49, category: 'Burgers' },
      { id: 'wb-3', name: 'Honey BBQ Chicken Strip Sandwich', description: 'Crispy chicken strips with honey BBQ sauce', price: 8.99, category: 'Sandwiches' },
      { id: 'wb-4', name: 'Patty Melt', description: 'Double beef patties with grilled onions and cheese on toast', price: 9.29, category: 'Burgers' },
      { id: 'wb-5', name: 'Breakfast on a Bun', description: 'Egg, cheese, and choice of protein on a bun', price: 5.99, category: 'Breakfast' },
    ],
  },

  'olive garden': {
    items: [
      { id: 'og-1', name: 'Chicken Alfredo', description: 'Fettuccine with creamy Alfredo sauce and grilled chicken', price: 17.99, category: 'Pasta', is_favorite: true },
      { id: 'og-2', name: 'Tour of Italy', description: 'Chicken parmigiana, lasagna classico, and fettuccine Alfredo', price: 21.99, category: 'Specialties' },
      { id: 'og-3', name: 'Eggplant Parmigiana', description: 'Lightly breaded eggplant with marinara and mozzarella', price: 16.99, category: 'Pasta' },
      { id: 'og-4', name: 'Shrimp Scampi', description: 'Shrimp tossed in a garlic butter wine sauce over angel hair', price: 18.99, category: 'Pasta' },
      { id: 'og-5', name: 'Soup, Salad & Breadsticks', description: 'Never-ending soup or salad with warm breadsticks', price: 13.99, category: 'Soups & Salads' },
    ],
  },

  'panda express': {
    items: [
      { id: 'pe-1', name: 'Orange Chicken', description: 'Crispy chicken wok-tossed in a sweet and spicy orange sauce', price: 10.99, category: 'Entrees', is_favorite: true },
      { id: 'pe-2', name: 'Beijing Beef', description: 'Crispy beef with bell peppers and onions in a sweet-tangy sauce', price: 10.99, category: 'Entrees' },
      { id: 'pe-3', name: 'Broccoli Beef', description: 'Tender beef and broccoli in a ginger soy sauce', price: 10.99, category: 'Entrees' },
      { id: 'pe-4', name: 'Plate (2 entrees + side)', description: 'Your choice of 2 entrees with fried rice or chow mein', price: 11.99, category: 'Plates' },
      { id: 'pe-5', name: 'Bigger Plate (3 entrees + side)', description: 'Your choice of 3 entrees with fried rice or chow mein', price: 13.49, category: 'Plates' },
    ],
  },

  'jason\'s deli': {
    items: [
      { id: 'jd-1', name: 'NY Club', description: 'Turkey, ham, Swiss, bacon, lettuce, tomato on sourdough', price: 13.99, category: 'Sandwiches', is_favorite: true },
      { id: 'jd-2', name: 'Chicken Pot Pie Soup', description: 'Creamy pot pie filling with chicken and vegetables', price: 8.99, category: 'Soups' },
      { id: 'jd-3', name: 'Muffuletta', description: 'Italian meats and olive salad on round Italian bread', price: 14.99, category: 'Sandwiches' },
      { id: 'jd-4', name: 'Organic Salad Bar (full meal)', description: 'Unlimited salad bar with organic ingredients', price: 12.99, category: 'Salad Bar' },
    ],
  },

  'torchy\'s tacos': {
    items: [
      { id: 'tt-1', name: 'Trailer Park Taco', description: 'Fried chicken, green chiles, lettuce, pico, cheese on a flour tortilla', price: 5.75, category: 'Tacos', is_favorite: true },
      { id: 'tt-2', name: 'Democrat Taco', description: 'Pulled pork, green chiles, and queso on a corn tortilla', price: 5.75, category: 'Tacos' },
      { id: 'tt-3', name: 'Brushfire Taco', description: 'Jamaican jerk chicken with mango habanero, slaw', price: 5.75, category: 'Tacos' },
      { id: 'tt-4', name: 'Queso (large)', description: 'Signature queso with choice of add-ins', price: 9.50, category: 'Dips' },
      { id: 'tt-5', name: 'Taco Plate (3 tacos)', description: '3 tacos of your choice with rice and beans', price: 17.25, category: 'Plates' },
    ],
  },

  'mod pizza': {
    items: [
      { id: 'mod-1', name: 'Build Your Own Pizza', description: 'Choose your size, sauce, cheese, and unlimited toppings', price: 12.47, category: 'Pizzas', is_favorite: true },
      { id: 'mod-2', name: 'Build Your Own Salad', description: 'Start with greens and add toppings of your choice', price: 10.47, category: 'Salads' },
      { id: 'mod-3', name: 'Tristan (signature)', description: 'Red sauce, mozzarella, sausage, roasted red peppers, basil', price: 12.47, category: 'Pizzas' },
      { id: 'mod-4', name: 'Calexico (signature)', description: 'Pesto sauce, mozzarella, chicken, fresh corn, cilantro', price: 12.47, category: 'Pizzas' },
    ],
  },

  'the toasted yolk': {
    items: [
      { id: 'ty-1', name: 'The Toasted Yolk Benedict', description: 'Poached eggs on an English muffin with hollandaise and house potatoes', price: 14.99, category: 'Benedicts', is_favorite: true },
      { id: 'ty-2', name: 'Breakfast Burrito', description: 'Scrambled eggs, cheese, and your choice of protein in a flour tortilla', price: 13.99, category: 'Burritos' },
      { id: 'ty-3', name: 'Chicken and Waffles', description: 'Crispy fried chicken on a Belgian waffle with maple syrup', price: 15.99, category: 'Specialties' },
      { id: 'ty-4', name: 'Avocado Omelette', description: 'Fresh avocado, tomato, and goat cheese omelette', price: 13.99, category: 'Omelettes' },
    ],
  },

  'up thai kitchen': {
    items: [
      { id: 'up-1', name: 'Pad Thai', description: 'Stir-fried rice noodles with egg, bean sprouts, and peanuts', price: 16.99, category: 'Noodles', is_favorite: true },
      { id: 'up-2', name: 'Green Curry', description: 'Coconut green curry with vegetables and your choice of protein', price: 17.99, category: 'Curries' },
      { id: 'up-3', name: 'Drunken Noodles', description: 'Wide rice noodles stir-fried with basil, chili, and egg', price: 16.99, category: 'Noodles' },
      { id: 'up-4', name: 'Tom Kha Soup', description: 'Coconut milk soup with galangal, lemongrass, and mushrooms', price: 8.99, category: 'Soups' },
      { id: 'up-5', name: 'Mango Sticky Rice', description: 'Sweet sticky rice with fresh mango and coconut cream', price: 7.99, category: 'Desserts' },
    ],
  },

  'harvest kitchen': {
    items: [
      { id: 'hk-1', name: 'Grain Bowl', description: 'Ancient grains with roasted vegetables and herb dressing', price: 13.99, category: 'Bowls', is_favorite: true },
      { id: 'hk-2', name: 'Avocado Egg Toast', description: 'Sourdough toast with avocado, soft eggs, and microgreens', price: 12.99, category: 'Toasts' },
      { id: 'hk-3', name: 'Green Goddess Salad', description: 'Mixed greens with cucumber, avocado, and herb dressing', price: 12.99, category: 'Salads' },
      { id: 'hk-4', name: 'Turkey Club', description: 'Sliced turkey with avocado, bacon, and Swiss on multigrain', price: 14.99, category: 'Sandwiches' },
    ],
  },

  'the kebab shop': {
    items: [
      { id: 'ks-1', name: 'Chicken Kebab Bowl', description: 'Grilled chicken over rice with tzatziki and vegetables', price: 13.99, category: 'Bowls', is_favorite: true },
      { id: 'ks-2', name: 'Falafel Wrap', description: 'Crispy falafel in a warm wrap with hummus and fresh vegetables', price: 12.99, category: 'Wraps' },
      { id: 'ks-3', name: 'Shawarma Plate', description: 'Seasoned meat with rice, salad, and garlic sauce', price: 14.99, category: 'Plates' },
      { id: 'ks-4', name: 'Lamb Adana Kebab', description: 'Spiced ground lamb skewer with rice and salad', price: 15.99, category: 'Kebabs' },
    ],
  },

}

// ── Lookup function ───────────────────────────────────────────────────────────
export function getChainMenu(restaurantName: string): MenuItem[] | null {
  const n = normalize(restaurantName)

  // Exact match first
  if (CHAIN_MENUS[n]) return CHAIN_MENUS[n].items

  // Partial match — restaurant name contains a chain key or vice versa
  for (const [key, menu] of Object.entries(CHAIN_MENUS)) {
    if (n.includes(key) || key.includes(n)) return menu.items
  }

  // Common aliases
  const ALIASES: Record<string, string> = {
    'cfa':                    'chick-fil-a',
    'chick fil a':            'chick-fil-a',
    'panera':                 'panera bread',
    'raising canes':          'raising cane',
    'canes':                  'raising cane',
    'panda':                  'panda express',
    'jasons deli':            "jason's deli",
    'torchys':                "torchy's tacos",
    'mod':                    'mod pizza',
    'toasted yolk':           'the toasted yolk',
    'up thai':                'up thai kitchen',
  }

  const alias = ALIASES[n]
  if (alias && CHAIN_MENUS[alias]) return CHAIN_MENUS[alias].items

  return null
}

// ── Generic fallback items (when no chain match) ──────────────────────────────
export const GENERIC_MENU_ITEMS: MenuItem[] = [
  { id: 'gen-1', name: 'Popular Entrée',       description: 'A popular main dish from this restaurant', price: 15.00, category: 'Entrees' },
  { id: 'gen-2', name: 'Soup + Salad Combo',   description: 'Soup of the day with a house salad',        price: 12.00, category: 'Combos' },
  { id: 'gen-3', name: 'Pasta Dish',           description: 'Signature pasta with house-made sauce',      price: 16.00, category: 'Pasta' },
  { id: 'gen-4', name: 'Sandwich + Sides',     description: 'Choice of sandwich with fries or salad',     price: 13.00, category: 'Sandwiches' },
  { id: 'gen-5', name: 'Family Meal (2–4)',    description: 'Large portion for a family of 2–4 people',   price: 35.00, category: 'Family Meals' },
]
