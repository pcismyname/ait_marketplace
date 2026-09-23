import type {
  Category,
  CategoryId,
  Listing,
  Need,
  PaymentMethod,
  Rental,
  Review,
  Thread,
  User,
} from './types'

export const BRAND = 'AIT Circular'
export const BRAND_FULL = 'AIT Circular Marketplace'

export const CURRENT_USER_ID = 'u_me'

export const CATEGORIES: Category[] = [
  { id: 'furniture', label: 'Furniture', blurb: 'Desks, chairs, beds & shelves' },
  { id: 'electronics', label: 'Electronics', blurb: 'Monitors, fridges & gadgets' },
  { id: 'bicycles', label: 'Bicycles', blurb: 'Commuters & mountain bikes' },
  { id: 'textbooks', label: 'Textbooks', blurb: 'Course books & study material' },
  { id: 'kitchen', label: 'Kitchen & Household', blurb: 'Cookers, pans & essentials' },
  { id: 'sports', label: 'Sports Equipment', blurb: 'Rackets, mats & gear' },
  { id: 'other', label: 'Other', blurb: 'Everything else' },
]

export const PICKUP_LOCATIONS = [
  'Dorm A Lobby',
  'Dorm B Lobby',
  'AIT Married Housing',
  'Student Union Building',
  'AIT Library',
  'SET Building',
  'SERD Building',
  'Sports Complex',
  'AIT Conference Center',
]

export const CONDITION_LABELS: Record<string, string> = {
  new: 'New',
  'like-new': 'Like new',
  good: 'Good',
  fair: 'Fair',
}

export const PAYMENT_METHODS: { id: PaymentMethod; label: string; hint: string }[] = [
  { id: 'promptpay', label: 'PromptPay', hint: 'Scan a QR code with any Thai banking app' },
  { id: 'card', label: 'Debit or credit card', hint: 'Visa, Mastercard, JCB' },
  { id: 'wallet', label: `${BRAND} wallet`, hint: 'Refunded deposits land here first' },
]

export function paymentMethodLabel(id: PaymentMethod | undefined): string {
  return PAYMENT_METHODS.find((m) => m.id === id)?.label ?? 'Not recorded'
}

export const USERS: User[] = [
  {
    id: CURRENT_USER_ID,
    name: 'You',
    avatar: '',
    program: 'M.Sc. Data Science & AI',
    batch: 'Aug 2025 intake',
    rating: 5,
    reviewsCount: 4,
    joined: '2025',
  },
  {
    id: 'u_mai',
    name: 'Mai Phyo',
    avatar: '',
    program: 'M.Eng. Structural Engineering',
    batch: 'Aug 2024 intake',
    rating: 4.9,
    reviewsCount: 23,
    joined: '2024',
  },
  {
    id: 'u_arjun',
    name: 'Arjun Rana',
    avatar: '',
    program: 'Ph.D. Water Engineering',
    batch: 'Jan 2023 intake',
    rating: 4.8,
    reviewsCount: 31,
    joined: '2023',
  },
  {
    id: 'u_linh',
    name: 'Linh Tran',
    avatar: '',
    program: 'M.Sc. Remote Sensing & GIS',
    batch: 'Aug 2024 intake',
    rating: 4.7,
    reviewsCount: 12,
    joined: '2024',
  },
  {
    id: 'u_kwame',
    name: 'Kwame Osei',
    avatar: '',
    program: 'M.Eng. Energy Technology',
    batch: 'Aug 2023 intake',
    rating: 5,
    reviewsCount: 18,
    joined: '2023',
  },
  {
    id: 'u_sara',
    name: 'Sara Ahmed',
    avatar: '',
    program: 'M.Sc. Food Engineering',
    batch: 'Jan 2025 intake',
    rating: 4.6,
    reviewsCount: 9,
    joined: '2025',
  },
  {
    id: 'u_shop',
    name: 'AIT Campus Store',
    avatar: '',
    program: 'Campus shop · Student Union Building',
    batch: 'Partner shop',
    rating: 4.8,
    reviewsCount: 41,
    joined: '2026',
    kind: 'shop',
  },
]

