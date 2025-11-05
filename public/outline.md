# الشحنة السريعة - Project Outline

## File Structure

### Core HTML Pages
1. **index.html** - Main landing page with shipment posting interface
2. **travelers.html** - Traveler search and matching page
3. **dashboard.html** - User dashboard for managing shipments and profile
4. **support.html** - Help center and customer support
5. **terms.html** - Terms and conditions page
6. **privacy.html** - Privacy policy page

### Assets Directory
- **resources/** - All images, icons, and media files
  - hero-logistics.jpg - Main hero image
  - shipment-types/ - Package category icons
  - transport-modes/ - Vehicle type images
  - user-avatars/ - Profile pictures
  - saudi-map.jpg - Map visualization

### JavaScript Files
- **main.js** - Core application logic and interactions
- **auth.js** - User authentication and registration
- **shipment.js** - Shipment creation and management
- **search.js** - Traveler search and filtering
- **dashboard.js** - Dashboard functionality

### Data Files
- **mock-data.js** - Sample shipments, travelers, and transactions
- **cities.js** - Saudi Arabia cities and regions data

## Page Content Structure

### Index.html - Main Landing Page
**Purpose**: Convert visitors into users by showcasing platform value and enabling quick shipment posting

**Sections**:
1. **Navigation Bar** - Logo, main menu, login/signup
2. **Hero Section** - Compelling headline, shipment posting form, trust indicators
3. **How It Works** - 3-step process visualization
4. **Shipment Types** - Interactive grid of package categories
5. **Statistics** - Platform metrics with animated counters
6. **Testimonials** - User success stories with ratings
7. **Safety Features** - Security and insurance information
8. **Footer** - Links, contact, legal information

**Key Interactions**:
- Multi-step shipment posting form
- Real-time price calculator
- Interactive shipment type selector
- Animated statistics counters

### Travelers.html - Find Travelers
**Purpose**: Help shippers find and connect with available travelers

**Sections**:
1. **Navigation Bar** - Consistent across all pages
2. **Search Header** - Route input, filters, search button
3. **Interactive Map** - Real-time traveler locations
4. **Filter Panel** - Transport type, price, rating, availability
5. **Traveler Grid** - Cards with photos, ratings, vehicle details
6. **Sort Options** - Price, rating, departure time, distance
7. **Footer** - Consistent footer

**Key Interactions**:
- Interactive map with traveler markers
- Real-time filtering and search
- Traveler profile modals
- Route planning tool

### Dashboard.html - User Dashboard
**Purpose**: Central hub for managing all user activities

**Sections**:
1. **Navigation Bar** - With user profile dropdown
2. **Dashboard Header** - Welcome message, quick stats
3. **Tab Navigation** - My Shipments, My Travels, Messages, Profile
4. **Content Area** - Dynamic content based on active tab
5. **Sidebar** - Quick actions, notifications, earnings
6. **Footer** - Consistent footer

**Key Interactions**:
- Tab switching with smooth transitions
- Shipment status tracking
- Message center with chat interface
- Profile editing forms
- Rating and review system

### Support.html - Help Center
**Purpose**: Provide comprehensive support and legal information

**Sections**:
1. **Navigation Bar** - Consistent navigation
2. **Support Header** - Search help, contact options
3. **FAQ Section** - Collapsible question categories
4. **Contact Form** - Ticket submission system
5. **Live Chat** - Real-time support widget
6. **Legal Links** - Terms, privacy, safety guidelines
7. **Footer** - Consistent footer

**Key Interactions**:
- Searchable FAQ with highlighting
- Multi-step contact form
- Live chat interface
- Document upload for support tickets

## Interactive Components

### 1. Shipment Posting Wizard
- **Location**: Index page center
- **Functionality**: Multi-step form with validation
- **Steps**: Package type → Weight/dimensions → Locations → Time preferences → Confirmation
- **Features**: Real-time pricing, image upload, special instructions

### 2. Traveler Search Engine
- **Location**: Travelers page
- **Functionality**: Advanced filtering and mapping
- **Features**: Interactive map, real-time availability, rating system
- **Data**: Mock traveler profiles with vehicles and routes

### 3. Route Planning Tool
- **Location**: Integrated across pages
- **Functionality**: Visual route optimization
- **Features**: Multiple transport modes, time estimation, cost calculation
- **Technology**: Interactive map with drag-and-drop

### 4. User Dashboard
- **Location**: Dashboard page
- **Functionality**: Comprehensive account management
- **Features**: Tabbed interface, real-time updates, messaging system
- **Data**: User shipments, earnings, ratings, messages

## Content Requirements

### Text Content
- **Arabic**: All primary content in Arabic with English support
- **Legal**: Comprehensive terms and privacy policy
- **Help**: Detailed FAQ and support documentation
- **Marketing**: Compelling copy for conversion optimization

### Visual Content
- **Hero Images**: Professional logistics and transportation imagery
- **Icons**: Comprehensive icon set for shipment types and features
- **Illustrations**: Custom graphics for how-it-works sections
- **Photos**: User avatars, vehicle images, location photos

### Data Content
- **Mock Shipments**: 20+ sample shipment postings
- **Mock Travelers**: 15+ traveler profiles with different vehicles
- **Cities Data**: Complete Saudi Arabia cities and regions
- **Pricing Data**: Realistic pricing algorithms and examples

## Technical Implementation

### Core Technologies
- **HTML5**: Semantic markup with accessibility features
- **CSS3**: Tailwind CSS framework with custom components
- **JavaScript**: Vanilla JS with modern ES6+ features
- **Libraries**: Anime.js, ECharts.js, Splide.js, Typed.js, p5.js

### Responsive Design
- **Mobile First**: Optimized for mobile devices
- **Arabic RTL**: Full right-to-left language support
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Optimized loading and interactions

### Browser Support
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Fallbacks**: Graceful degradation for older browsers