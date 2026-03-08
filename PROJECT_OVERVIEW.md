# v0-mcp Project Overview

## 📋 Table of Contents

- [Project Summary](#project-summary)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Development Workflow](#development-workflow)
- [Testing Strategy](#testing-strategy)
- [Error Handling](#error-handling)
- [Logging](#logging)
- [Integration Points](#integration-points)
- [Deployment](#deployment)
- [Contributing](#contributing)

## Project Summary

**v0-mcp** is a Model Context Protocol (MCP) server that integrates Vercel's v0 AI-powered UI generation capabilities with Claude Code and other MCP-compatible AI assistants.

### Key Information

- **Package Name**: `v0-mcp-node`
- **Version**: 1.0.0
- **License**: MIT
- **Author**: hellolucky
- **Repository**: https://github.com/hellolucky/v0-mcp
- **Language**: TypeScript (ES Modules)
- **Runtime**: Node.js 20.x+

### Features

✅ **Generate UI Components** - Create React components from natural language descriptions
✅ **Image to UI** - Convert design images into working React code
✅ **Chat-based Iteration** - Iteratively refine components through conversation
✅ **Multiple Models** - Support for v0-1.5-md, v0-1.5-lg, and v0-1.0-md
✅ **TypeScript Support** - Full type safety with Zod schema validation
✅ **Streaming Support** - Real-time generation progress
✅ **Enhanced Error Handling** - Categorized errors with retry logic
✅ **Structured Logging** - Winston-based logging with JSON format
✅ **Comprehensive Testing** - Jest testing framework with coverage reporting

## Architecture Overview

### Technology Stack

- **Runtime**: Node.js (ES Modules)
- **Language**: TypeScript 5.4+
- **MCP SDK**: @modelcontextprotocol/sdk ^0.5.0
- **API Client**: OpenAI SDK ^4.47.1
- **Validation**: Zod ^3.22.4
- **Logging**: Winston ^3.17.0
- **Testing**: Jest ^30.0.2 with ts-jest
- **Build**: TypeScript Compiler
- **Development**: tsx, nodemon

### Design Patterns

1. **Service Layer Pattern** - Separation of concerns between MCP server and v0 API service
2. **Error Handler Pattern** - Centralized error handling with categorization
3. **Configuration Management** - Environment-based configuration with validation
4. **Structured Logging** - Contextual logging with metadata
5. **Schema Validation** - Zod-based runtime type checking

## Project Structure

```
v0-mcp/
├── src/                          # Source code
│   ├── main.ts                   # MCP server entry point
│   ├── config/                   # Configuration management
│   │   └── index.ts             # Environment config & validation
│   ├── mcp/                      # MCP implementation
│   │   └── tools.ts             # Tool definitions & handlers
│   ├── services/                 # Business logic
│   │   └── v0Service.ts         # v0 API integration service
│   ├── types/                    # TypeScript types
│   │   └── index.ts             # Type definitions & schemas
│   └── utils/                    # Utilities
│       ├── logger.ts            # Structured logging
│       └── errors.ts            # Error handling
├── tests/                        # Test suite
│   └── unit/                    # Unit tests
│       ├── config/              # Config tests
│       ├── mcp/                 # MCP tools tests
│       ├── services/            # Service tests
│       └── types/               # Type validation tests
├── scripts/                      # Utility scripts
│   ├── verify-claude-code-setup.js   # Setup verification
│   └── test-basic-functionality.js   # Basic functionality test
├── dist/                         # Build output (generated)
├── .github/                      # GitHub configuration
│   └── workflows/
│       └── ci.yml               # CI/CD pipeline
├── docs/                         # Documentation (future)
├── examples/                     # Usage examples (future)
├── package.json                  # Project metadata & dependencies
├── tsconfig.json                 # TypeScript configuration
├── jest.config.js                # Jest test configuration
├── .eslintrc.json               # ESLint configuration
├── .env.example                  # Environment variables template
├── README.md                     # Main documentation
├── README_zh.md                  # Chinese documentation
├── CONTRIBUTING.md               # Contribution guidelines
├── CODE_OF_CONDUCT.md           # Code of conduct
└── LICENSE                       # MIT license

```

## Core Components

### 1. Main Server (`src/main.ts`)

**Purpose**: MCP server initialization and lifecycle management

**Key Responsibilities**:
- Initialize MCP server with stdio transport
- Register request handlers for tool listing and execution
- Handle graceful shutdown (SIGINT, SIGTERM)
- Process error handling (uncaught exceptions, unhandled rejections)
- Configuration validation on startup

**Server Configuration**:
```typescript
{
  name: "v0-mcp",
  version: "1.0.0",
  capabilities: {
    tools: {}
  }
}
```

**Request Handlers**:
- `ListToolsRequest` → Returns available v0 tools
- `CallToolRequest` → Executes v0 tool with arguments

### 2. v0 Service (`src/services/v0Service.ts`)

**Purpose**: Interface with v0 Platform API

**API Endpoints Used**:
- `POST /chats` - Create new chat for UI generation

**Methods**:

```typescript
class V0Service {
  // Generate UI from text prompt
  async generateUI(
    prompt: string,
    model: V0Model,
    stream: boolean,
    context?: string
  ): Promise<ToolResult>

  // Generate UI from image URL
  async generateFromImage(
    imageUrl: string,
    model: V0Model,
    prompt?: string
  ): Promise<ToolResult>

  // Chat-based iterative development
  async chatComplete(
    messages: Array<{role, content}>,
    model: V0Model,
    stream: boolean
  ): Promise<ToolResult>

  // Internal HTTP request handler
  private async request(endpoint: string, options: RequestInit): Promise<any>

  // Error handling
  private handleError(error: V0McpError | unknown): ToolResult
}
```

**Response Structure**:
```typescript
interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {
    model?: string;
    chatId?: string;
    webUrl?: string;
    duration?: number;
    usage?: { promptTokens, completionTokens, totalTokens };
    errorType?: string;
    statusCode?: number;
    retryable?: boolean;
  };
}
```

### 3. MCP Tools (`src/mcp/tools.ts`)

**Purpose**: Define and handle MCP tool calls

**Available Tools**:

#### `v0_generate_ui`
Generate UI components from text descriptions.

```typescript
{
  prompt: string;        // Required: Component description
  model?: V0Model;       // Optional: v0-1.5-md | v0-1.5-lg | v0-1.0-md
  stream?: boolean;      // Optional: Enable streaming
  context?: string;      // Optional: Existing code context
}
```

#### `v0_generate_from_image`
Generate UI components from image references.

```typescript
{
  imageUrl: string;      // Required: Image URL
  prompt?: string;       // Optional: Additional instructions
  model?: V0Model;       // Optional: v0 model to use
}
```

#### `v0_chat_complete`
Chat-based UI development with conversation context.

```typescript
{
  messages: Array<{     // Required: Conversation history
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model?: V0Model;      // Optional: v0 model to use
  stream?: boolean;     // Optional: Enable streaming
}
```

#### `v0_setup_check`
Validate v0 API configuration and connectivity.

```typescript
{} // No parameters required
```

**Tool Handler Flow**:
1. Receive tool call request
2. Validate arguments using Zod schemas
3. Execute corresponding service method
4. Format response for MCP protocol
5. Handle errors with user-friendly messages
6. Log tool execution with metadata

### 4. Configuration (`src/config/index.ts`)

**Purpose**: Centralized configuration management

**Configuration Structure**:

```typescript
interface AppConfig {
  v0: {
    apiKey: string;              // V0_API_KEY (required)
    baseUrl: string;             // V0_BASE_URL (default: https://api.v0.dev/v1)
    defaultModel: V0Model;       // V0_DEFAULT_MODEL (default: v0-1.5-md)
    timeout: number;             // V0_TIMEOUT (default: 60000)
  };
  mcp: {
    serverName: string;          // MCP_SERVER_NAME (default: v0-mcp)
    version: string;             // MCP_SERVER_VERSION (default: 1.0.0)
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';  // LOG_LEVEL (default: info)
  };
}
```

**Environment Variables**:
- ✅ **Required**: `V0_API_KEY`
- ❌ **Optional**: All others have defaults

### 5. Type Definitions (`src/types/index.ts`)

**Purpose**: TypeScript types and Zod schemas

**Key Types**:

```typescript
// v0 Models
type V0Model = 'v0-1.5-md' | 'v0-1.5-lg' | 'v0-1.0-md';

// Input Types
type GenerateUIInput = z.infer<typeof GenerateUISchema>;
type GenerateFromImageInput = z.infer<typeof GenerateFromImageSchema>;
type ChatCompleteInput = z.infer<typeof ChatCompleteSchema>;

// Output Types
interface ToolResult {
  success: boolean;
  content?: string;
  error?: string;
  metadata?: {...};
}

// Configuration Types
interface V0Config {...}
interface AppConfig {...}
```

**Validation Schemas**:
- `V0ModelSchema` - Valid v0 model names
- `GenerateUISchema` - v0_generate_ui input validation
- `GenerateFromImageSchema` - v0_generate_from_image input validation
- `ChatCompleteSchema` - v0_chat_complete input validation

### 6. Error Handling (`src/utils/errors.ts`)

**Purpose**: Centralized error handling with categorization

**Error Types**:

```typescript
enum ErrorType {
  API_ERROR,              // v0 API errors
  VALIDATION_ERROR,       // Input validation errors
  TIMEOUT_ERROR,          // Request timeouts
  RATE_LIMIT_ERROR,       // API rate limits
  AUTHENTICATION_ERROR,   // Invalid API key
  NETWORK_ERROR,          // Network connectivity issues
  UNKNOWN_ERROR          // Unhandled errors
}
```

**Error Class**:

```typescript
class V0McpError extends Error {
  type: ErrorType;
  statusCode?: number;
  retryable: boolean;
  context?: string;
  originalError?: Error;
}
```

**Error Handler Features**:
- ✅ Automatic error categorization
- ✅ HTTP status code mapping
- ✅ Retry logic with exponential backoff
- ✅ User-friendly error messages
- ✅ Structured error logging

**Retry Strategy**:
```typescript
// Maximum 3 retries for retryable errors
maxRetries: 3

// Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (max)
retryDelay: min(baseDelay * 2^attemptCount, 30000)

// Retryable errors:
- RATE_LIMIT_ERROR (429)
- TIMEOUT_ERROR (408, 504)
- API_ERROR (500, 502, 503)
- NETWORK_ERROR (ECONNREFUSED, ETIMEDOUT, etc.)
```

### 7. Logging (`src/utils/logger.ts`)

**Purpose**: Structured logging with Winston

**Log Levels**:
```typescript
levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
}
```

**Log Format**:
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "Tool call completed",
  "service": "v0-mcp",
  "tool": "v0_generate_ui",
  "success": true,
  "duration": 1234
}
```

**Helper Functions**:

```typescript
// Log API calls
logApiCall(method, model, promptTokens, completionTokens, duration)

// Log errors with context
logError(error, context, additionalInfo)

// Log tool execution
logToolCall(toolName, success, duration, additionalInfo)

// Log server events
logServerEvent(event, details)
```

**Transports**:
- Console (with colorized output for development)
- JSON format for production/debugging

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `V0_API_KEY` | ✅ | - | Your v0 API key from Vercel |
| `V0_BASE_URL` | ❌ | `https://api.v0.dev/v1` | v0 API base URL |
| `V0_DEFAULT_MODEL` | ❌ | `v0-1.5-md` | Default v0 model |
| `V0_TIMEOUT` | ❌ | `60000` | API timeout (ms) |
| `MCP_SERVER_NAME` | ❌ | `v0-mcp` | MCP server name |
| `MCP_SERVER_VERSION` | ❌ | `1.0.0` | MCP server version |
| `LOG_LEVEL` | ❌ | `info` | Logging level (debug/info/warn/error) |

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "sourceMap": true,
    "isolatedModules": true
  }
}
```

**Key Settings**:
- ✅ ES2022 target for modern JavaScript features
- ✅ NodeNext module system for ESM support
- ✅ Strict mode for type safety
- ✅ Declaration files for type checking
- ✅ Source maps for debugging

## Available Tools

### Tool Usage Examples

#### 1. Generate UI Component

```typescript
// MCP Tool Call
{
  "name": "v0_generate_ui",
  "arguments": {
    "prompt": "Create a modern login form with email, password fields, and a blue submit button with rounded corners",
    "model": "v0-1.5-md",
    "stream": false
  }
}

// Response
{
  "content": [{
    "type": "text",
    "text": "# Generated UI Component\n\n**Model**: v0-1.5-md\n**Prompt**: Create a modern login form...\n\n[React component code here]"
  }]
}
```

#### 2. Convert Design to Code

```typescript
// MCP Tool Call
{
  "name": "v0_generate_from_image",
  "arguments": {
    "imageUrl": "https://example.com/design.png",
    "prompt": "Convert this wireframe into a fully functional React component with modern styling",
    "model": "v0-1.5-md"
  }
}
```

#### 3. Iterative Development

```typescript
// MCP Tool Call
{
  "name": "v0_chat_complete",
  "arguments": {
    "messages": [
      {"role": "user", "content": "Create a pricing table component"},
      {"role": "assistant", "content": "[Previous pricing table code]"},
      {"role": "user", "content": "Add a popular plan highlight and annual/monthly toggle"}
    ],
    "model": "v0-1.5-md"
  }
}
```

#### 4. Setup Verification

```typescript
// MCP Tool Call
{
  "name": "v0_setup_check",
  "arguments": {}
}

// Response
{
  "content": [{
    "type": "text",
    "text": "✅ v0 API Setup Check Passed\n\n**Status**: Connected\n**Model**: v0-1.5-md\n\nv0 MCP server is ready for use!"
  }]
}
```

## Development Workflow

### NPM Scripts

```json
{
  "build": "tsc",                                    // Compile TypeScript
  "start": "node dist/main.js",                      // Start production server
  "dev": "nodemon --watch 'src/**/*.ts' --exec 'tsx' src/main.ts",  // Development mode
  "lint": "eslint . --ext .ts",                      // Run linter
  "clean": "rm -rf dist",                            // Clean build artifacts
  "test": "jest",                                    // Run tests
  "test:watch": "jest --watch",                      // Watch mode
  "test:coverage": "jest --coverage",                // Coverage report
  "test:ci": "jest --ci --watchAll=false",          // CI mode
  "test:config": "tsx src/main.ts --help",          // Test config
  "test:basic": "V0_API_KEY=test-key node scripts/test-basic-functionality.js",
  "verify:claude-code": "node scripts/verify-claude-code-setup.js",
  "setup": "cp .env.example .env"                   // Setup environment
}
```

### Development Setup

```bash
# 1. Clone repository
git clone <repository-url>
cd v0-mcp

# 2. Install dependencies
npm install

# 3. Create environment file
npm run setup
# Edit .env with your V0_API_KEY

# 4. Start development server
npm run dev

# 5. Run tests
npm test

# 6. Build for production
npm run build

# 7. Start production server
npm start
```

### Development Tools

- **TypeScript Compiler**: Type checking and compilation
- **tsx**: TypeScript execution for development
- **nodemon**: Auto-restart on file changes
- **ESLint**: Code quality and style checking
- **Jest**: Unit and integration testing
- **ts-jest**: TypeScript support for Jest

## Testing Strategy

### Test Configuration (`jest.config.js`)

```javascript
{
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/main.ts'
  ],
  coverageReporters: ['text', 'lcov', 'html']
}
```

### Test Structure

```
tests/
└── unit/
    ├── config/
    │   └── index.test.ts      # Configuration tests
    ├── mcp/
    │   └── tools.test.ts      # MCP tools tests
    ├── services/
    │   └── v0Service.test.ts  # v0 service tests
    └── types/
        └── index.test.ts      # Type validation tests
```

### Testing Best Practices

1. **Unit Tests** - Test individual functions in isolation
2. **Mock External Dependencies** - Mock v0 API calls
3. **Schema Validation Tests** - Verify Zod schemas
4. **Error Handling Tests** - Test error scenarios
5. **Edge Cases** - Test boundary conditions
6. **Coverage Goals** - Maintain >80% code coverage

### Test Examples

```typescript
// Example: Testing v0_generate_ui
describe('v0_generate_ui', () => {
  it('should generate UI from prompt', async () => {
    const result = await v0Service.generateUI('Create a button');
    expect(result.success).toBe(true);
    expect(result.content).toBeDefined();
  });

  it('should handle API errors', async () => {
    // Mock API error
    const result = await v0Service.generateUI('');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

## Error Handling

### Error Flow

```
1. Error occurs
   ↓
2. ErrorHandler.handleError()
   ↓
3. Categorize error type
   ↓
4. Create V0McpError
   ↓
5. Log error with context
   ↓
6. Return user-friendly message
   ↓
7. Optionally retry (if retryable)
```

### Error Categories

```typescript
// API Errors (Status Code Based)
401 → AUTHENTICATION_ERROR
429 → RATE_LIMIT_ERROR (retryable)
408, 504 → TIMEOUT_ERROR (retryable)
500, 502, 503 → API_ERROR (retryable)

// Network Errors
ECONNREFUSED, ENOTFOUND, ETIMEDOUT, ECONNRESET → NETWORK_ERROR (retryable)

// Other Errors
ValidationError → VALIDATION_ERROR
Unknown → UNKNOWN_ERROR
```

### Error Response Format

```typescript
{
  success: false,
  error: "User-friendly error message",
  metadata: {
    errorType: "API_ERROR",
    statusCode: 500,
    retryable: true,
    context: "generateUI"
  }
}
```

## Logging

### Log Levels

- **ERROR**: Errors requiring immediate attention
- **WARN**: Warning conditions
- **INFO**: Informational messages (default)
- **DEBUG**: Detailed debugging information

### Log Examples

```json
// Server started
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "Server event",
  "service": "v0-mcp",
  "event": "server_started",
  "availableTools": 4
}

// Tool call
{
  "timestamp": "2024-01-01T12:01:00.000Z",
  "level": "INFO",
  "message": "Tool call completed",
  "service": "v0-mcp",
  "tool": "v0_generate_ui",
  "success": true,
  "duration": 1234
}

// Error
{
  "timestamp": "2024-01-01T12:02:00.000Z",
  "level": "ERROR",
  "message": "Error occurred",
  "service": "v0-mcp",
  "context": "generateUI",
  "errorType": "API_ERROR",
  "statusCode": 500
}
```

## Integration Points

### Claude Code Integration

**Installation**:
```bash
# Method 1: CLI (Recommended)
claude mcp add v0-mcp --env V0_API_KEY=your_key -- node /path/to/v0-mcp/dist/main.js

# Method 2: Manual (.claude.json)
{
  "mcpServers": {
    "v0-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/path/to/v0-mcp/dist/main.js"],
      "env": {
        "V0_API_KEY": "your_v0_api_key_here"
      }
    }
  }
}
```

**Usage**:
```
# In Claude Code
Hey v0-mcp, create a modern login form

# Or specific tool
Use v0_generate_ui to create a dashboard component
```

### Claude Desktop Integration

**Configuration** (`claude_desktop_config.json`):
```json
{
  "mcpServers": {
    "v0-mcp": {
      "command": "node",
      "args": ["/path/to/v0-mcp/dist/main.js"],
      "env": {
        "V0_API_KEY": "your_v0_api_key_here"
      }
    }
  }
}
```

### Cursor Integration

**Configuration** (Cursor MCP settings):
```json
{
  "mcpServers": {
    "v0-mcp": {
      "command": "node",
      "args": ["/path/to/v0-mcp/dist/main.js"],
      "env": {
        "V0_API_KEY": "your_v0_api_key_here"
      }
    }
  }
}
```

## Deployment

### Build Process

```bash
# 1. Clean previous builds
npm run clean

# 2. Build TypeScript
npm run build

# 3. Verify build
ls -la dist/
```

### CI/CD Pipeline (`.github/workflows/ci.yml`)

```yaml
Jobs:
  test:
    - Checkout code
    - Setup Node.js 20.x
    - Install dependencies (npm ci)
    - Run linter (npm run lint)
    - Build project (npm run build)
    - Test basic functionality (npm run test:basic)
```

**Triggers**:
- Push to `main` branch
- Pull requests to `main` branch

### Production Deployment

1. **Build** - Compile TypeScript to JavaScript
2. **Test** - Run full test suite
3. **Package** - Include dist/, package.json, .env
4. **Deploy** - Copy to production server
5. **Configure** - Set up MCP client configuration
6. **Start** - Run `npm start`
7. **Monitor** - Check logs and health

### Docker Deployment (Future)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist ./dist
ENV V0_API_KEY=""
CMD ["node", "dist/main.js"]
```

## Contributing

### Contribution Workflow

1. **Fork** the repository
2. **Clone** your fork
3. **Create** feature branch (`git checkout -b feature/amazing-feature`)
4. **Install** dependencies (`npm install`)
5. **Make** changes
6. **Test** your changes (`npm test`)
7. **Lint** code (`npm run lint`)
8. **Build** project (`npm run build`)
9. **Commit** changes (`git commit -m 'feat: add amazing feature'`)
10. **Push** to branch (`git push origin feature/amazing-feature`)
11. **Open** Pull Request

### Commit Message Convention

Following [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Code Style Guidelines

**TypeScript**:
- Use TypeScript for all new code
- Enable strict mode
- Prefer interfaces over type aliases
- Use explicit return types
- Document complex functions with JSDoc

**General**:
- Use meaningful variable and function names
- Keep functions small and focused
- Write self-documenting code
- Add comments only when necessary
- Follow existing code patterns

**Testing**:
- Write tests for all new features
- Maintain or improve code coverage
- Use descriptive test names
- Test edge cases and error scenarios

### Pull Request Checklist

- [ ] Code follows project style guidelines
- [ ] Tests added/updated and passing
- [ ] Documentation updated
- [ ] Linter passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Commit messages follow convention
- [ ] No breaking changes (or documented)
- [ ] PR description explains changes

## Additional Resources

### Documentation

- **README.md** - Main documentation (English)
- **README_zh.md** - Chinese documentation
- **CONTRIBUTING.md** - Contribution guidelines
- **CODE_OF_CONDUCT.md** - Community standards
- **LICENSE** - MIT license

### External Links

- [v0 Platform API Documentation](https://vercel.com/docs/v0/model-api)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Claude Code Documentation](https://claude.com/claude-code)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Jest Testing Framework](https://jestjs.io/)

### Support

- **Issues**: https://github.com/hellolucky/v0-mcp/issues
- **Discussions**: GitHub Discussions
- **Support the Project**: [Buy Me A Coffee](https://coff.ee/hellolucky)

---

**Last Updated**: 2024-01-01
**Project Version**: 1.0.0
**Document Version**: 1.0.0