export function getUser(id: string): User {
  return USERS.find((u) => u.id === id) ?? USERS[0]
}

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString()

export const LISTINGS: Listing[] = [
  {
    id: 'l_desk',
    title: 'Sturdy wooden study desk with drawer',
    description:
      'Solid wood desk that survived two theses. Big enough for two monitors and a pile of papers. One small drawer for cables and snacks. Selling because I am graduating and flying home in May.',
    category: 'furniture',
    type: 'sale',
    price: 1200,
    condition: 'good',
    images: ['/images/desk.webp'],
    pickupLocation: 'Dorm A Lobby',
    sellerId: 'u_mai',
    createdAt: daysAgo(2),
    status: 'available',
    timesChangedHands: 3,
    featured: true,
    history: [
      { ownerName: 'AIT Furniture Store', action: 'First bought new', date: '2019' },
      { ownerName: 'Daniel O.', action: 'Passed on to junior', date: '2021' },
      { ownerName: 'Mai Phyo', action: 'Bought secondhand', date: '2024' },
    ],
    reviews: [],
  },
  {
    id: 'l_chair',
    title: 'Ergonomic mesh office chair',
    description:
      'Comfortable mesh chair with adjustable height and armrests. Back support is a lifesaver during exam season. Minor scuff on one armrest, everything works perfectly.',
    category: 'furniture',
    type: 'sale',
    price: 900,
    condition: 'good',
    images: ['/images/chair.webp'],
    pickupLocation: 'Dorm B Lobby',
    sellerId: 'u_arjun',
    createdAt: daysAgo(5),
    status: 'available',
    timesChangedHands: 2,
    featured: true,
    history: [
      { ownerName: 'Original owner', action: 'Bought new', date: '2021' },
      { ownerName: 'Arjun Rana', action: 'Bought secondhand', date: '2023' },
    ],
    reviews: [],
  },
  {
    id: 'l_fridge',
    title: 'Mini fridge — perfect for dorm rooms',
    description:
      'Compact 90L mini fridge. Quiet, energy efficient, keeps drinks cold and leftovers fresh. Ideal for a single dorm room. Available for rent per semester with deposit, or buy outright.',
    category: 'electronics',
    type: 'rent',
    price: 250,
    deposit: 800,
    rentalPeriod: 'per semester',
    condition: 'like-new',
    images: ['/images/minifridge.webp'],
    pickupLocation: 'Dorm A Lobby',
    sellerId: 'u_kwame',
    createdAt: daysAgo(1),
    status: 'available',
    timesChangedHands: 4,
    featured: true,
    history: [
      { ownerName: 'AIT Housing', action: 'Bought new', date: '2020' },
      { ownerName: 'Rented across 4 students', action: `Circulated on ${BRAND}`, date: '2020–2025' },
    ],
    reviews: [],
  },
  {
    id: 'l_kettle',
    title: 'Electric kettle 1.7L — campus store rental fleet',
    description:
      'Fast-boil kettle from the AIT Campus Store rental fleet. Rent it for a month or the whole semester instead of buying one you will leave behind. Sanitised between renters, and the deposit is held in escrow like every rental here.',
    category: 'kitchen',
    type: 'rent',
    price: 60,
    deposit: 300,
    rentalPeriod: 'per month',
    condition: 'like-new',
    images: ['/images/kettle.svg'],
    pickupLocation: 'Student Union Building',
    sellerId: 'u_shop',
    createdAt: daysAgo(1),
    status: 'available',
    timesChangedHands: 8,
    featured: true,
    history: [
      { ownerName: 'AIT Campus Store', action: 'Added to rental fleet', date: '2024' },
      { ownerName: 'Rented across 8 students', action: `Circulated on ${BRAND}`, date: '2024–2026' },
    ],
    reviews: [],
  },
  {
    id: 'l_monitor',
    title: '24" IPS monitor, great for coding',
    description:
      'Full HD IPS panel with HDMI and VGA. Crisp colours, no dead pixels. Comes with power and HDMI cable. Great second screen for research and coding.',
    category: 'electronics',
    type: 'sale',
    price: 2100,
    condition: 'like-new',
    images: ['/images/monitor.webp'],
    pickupLocation: 'SET Building',
    sellerId: 'u_linh',
    createdAt: daysAgo(3),
    status: 'available',
    timesChangedHands: 1,
    history: [
      { ownerName: 'Linh Tran', action: 'Bought new', date: '2024' },
    ],
    reviews: [],
  },
  {
    id: 'l_bike',
    title: 'Blue city bike with basket',
    description:
      'Reliable single-speed city bike, perfect for getting around campus and the market runs to Bang Khen. New brake pads fitted last month. Basket included. Lock available for a bit extra.',
    category: 'bicycles',
    type: 'sale',
    price: 1500,
    condition: 'good',
    images: ['/images/bike.webp'],
    pickupLocation: 'Sports Complex',
    sellerId: 'u_mai',
    createdAt: daysAgo(6),
    status: 'available',
    timesChangedHands: 5,
    featured: true,
    history: [
      { ownerName: 'AIT Bike Pool', action: 'Bought new', date: '2018' },
      { ownerName: 'Handed across 4 students', action: 'Circulated on campus', date: '2018–2024' },
      { ownerName: 'Mai Phyo', action: 'Bought secondhand', date: '2024' },
    ],
    reviews: [],
  },
  {
    id: 'l_bikelock',
    title: 'U-lock & LED light set (new)',
    description:
      'Brand-new hardened U-lock with a front and rear USB light set, sold by the AIT Campus Store. Pairs well with any secondhand bike listed here.',
    category: 'bicycles',
    type: 'sale',
    price: 350,
    condition: 'new',
    images: ['/images/bikelock.svg'],
    pickupLocation: 'Student Union Building',
    sellerId: 'u_shop',
    createdAt: daysAgo(2),
    status: 'available',
    timesChangedHands: 0,
    history: [{ ownerName: 'AIT Campus Store', action: 'Stocked new', date: '2026' }],
    reviews: [],
  },
  {
    id: 'l_textbooks',
    title: 'Engineering & stats textbook bundle',
    description:
      'Bundle of six well-kept textbooks covering probability, fluid mechanics and structural analysis. Some highlighting in pencil (erasable). Sold as a set only.',
    category: 'textbooks',
    type: 'sale',
    price: 700,
    condition: 'good',
    images: ['/images/textbooks.webp'],
    pickupLocation: 'AIT Library',
    sellerId: 'u_arjun',
    createdAt: daysAgo(8),
    status: 'available',
    timesChangedHands: 2,
    history: [
      { ownerName: 'Senior PhD cohort', action: 'Shared set', date: '2020' },
      { ownerName: 'Arjun Rana', action: 'Took over the bundle', date: '2023' },
    ],
    reviews: [],
  },
  {
    id: 'l_ricecooker',
    title: 'Electric rice cooker (1.8L)',
    description:
      'Cooks perfect rice every time and doubles as a steamer. Non-stick pot in great shape. A must-have for dorm cooking. Cleaned and ready to go.',
    category: 'kitchen',
    type: 'sale',
    price: 450,
    condition: 'good',
    images: ['/images/ricecooker.webp'],
    pickupLocation: 'AIT Married Housing',
    sellerId: 'u_sara',
    createdAt: daysAgo(4),
    status: 'available',
    timesChangedHands: 3,
    history: [
      { ownerName: 'Circulated among Food Eng students', action: 'Passed down each year', date: '2021–2025' },
    ],
    reviews: [],
  },
  {
    id: 'l_cookware',
    title: 'Pots, pans & kettle starter set',
    description:
      'Everything a new arrival needs to start cooking: two pots, a frying pan, a kettle and basic utensils. Rentable per semester with a small deposit, or buy the whole set.',
    category: 'kitchen',
    type: 'rent',
    price: 150,
    deposit: 400,
    rentalPeriod: 'per semester',
    condition: 'good',
    images: ['/images/cookware.webp'],
    pickupLocation: 'AIT Married Housing',
    sellerId: 'u_sara',
    createdAt: daysAgo(7),
    status: 'available',
    timesChangedHands: 6,
    history: [
      { ownerName: 'Rented across 6 students', action: `Circulated on ${BRAND}`, date: '2020–2025' },
    ],
    reviews: [],
  },
  {
    id: 'l_yoga',
    title: 'Yoga mat + dumbbell pair',
    description:
      'Thick non-slip yoga mat with a pair of 3kg dumbbells. Great for a small in-room workout setup. Mat cleaned, dumbbells rust-free.',
    category: 'sports',
    type: 'sale',
    price: 350,
    condition: 'like-new',
    images: ['/images/yoga.webp'],
    pickupLocation: 'Sports Complex',
    sellerId: 'u_linh',
    createdAt: daysAgo(9),
    status: 'available',
    timesChangedHands: 1,
    history: [{ ownerName: 'Linh Tran', action: 'Bought new', date: '2024' }],
    reviews: [],
  },
  {
    id: 'l_badminton',
    title: 'Badminton racket pair with case',
    description:
      'Two lightweight rackets, a few shuttlecocks and a carry case. Perfect for evening games at the sports complex. Strings in good tension.',
    category: 'sports',
    type: 'rent',
    price: 80,
    deposit: 200,
    rentalPeriod: 'per month',
    condition: 'good',
    images: ['/images/badminton.webp'],
    pickupLocation: 'Sports Complex',
    sellerId: 'u_kwame',
    createdAt: daysAgo(10),
    status: 'available',
    timesChangedHands: 3,
    history: [
      { ownerName: 'Rented among sports club members', action: 'Circulated', date: '2022–2025' },
    ],
    reviews: [],
  },
  {
    id: 'l_lamp',
    title: 'LED desk lamp with dimmer',
    description:
      'Adjustable LED desk lamp with three brightness levels and a warm/cool toggle. Easy on the eyes for late-night reading. USB powered.',
    category: 'electronics',
    type: 'sale',
    price: 220,
    condition: 'like-new',
    images: ['/images/lamp.webp'],
    pickupLocation: 'Student Union Building',
    sellerId: 'u_sara',
    createdAt: daysAgo(11),
    status: 'available',
    timesChangedHands: 2,
    history: [
      { ownerName: 'Passed between two students', action: 'Handed over', date: '2023–2025' },
    ],
    reviews: [],
  },
  {
    id: 'l_mattress',
    title: 'Single foam mattress (clean, cover included)',
    description:
      'Comfortable single foam mattress with a washable cover (freshly laundered). No stains, no sagging. Great for a spare or a new room setup.',
    category: 'furniture',
    type: 'sale',
    price: 600,
    condition: 'good',
    images: ['/images/mattress.webp'],
    pickupLocation: 'Dorm B Lobby',
    sellerId: 'u_arjun',
    createdAt: daysAgo(12),
    status: 'available',
    timesChangedHands: 2,
    history: [
      { ownerName: 'Passed between two students', action: 'Handed over', date: '2022–2025' },
    ],
    reviews: [],
  },
]

