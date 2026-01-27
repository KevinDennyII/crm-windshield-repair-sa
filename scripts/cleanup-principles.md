# Code Cleanup Principles

This document outlines the code quality principles used by the cleanup analyzer script.
Based on Clean Code by Robert Martin and Josh Comeau's Joy of React / CSS for JS Devs courses.

## React Principles (Josh Comeau)

### 1. Deriving State
**Always store the minimum amount of data in state.**
- If a value can be calculated from existing state, don't store it separately
- Calculate derived values during render instead of syncing with useEffect
- Reduces bugs from state getting out of sync

```jsx
// BAD: Storing derived state
const [items, setItems] = useState([]);
const [itemCount, setItemCount] = useState(0); // Derived!

// GOOD: Calculate during render
const [items, setItems] = useState([]);
const itemCount = items.length; // Derived value
```

### 2. Single Source of Truth
- Use controlled inputs bound to React state
- Don't mix controlled and uncontrolled patterns
- React state should be the authority for form values

```jsx
// GOOD: Controlled input
const [name, setName] = useState('');
<input value={name} onChange={(e) => setName(e.target.value)} />
```

### 3. Principle of Least Privilege
**Give components only the power they need.**
- Pass handler functions, not state setters
- Components should have minimal ability to break things
- Reduces bugs at scale with multiple developers

```jsx
// BAD: Passing setter gives too much power
<AddItemForm setItems={setItems} />

// GOOD: Pass a specific handler
<AddItemForm onAddItem={handleAddItem} />
```

### 4. Leveraging Keys Properly
- Keys should be stable, unique identifiers (not array indices for dynamic lists)
- Use keys to reset component state when needed
- Keys tell React which elements correspond across renders

### 5. Lifting Content Up
- Move static content to parent components when possible
- Reduces unnecessary re-renders
- Children passed as props don't re-render when parent state changes

### 6. Component API Design
- **Prop Delegation**: Spread remaining props to underlying elements
- **Compound Components**: Related components that share implicit state
- **Polymorphism**: Components that can render as different elements (as prop)
- Keep component APIs minimal but flexible

## CSS Principles (Josh Comeau)

### 1. The Box Model
- Always use `box-sizing: border-box`
- Understand how padding, margin, and borders affect element size

### 2. Flow Layout Understanding
- Know when elements are block vs inline
- Understand how margin collapse works
- Use appropriate layout modes (flexbox, grid)

### 3. Modern Component Architecture
- Use CSS variables for theming and consistency
- Prefer composition over complex selectors
- Keep specificity low and predictable

### 4. Avoid Common CSS Mistakes
- Don't use magic numbers without comments
- Use relative units (rem, em) over fixed pixels for typography
- Leverage CSS custom properties for repeated values

## Clean Code Principles (Robert Martin)

### 1. Meaningful Names
- Use intention-revealing names
- Avoid abbreviations that aren't universally understood
- Functions should describe what they do
- Variables should describe what they contain

```javascript
// BAD
const d = new Date();
const calc = (a, b) => a + b;

// GOOD
const currentDate = new Date();
const calculateTotal = (price, tax) => price + tax;
```

### 2. Small Functions
- Functions should do ONE thing
- Functions should be small (ideally < 20 lines)
- Extract helper functions for complex logic
- Each function should have a single level of abstraction

### 3. Single Responsibility Principle
- Each module/component should have one reason to change
- Separate concerns (data fetching, rendering, business logic)
- Keep components focused

### 4. DRY (Don't Repeat Yourself)
- Extract repeated logic into reusable functions
- Create shared utilities for common operations
- Use constants for repeated values

### 5. Comments
- Code should be self-documenting
- Comments explain WHY, not WHAT
- Delete commented-out code
- Update or remove outdated comments

### 6. Formatting
- Consistent indentation (2 spaces for this project)
- Logical grouping of related code
- Consistent naming conventions (camelCase for functions/variables)
- Keep files focused and not too long

## Code Smells to Look For

### React-Specific
1. **Prop drilling** - Passing props through many layers (use Context)
2. **State duplication** - Same data stored in multiple places
3. **Unnecessary useEffect** - Effects that could be derived state or event handlers
4. **Missing dependencies** - useEffect/useMemo/useCallback with incomplete deps
5. **Inline functions in JSX** - Functions recreated every render (usually fine, but watch for performance)
6. **Giant components** - Components doing too many things (> 200 lines is suspicious)

### General Code
1. **Magic numbers** - Unexplained numeric values
2. **Long functions** - Functions > 30 lines
3. **Deep nesting** - More than 3 levels of indentation
4. **Duplicate code** - Same logic in multiple places
5. **Dead code** - Unused functions, variables, imports
6. **Inconsistent naming** - Mixed naming conventions

## Reference Links

- React Notes: https://separated-day-526.notion.site/The-Joy-Of-React-d234359051a44f2ca721bcb4c9ec5de5
- CSS Notes: https://separated-day-526.notion.site/ea79a7c11e9940f9bd572a40dd1f8957?v=182e5001986249b6a283bafa7a96b343
