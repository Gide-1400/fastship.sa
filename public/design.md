# الشحنة السريعة - Design System

## Design Philosophy

### Visual Language
- **Professional Trust**: Clean, modern interface that instills confidence in users handling valuable shipments
- **Efficiency Focus**: Streamlined workflows with minimal friction for quick shipment posting and matching
- **Cultural Relevance**: Arabic-first design with RTL support and culturally appropriate imagery
- **Accessibility**: High contrast ratios and clear typography for all user demographics

### Color Palette
- **Primary**: Deep Navy (#1a365d) - Trust, reliability, professional
- **Secondary**: Warm Orange (#ed8936) - Energy, movement, logistics
- **Accent**: Light Blue (#63b3ed) - Technology, tracking, communication
- **Success**: Green (#38a169) - Completed deliveries, positive status
- **Warning**: Amber (#d69e2e) - Attention needed, pending status
- **Error**: Red (#e53e3e) - Issues, cancellations
- **Neutral**: Gray scale from #f7fafc to #2d3748

### Typography
- **Display Font**: "Tajawal" - Modern Arabic-optimized sans-serif for headings
- **Body Font**: "Inter" - Clean, highly legible for interface text
- **Arabic Font**: "Amiri" - Traditional yet readable Arabic script
- **Monospace**: "JetBrains Mono" - For tracking numbers and codes

### Layout Principles
- **Grid System**: 12-column responsive grid with 24px gutters
- **Spacing**: 8px base unit system (8, 16, 24, 32, 48, 64px)
- **Breakpoints**: Mobile (320px), Tablet (768px), Desktop (1024px), Large (1440px)
- **Content Width**: Maximum 1200px centered with proper padding

## Visual Effects & Animations

### Core Libraries Used
1. **Anime.js** - Smooth micro-interactions and form transitions
2. **ECharts.js** - Dashboard analytics and shipment statistics
3. **Splide.js** - Hero image carousel and testimonial sliders
4. **Typed.js** - Dynamic text effects for key messaging
5. **p5.js** - Interactive route visualization on maps
6. **Matter.js** - Physics-based loading animations
7. **Splitting.js** - Text reveal animations for headings

### Animation Strategy
- **Micro-interactions**: Button hover states, form field focus
- **Page Transitions**: Smooth fade-ins and slide animations
- **Data Visualization**: Animated charts and progress indicators
- **Loading States**: Skeleton screens and progress bars
- **Success States**: Celebration animations for completed actions

### Header Effects
- **Gradient Background**: Subtle animated gradient with logistics-themed colors
- **Floating Elements**: Subtle movement of shipping icons
- **Parallax Scrolling**: Depth effect on hero sections

### Interactive Elements
- **Hover States**: 3D tilt effects on cards, shadow expansion
- **Click Feedback**: Ripple effects and state transitions
- **Form Validation**: Real-time visual feedback with color coding
- **Map Interactions**: Smooth zoom and pan with marker animations

## Component Design System

### Cards
- **Shipment Cards**: Clean white background with subtle shadow
- **Traveler Cards**: Horizontal layout with vehicle image and ratings
- **Feature Cards**: Icon + text with hover lift effect

### Forms
- **Multi-step Forms**: Progress indicator and smooth step transitions
- **Input Fields**: Floating labels with focus animations
- **Validation**: Inline error messages with color coding

### Navigation
- **Top Navigation**: Sticky header with logo and main actions
- **Breadcrumbs**: Clear path indication for multi-step processes
- **Mobile Menu**: Slide-in drawer with proper RTL support

### Data Display
- **Tables**: Alternating row colors with hover highlighting
- **Charts**: Consistent color scheme with interactive tooltips
- **Status Indicators**: Color-coded badges with icons

## Responsive Design

### Mobile First Approach
- **Touch Targets**: Minimum 44px for all interactive elements
- **Gesture Support**: Swipe for cards, pinch for maps
- **Simplified Navigation**: Collapsible menus and bottom sheets

### Arabic Layout Considerations
- **RTL Support**: Mirrored layouts for Arabic interface
- **Typography**: Larger line heights for Arabic text
- **Icons**: Culturally appropriate symbols and directions

## Accessibility Features

### WCAG Compliance
- **Color Contrast**: Minimum 4.5:1 ratio for all text
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Readers**: Proper ARIA labels and semantic HTML
- **Focus Indicators**: Clear visual focus states

### Inclusive Design
- **Font Scaling**: Support for user font size preferences
- **Motion Sensitivity**: Reduced motion options
- **Language Support**: Full Arabic and English localization