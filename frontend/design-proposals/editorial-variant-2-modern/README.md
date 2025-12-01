# Editorial Variant 2: Modern Editorial

A contemporary magazine-inspired design system with multiple switchable color palettes for the Video Manual Platform.

## Design Philosophy

This variant modernizes the editorial aesthetic with bold color blocking, contemporary typography, and dynamic palette switching. Inspired by digital magazines like **The Outline**, **Bloomberg**, and **Monocle**, it combines editorial sophistication with modern web design principles.

### Core Principles

1. **Contemporary Typography** - Mix of serif display (DM Serif Display) + clean sans-serif (DM Sans)
2. **Bold Color Blocking** - Vibrant accent colors with asymmetric layouts
3. **Switchable Palettes** - 5 distinct color themes that users can toggle
4. **Modern Grid Systems** - Clean, card-based layouts with subtle animations
5. **Professional Polish** - Crisp shadows, smooth transitions, production-ready code

## Color Palettes

All palettes are fully switchable via JavaScript and persist in localStorage.

### 1. Coral (Default)
- **Accent**: `#FF6B6B` - Vibrant, energetic coral
- **Use Case**: Creative teams, friendly brands
- **Feel**: Warm, approachable, modern

### 2. Electric Blue
- **Accent**: `#4361EE` - Bold, professional blue
- **Use Case**: Tech companies, enterprises
- **Feel**: Professional, trustworthy, contemporary

### 3. Mint
- **Accent**: `#2EC4B6` - Fresh, modern mint
- **Use Case**: Health, wellness, sustainability
- **Feel**: Clean, fresh, innovative

### 4. Marigold
- **Accent**: `#F4A261` - Warm, inviting orange
- **Use Case**: Education, community platforms
- **Feel**: Warm, welcoming, optimistic

### 5. Grape
- **Accent**: `#7209B7` - Rich, sophisticated purple
- **Use Case**: Luxury brands, premium products
- **Feel**: Elegant, creative, distinctive

## Typography System

### Font Pairing

**Display/Headings**: DM Serif Display
- Contemporary serif with editorial character
- Used for hero text, section headers, card titles
- Creates strong visual hierarchy

**Body/UI**: DM Sans
- Clean, geometric sans-serif
- Excellent readability at all sizes
- Modern, professional feel

### Type Scale

```css
Display: 96px → 72px → 56px → 44px → 32px
Heading: 28px → 24px → 20px → 18px
Body: 20px → 18px → 16px → 14px → 12px
```

## Design Features

### 1. Palette Switcher
- Dropdown menu in navigation
- 5 color options with visual previews
- Instant theme switching
- Persists across sessions (localStorage)
- Works with both light and dark modes

### 2. Light + Dark Mode
- Each palette has optimized dark mode
- Automatic color adjustments for accessibility
- Deeper shadows in dark mode
- Maintains design consistency

### 3. Modern Components

**Color Blocks**
- Bold accent backgrounds for emphasis
- Used in hero sections and CTAs
- Creates visual impact

**Callouts**
- Soft accent backgrounds with border
- Perfect for tips, warnings, notes
- Clean, contemporary styling

**Cards**
- Subtle borders with hover effects
- Color accent on top border (animated)
- Modern shadow system

**Badges**
- Pill-shaped with accent colors
- Used for tags, statuses, labels
- Clean, minimal design

### 4. Animation & Interaction

**Smooth Transitions**
- Fast (150ms), Base (250ms), Slow (400ms)
- Cubic bezier easing for polish
- Subtle hover states

**Hover Effects**
- Card elevation on hover
- Border color changes
- Gentle transforms (translateY, scale)

## File Structure

```
editorial-variant-2-modern/
├── design-system.css      # Core design tokens & utilities
├── landing-page.html      # Marketing homepage
├── dashboard.html         # Application dashboard
├── manual-preview.html    # Manual reading view
├── components.html        # Component showcase
└── README.md             # This file
```

## Usage Examples

### Switching Palettes

```javascript
// Set palette programmatically
document.documentElement.setAttribute('data-palette', 'mint');
localStorage.setItem('palette', 'mint');

// Available palettes: coral, electric-blue, mint, marigold, grape
```

### Using Design Tokens

```css
/* Color Usage */
background-color: var(--color-accent);
color: var(--color-text);
border-color: var(--color-border);

/* Typography */
font-family: var(--font-display);
font-size: var(--text-heading-xl);
line-height: var(--leading-tight);

/* Spacing */
padding: var(--space-8);
gap: var(--space-4);
margin-bottom: var(--space-12);
```

