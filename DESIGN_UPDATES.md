# CleanFlow Design Updates - Supabase Inspired

## Overview
Updated frontend design to match Supabase's modern, minimal aesthetic while adding comprehensive workflow documentation on the homepage.

## Key Changes

### 1. **Color Palette** (Supabase Inspired)
```
Primary:    #111827 (Dark Navy)
Secondary:  #6b7280 (Medium Gray)  
Light:      #f3f4f6 (Light Gray)
Border:     #e5e7eb (Subtle Border)
Accent:     #3b82f6 (Blue)
Success:    #10b981 (Green)
Warning:    #f59e0b (Amber)
Error:      #ef4444 (Red)
```

### 2. **Homepage Sections**

#### Hero Section
- Clear headline: "Clean & Transform Your Data"
- Dual CTAs: "Get Started" + "View Pricing"
- Professional, conversational copy

#### "How It Works" Section (NEW)
Shows 3-step process:
1. **Upload Data** - Connect CSV/Excel/Database
2. **Define Rules** - Set up validation rules
3. **Transform & Export** - Export clean results

Each step includes:
- Step number (01, 02, 03)
- Icon
- Title
- Detailed description

#### "CleanFlow Platform" Section (NEW)
- Platform overview with description
- 2x2 grid of core features:
  - Quality Validation
  - Schema Mapping
  - Data Enrichment
  - Web Scraping
- Light gray background section for visual hierarchy

#### CTA Section (NEW)
- Dark background call-to-action
- Encourages trial signup
- White text for contrast

### 3. **Navigation**
- Restored `PlatformDropdown` component
- Clean, minimal header design
- Simple hover states
- Professional appearance matching Supabase

### 4. **Component Updates**
- **Cards**: Clean borders, minimal shadows
- **Buttons**: Clear primary/secondary states
- **Inputs**: Subtle focus states with blue outline
- **Typography**: Proper hierarchy with font sizes and weights

### 5. **CSS Enhancements**
New utility classes:
- `.badge` - For labels and tags
- `.badge-success`, `.badge-warning`, `.badge-error` - Status indicators
- `.text-muted` - Secondary text
- Shadow utilities matching Supabase style

### 6. **Tailwind Configuration**
- Full primary color scale (50-900)
- Accent color palette
- Custom shadow definitions
- Box shadow utilities for subtle/soft/medium shadows

## Design Philosophy
Following Supabase's approach:
- **Clarity First** - Every element has clear purpose
- **Minimal Decoration** - No gradients or unnecessary animations
- **Strong Typography** - Hierarchy through font sizes and weights
- **Generous Whitespace** - Comfortable spacing throughout
- **Accessibility** - High contrast, clear focus states

## Files Modified
1. `src/App.jsx` - Added workflow sections, restored PlatformDropdown
2. `src/App.css` - Enhanced styling with Supabase palette
3. `tailwind.config.js` - Updated color system

## Features Preserved
✅ All authentication logic
✅ Data validation workflow
✅ File upload functionality
✅ API integrations
✅ Navigation functionality
✅ State management
✅ All business logic

## Visual Hierarchy
- **H1**: Hero/Main headings
- **H2**: Section headings
- **H3**: Card titles, subsections
- **Body**: 16px, medium gray
- **Small text**: 14px-12px for helpers/labels

## Responsive Design
- Mobile: Single column, full-width
- Tablet: 2 column layouts
- Desktop: Multi-column with max-width container

---
**Design System**: Supabase Inspired
**Build Status**: ✅ Successful
**Date**: February 22, 2026
