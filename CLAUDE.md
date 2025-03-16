# Your Sanskrit Teacher Development Guide

## Build/Test Commands
- **Start development server:** `cd session-app && npm start`
- **Build production:** `cd session-app && npm run build`
- **Run all tests:** `cd session-app && npm test`
- **Run single test:** `cd session-app && npm test -- -t "test name"`
- **Lint:** `cd session-app && npx eslint src`
- **Connect platform (Python):** `cd connectplatform && python3 app.py`

## Code Style Guidelines
- **React components:** Use functional components with hooks
- **Imports:** Group by type (React, external libs, internal components, styles)
- **Naming:** camelCase for variables/functions, PascalCase for components/classes
- **Types:** Use PropTypes for component props
- **Error handling:** Use try/catch with specific error messages
- **AWS services:** Use Amplify API for AWS services
- **Formatting:** 2-space indentation, consistent trailing commas
- **CSS:** Prefer component-specific CSS files or CSS-in-JS
- **Testing:** Use React Testing Library with descriptive test names