## Implementation Guide

### 1. Convert to Next.js/Tailwind

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        // Map CSS variables to Tailwind
        accent: 'var(--color-accent)',
        'accent-hover': 'var(--color-accent-hover)',
        // ... etc
      },
      fontFamily: {
        display: ['DM Serif Display', 'serif'],
        sans: ['DM Sans', 'sans-serif'],
      }
    }
  }
}
```

### 2. Create Palette Context

```typescript
// contexts/PaletteContext.tsx
export const usePalette = () => {
  const [palette, setPalette] = useState('coral');
  
  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette);
    localStorage.setItem('palette', palette);
  }, [palette]);
  
  return { palette, setPalette };
};
```

### 3. Build Components

Use the component patterns in `components.html` to create React components with shadcn/ui or similar.

## Responsive Behavior

### Breakpoints
- **Desktop**: 1024px+
- **Tablet**: 768px-1023px
- **Mobile**: <768px

### Key Adaptations
- Typography scales down proportionally
- Grid layouts become single column
- Sidebar collapses on mobile
- Touch-friendly button sizes
- Optimized spacing on small screens

## Accessibility

### Color Contrast
- All palettes tested for WCAG AA compliance
- Dark mode maintains proper contrast ratios
- Text remains readable on all backgrounds

### Interactive Elements
- Focus states with visible outlines
- Keyboard navigation support
- ARIA labels on icon buttons
- Semantic HTML structure

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- CSS Grid and Custom Properties required
- No IE11 support

## Performance

### Optimizations
- Single CSS file (no extra requests)
- CSS variables for instant theme switching
- No JavaScript dependencies
- Minimal repaints on theme change
- Optimized animations (transform/opacity only)

## Customization

### Adding New Palettes

```css
[data-palette="custom"] {
  --color-accent-500: #YOUR_COLOR;
  --color-accent-600: #YOUR_DARKER_COLOR;
  --color-accent-700: #YOUR_DARKEST_COLOR;
  --color-accent-soft: #YOUR_LIGHT_BG;
  
  --color-accent: var(--color-accent-500);
  --color-accent-hover: var(--color-accent-600);
}
```

### Adjusting Typography

Modify the type scale in `:root` to change all text sizes proportionally:

```css
:root {
  --text-display-xl: 5rem; /* Adjust as needed */
  --text-heading-xl: 2rem;
  /* ... etc */
}
```

## Comparison with Base Editorial

| Feature | Base Editorial | Modern Variant 2 |
|---------|---------------|------------------|
| Color Palettes | 1 (Burgundy) | 5 (Switchable) |
| Typography | Fraunces + Inter | DM Serif + DM Sans |
| Aesthetic | Classic, refined | Bold, contemporary |
| Color Usage | Restrained | Color blocking |
| Borders | Sharp edges | Minimal radius |
| Shadows | Subtle | Crisp, defined |
| Best For | Corporate, traditional | Creative, modern teams |

## Use Cases

Perfect for:
1. **Creative Agencies** - Bold colors, modern aesthetic
2. **SaaS Products** - Professional with personality
3. **Educational Platforms** - Multiple themes for different audiences
4. **Multi-Brand Products** - Palette switching for white-label
5. **Modern Enterprises** - Contemporary, not stuffy

## Credits

**Fonts:**
- DM Serif Display by Colophon Foundry (Google Fonts)
- DM Sans by Colophon Foundry (Google Fonts)

**Design Inspiration:**
- The Outline's bold color usage
- Bloomberg's modern typography
- Monocle's sophisticated layouts
- Stripe's clean card designs

## Next Steps

1. **Review the mockups** - Open each HTML file in a browser
2. **Test palette switching** - Try all 5 color themes
3. **Test dark mode** - Toggle light/dark for each palette
4. **Review components** - Check `components.html` for all patterns
5. **Provide feedback** - Adjust palettes, spacing, or typography as needed

## Conclusion

This modern editorial variant brings contemporary magazine aesthetics to the Video Manual Platform with the flexibility of multiple color palettes. It's bold without being loud, professional without being boring, and gives users the power to customize their experience while maintaining design consistency.

The switchable palettes make it perfect for multi-tenant applications, white-label products, or simply giving users choice in their interface appearance.
