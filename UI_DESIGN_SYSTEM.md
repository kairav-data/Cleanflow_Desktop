# CleanFlow Desktop UI System

## Wireframe

```
+----------------------------------------------------------------------------------+
| Header: App Name | Search | Notifications | Theme | User                         |
+---------------------------+------------------------------------------------------+
| Sidebar                   | Main Content                                         |
| - Dashboard               | - Dashboard overview                                 |
| - Tasks                   | - Workflow builder                                   |
| - Configuration           | - Smart forms                                        |
| - Logs                    | - Data preview                                       |
| - Settings                | - Sticky action footer                               |
+---------------------------+------------------------------------------------------+
```

## Navigation Model

- `Dashboard`: overview, metrics, empty-state onboarding, UI system summary
- `Tasks`: guided workflow builder, smart forms, instant preview, sticky actions
- `Configuration`: reusable setup patterns and future feature scaffolding
- `Logs`: toasts, progress, expandable execution details
- `Settings`: theme, readability, accessibility defaults

## Reusable Component System

- Foundations: spacing scale, radii, shadows, theme tokens, typography
- Inputs: searchable dropdowns, multi-selects, inline validation, smart suggestions
- Feedback: toasts, status pills, progress bars, inline warnings, log accordions
- Workflow: step cards, connectors, add-step actions, ordering controls
- Data: sortable preview table, issue highlighting, summary rails
- Layout: sidebar, header, surfaces, sticky action bar, empty states

## Color Palette

- Background: `#F4F7F3`
- Elevated background: `#EEF3EF`
- Panel: `rgba(255,255,255,0.82)`
- Accent: `#1F8F74`
- Accent soft: `rgba(31,143,116,0.12)`
- Text primary: `#15211B`
- Text secondary: `#4E6258`
- Success: `#10B981`
- Warning: `#F59E0B`
- Error: `#F43F5E`

Dark mode mirrors the same hierarchy with deeper green-charcoal panels and mint accent contrast.

## Typography

- Primary UI font: `Segoe UI Variable Text`, fallback `Segoe UI`
- Headings: semibold with tight tracking
- Body: regular weight, generous spacing for readability
- Labels: small uppercase eyebrow text for scanability

## UX Rules

- No code entry required for primary flows
- Invalid actions stay disabled until prerequisites are met
- Every complex field includes inline explanation or suggested default
- Important actions remain visible in a sticky footer
- Empty states always include a next action

## Scalability Notes

- New modules should plug into the same sidebar and header shell
- Feature screens should be assembled from shared `Surface`, button, form, and feedback primitives
- Theme tokens should remain the single source of truth for light and dark styling