export const NEEDS: Need[] = [
  {
    id: 'n_1',
    userId: 'u_sara',
    title: 'Looking for a desk before I arrive',
    category: 'furniture',
    note: 'Incoming in August, would love a desk ready in my room on day one.',
    arrivalDate: 'August 2026',
    createdAt: daysAgo(3),
  },
  {
    id: 'n_2',
    userId: 'u_sara',
    title: 'Mini fridge to rent for the year',
    category: 'electronics',
    note: 'Happy to rent per semester. Prefer something quiet.',
    arrivalDate: 'August 2026',
    createdAt: daysAgo(3),
  },
]

export const THREADS: Thread[] = [
  {
    id: 't_desk',
    listingId: 'l_desk',
    participantIds: [CURRENT_USER_ID, 'u_mai'],
    messages: [
      {
        id: 'm1',
        senderId: CURRENT_USER_ID,
        text: 'Hi Mai! Is the desk still available? Could I see it this week?',
        createdAt: daysAgo(1),
      },
      {
        id: 'm2',
        senderId: 'u_mai',
        text: 'Hi! Yes it is. I am free Thursday afternoon at Dorm A lobby. Does that work?',
        createdAt: daysAgo(1),
      },
      {
        id: 'm3',
        senderId: CURRENT_USER_ID,
        text: 'Thursday 4pm is perfect. Would you take 1,100 baht?',
        createdAt: daysAgo(1),
      },
    ],
  },
  {
    id: 't_fridge',
    listingId: 'l_fridge',
    participantIds: [CURRENT_USER_ID, 'u_kwame'],
    messages: [
      {
        id: 'm1',
        senderId: 'u_kwame',
        text: 'Hey, thanks for your interest in the mini fridge! The deposit is 800 baht, refunded when you return it in good condition.',
        createdAt: daysAgo(2),
      },
    ],
  },
]

