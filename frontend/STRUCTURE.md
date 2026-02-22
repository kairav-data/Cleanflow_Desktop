# Frontend Structure Guide

This guide explains the organized folder structure of the CleanFlow frontend. Follow this structure when adding new files and features.

## 📁 Directory Structure

```
src/
├── components/
│   ├── common/                 # Reusable, cross-app components
│   │   ├── Footer.jsx          # Footer with newsletter & links
│   │   ├── UserSidebar.jsx     # User profile sidebar
│   │   └── index.js            # Export barrel
│   │
│   ├── pages/                  # Full-page components
│   │   ├── PricingPage.jsx     # Pricing page
│   │   └── index.js            # Export barrel
│   │
│   ├── modals/                 # Modal/dialog components
│   │   ├── AuthModal.jsx       # Login/signup modal
│   │   ├── PaymentModal.jsx    # Payment/billing modal
│   │   └── index.js            # Export barrel
│   │
│   ├── DataConnection.jsx      # Feature: Data upload/connection
│   ├── RuleBuilder.jsx         # Feature: Validation rule builder
│   ├── ResultsDashboard.jsx    # Feature: Results display
│   ├── HistoryPanel.jsx        # Feature: History/logs
│   └── index.js                # Export barrel for main features
│
├── features/                   # Feature-specific builders
│   ├── EnrichmentBuilder.jsx   # Data enrichment tool
│   ├── ScraperBuilder.jsx      # Web scraping tool
│   ├── SchemaMapper.jsx        # Schema mapping tool
│   ├── DataMatchingBuilder.jsx # Data matching tool
│   ├── FeatureRegistry.js      # Feature metadata registry
│   ├── base.py                 # [Backend] Base feature class
│   └── index.js                # Export barrel
│
├── hooks/                      # Custom React hooks
│   ├── useAuth.js              # Authentication hook (TODO)
│   ├── useFetch.js             # API fetch hook (TODO)
│   └── useLocalStorage.js      # Local storage hook (TODO)
│
├── utils/                      # Utility functions
│   ├── api.js                  # API helper functions (TODO)
│   ├── validators.js           # Form/data validators (TODO)
│   ├── formatters.js           # Data formatters (TODO)
│   └── constants.js            # Utility constants (TODO)
│
├── constants/                  # App-wide constants
│   ├── api.js                  # API endpoints (TODO)
│   ├── theme.js                # Theme colors/sizes (TODO)
│   ├── messages.js             # Toast/alert messages (TODO)
│   └── validation.js           # Validation rules (TODO)
│
├── assets/                     # Static assets
│   └── logo.png                # App logo
│
├── App.jsx                     # Main app component
├── main.jsx                    # React entry point
├── index.css                   # Global styles
└── App.css                     # App-specific styles
```

## 📋 Folder Responsibilities

### `components/`
Contains all React components. Organized by purpose:
- **common/**: Footer, Header, Sidebar, etc. (used across multiple pages)
- **pages/**: Full-page components like PricingPage
- **modals/**: Modal dialogs like AuthModal, PaymentModal
- **Root level**: Specific feature components (DataConnection, RuleBuilder, etc.)

### `features/`
Feature-specific builders and tools for data operations. Each represents a major capability:
- EnrichmentBuilder
- ScraperBuilder
- SchemaMapper
- DataMatchingBuilder

### `hooks/` (TODO)
Custom React hooks for reusable logic:
- `useAuth()` - Handle authentication state
- `useFetch()` - API calls with loading/error states
- `useLocalStorage()` - Persist state to localStorage

### `utils/` (TODO)
Helper functions that are independent of React:
- API request helpers
- Data validation functions
- Formatting/parsing utilities
- Utility constants

### `constants/` (TODO)
App-wide constants in one place:
- API endpoints and timeouts
- Theme colors and breakpoints
- Toast messages and error texts
- Validation rules and patterns

### `assets/`
Static files like images, logos, and icons.

## 🔄 Import Patterns

### ✅ Good - Using Index Files (Preferred)
```jsx
import { Footer, UserSidebar } from './components/common';
import { PricingPage } from './components/pages';
import { AuthModal, PaymentModal } from './components/modals';
import { EnrichmentBuilder, ScraperBuilder } from './features';
```

### ❌ Avoid - Direct Imports
```jsx
import Footer from './components/common/Footer';
import PricingPage from './components/pages/PricingPage';
```

## 📝 Adding New Components

### 1. Create Component File
```jsx
// src/components/common/Header.jsx
import React from 'react';

const Header = () => {
  return <header>{/* content */}</header>;
};

export default Header;
```

### 2. Add to Index File
```js
// src/components/common/index.js
export { default as Header } from './Header';
export { default as Footer } from './Footer';
// ...
```

### 3. Import in App.jsx
```jsx
import { Header, Footer } from './components/common';
```

## 🎯 Component Organization Tips

1. **Keep components focused** - One responsibility per component
2. **Use index files** - Makes imports cleaner and paths shorter
3. **Common vs Feature** - If used in multiple places → common/; If specific to a feature → features/
4. **Document props** - Add JSDoc comments for component props
5. **Create sub-folders** - For complex components, create a folder with component files

## 📚 Example: Adding a New Feature

```
1. Create feature builder: src/features/NewFeature.jsx
2. Create feature UI: src/components/pages/NewFeaturePage.jsx
3. Add to index files
4. Import in App.jsx
5. Add route/tab in App.jsx
```

## 🔗 Useful Commands

```bash
# Find all components
find src/components -name "*.jsx"

# See import structure
grep -r "^import" src/components

# Check unused files
# (run through your IDE)
```

## 📌 Notes

- All exports use named exports via index.js files
- Component names should be PascalCase
- Files should be organized by feature/purpose, not by type
- Keep styles co-located with components or in App.css
- Use Tailwind CSS classes for styling consistency

---

**Last Updated**: 15 February 2026
**Maintained By**: CleanFlow Team
