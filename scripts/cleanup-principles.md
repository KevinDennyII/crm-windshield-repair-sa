# Code Cleanup Principles

This document outlines the code quality principles used by the cleanup analyzer script.
Based on Clean Code by Robert Martin, Josh Comeau's Joy of React / CSS for JS Devs courses,
and Steve Gibson's Security Now principles (TWiT.tv).

## Security Principles (Steve Gibson - Security Now)

### 1. Defense in Depth
**Never rely on a single layer of security.**
- Implement multiple, overlapping security controls
- Assume any individual layer can fail
- Backend must always validate even if frontend does too
- Authentication + authorization + input validation + output encoding

```typescript
// BAD: Only frontend validation
<input maxLength={100} />

// GOOD: Defense in depth - validate at every layer
// Frontend: <input maxLength={100} />
// Backend route: validate with Zod schema
// Database: column constraints
// Output: sanitize before rendering
```

### 2. Minimize Attack Surface
**If you don't need it, turn it off.**
- Remove unused API endpoints, routes, and middleware
- Don't expose internal details in error messages
- Disable debug features in production
- Remove unused dependencies that could introduce vulnerabilities
- Don't serve unnecessary data from API responses

```typescript
// BAD: Exposing internal details
res.status(500).json({ error: err.stack, query: sql });

// GOOD: Minimal error exposure
res.status(500).json({ error: "An error occurred" });
// Log the full details server-side only
console.error("Internal error:", err);
```

### 3. Zero Trust / Never Trust User Input
**Validate and sanitize ALL inputs, always.**
- Never trust data from the client (forms, query params, headers)
- Validate types, lengths, formats, and ranges
- Use parameterized queries (never string interpolation for SQL)
- Sanitize output to prevent XSS

```typescript
// BAD: Trusting user input
const name = req.body.name;
db.query(`SELECT * FROM users WHERE name = '${name}'`); // SQL injection!

// GOOD: Parameterized + validated
const { name } = schema.parse(req.body); // Zod validation
db.query("SELECT * FROM users WHERE name = $1", [name]);
```

### 4. Least Privilege
**Grant only the minimum permissions necessary.**
- API keys should have the narrowest scope possible
- Database connections should use limited-privilege accounts
- Role-based access: users get only what they need
- Components receive handler functions, not raw state setters

```typescript
// BAD: Returning all user fields including password hash
app.get('/api/users', (req, res) => res.json(users));

// GOOD: Select only needed fields, strip sensitive data
app.get('/api/users', (req, res) => {
  const safeUsers = users.map(({ password, ...user }) => user);
  res.json(safeUsers);
});
```

### 5. Secrets Management
**Never expose secrets in code, logs, or client-side.**
- Use environment variables for API keys, tokens, credentials
- Never commit secrets to version control
- Don't log sensitive values (passwords, tokens, keys)
- Don't send secrets to the frontend
- Rotate credentials regularly

```typescript
// BAD: Hardcoded secrets
const API_KEY = "sk-abc123...";
console.log("Auth token:", token); // Logging secrets!

// GOOD: Environment variables, no logging
const API_KEY = process.env.API_KEY;
console.log("Auth succeeded for user:", userId);
```

### 6. Security by Design
**Build security in from the start, not bolted on after.**
- Use HTTPS everywhere
- Set security headers (CORS, CSP, HSTS)
- Implement rate limiting on authentication endpoints
- Use proper password hashing (bcrypt, argon2)
- Session management with secure, httpOnly cookies

### 7. Cryptography Done Right
**Use proven algorithms, never roll your own.**
- Use established libraries (bcrypt, crypto)
- Never create custom encryption algorithms
- Use high-entropy random number generation
- Keep cryptographic dependencies updated

```typescript
// BAD: Rolling own "encryption"
const hash = btoa(password); // Not encryption!
const token = Math.random().toString(36); // Predictable!

// GOOD: Proper cryptography
import bcrypt from 'bcrypt';
const hash = await bcrypt.hash(password, 12);
import crypto from 'crypto';
const token = crypto.randomBytes(32).toString('hex');
```

### 8. Keep Dependencies Updated
**Outdated dependencies are a top attack vector.**
- Regularly audit and update packages
- Monitor for CVEs in your dependency tree
- Remove unused packages to reduce risk
- Pin versions for reproducible builds

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

### Security (Steve Gibson)
1. **Hardcoded secrets** - API keys, passwords, tokens in source code
2. **Missing input validation** - Endpoints without Zod/schema validation
3. **Exposed error details** - Stack traces or SQL in error responses
4. **Excessive data exposure** - Returning password hashes or internal IDs unnecessarily
5. **Missing auth checks** - API routes without authentication/authorization middleware
6. **Insecure randomness** - Using Math.random() for security-sensitive operations
7. **Logging secrets** - Console.log of tokens, passwords, or API keys
8. **Unused endpoints** - Dead API routes that increase attack surface

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

- Security Now: https://twit.tv/shows/security-now
- GRC (Gibson Research Corporation): https://www.grc.com
- Security Now Episode Archive: https://www.grc.com/securitynow.htm
- React Notes: https://separated-day-526.notion.site/The-Joy-Of-React-d234359051a44f2ca721bcb4c9ec5de5
- CSS Notes: https://separated-day-526.notion.site/ea79a7c11e9940f9bd572a40dd1f8957?v=182e5001986249b6a283bafa7a96b343