export const RENTALS: Rental[] = [
  {
    id: 'r_fridge',
    listingId: 'l_fridge',
    renterId: CURRENT_USER_ID,
    deposit: 800,
    startDate: daysAgo(40),
    dueDate: daysAgo(-80),
    phase: 'active',
  },
  {
    id: 'r_badminton',
    listingId: 'l_badminton',
    renterId: CURRENT_USER_ID,
    deposit: 200,
    startDate: daysAgo(20),
    dueDate: daysAgo(-10),
    phase: 'return-pending',
  },
]

export const SELLER_REVIEWS: Record<string, Review[]> = {
  u_mai: [
    {
      id: 'rv1',
      authorName: 'Kwame Osei',
      authorAvatar: '',
      role: 'buyer',
      rating: 5,
      comment: 'Desk was exactly as described. Mai even helped me carry it to Dorm B. Smooth exchange!',
      date: 'Aug 2025',
    },
    {
      id: 'rv2',
      authorName: 'Sara Ahmed',
      authorAvatar: '',
      role: 'buyer',
      rating: 5,
      comment: 'Super responsive on chat and flexible with pickup time. Would buy again.',
      date: 'Jun 2025',
    },
    {
      id: 'rv3',
      authorName: 'Linh Tran',
      authorAvatar: '',
      role: 'renter',
      rating: 4,
      comment: 'Good communication. Item had a bit more wear than expected but fair price.',
      date: 'May 2025',
    },
  ],
  u_arjun: [
    {
      id: 'rv4',
      authorName: 'Mai Phyo',
      authorAvatar: '',
      role: 'buyer',
      rating: 5,
      comment: 'Textbooks in great shape and priced fairly. Honest about the highlighting.',
      date: 'Jul 2025',
    },
    {
      id: 'rv5',
      authorName: 'You',
      authorAvatar: '',
      role: 'buyer',
      rating: 5,
      comment: 'Chair is comfy and the pickup at Dorm B was quick. Recommended seller.',
      date: 'Sep 2025',
    },
  ],
  u_kwame: [
    {
      id: 'rv6',
      authorName: 'Arjun Rana',
      authorAvatar: '',
      role: 'renter',
      rating: 5,
      comment: 'Rented the fridge for a semester, deposit returned same day after return. Very fair.',
      date: 'Dec 2024',
    },
  ],
  u_linh: [
    {
      id: 'rv7',
      authorName: 'Sara Ahmed',
      authorAvatar: '',
      role: 'buyer',
      rating: 5,
      comment: 'Monitor is spotless. Great second screen for my thesis work.',
      date: 'Aug 2025',
    },
  ],
  u_sara: [
    {
      id: 'rv8',
      authorName: 'Kwame Osei',
      authorAvatar: '',
      role: 'renter',
      rating: 4,
      comment: 'Cookware set had everything I needed to get started. Thanks!',
      date: 'Jan 2025',
    },
  ],
  u_shop: [
    {
      id: 'rv9',
      authorName: 'Linh Tran',
      authorAvatar: '',
      role: 'renter',
      rating: 5,
      comment: 'Rented a kettle for the semester. Pickup at the store took two minutes and the deposit came back the day I returned it.',
      date: 'May 2026',
    },
  ],
}

export function getSellerReviews(userId: string): Review[] {
  return SELLER_REVIEWS[userId] ?? []
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? 'Other'
}
