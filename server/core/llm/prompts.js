/**
 * Structured extraction prompts for LLM-powered code analysis.
 * Each prompt instructs the LLM to return well-defined JSON schemas.
 */

const SYSTEM_PROMPT = `You are CodeLens, an expert code analyst. You analyze source code files and extract structured information.
You MUST respond ONLY with valid JSON — no markdown, no code fences, no explanations. Just raw JSON.
If a category has no findings, return an empty array for that field.
Be thorough but precise. Only report things you can clearly identify from the code.`;

/**
 * Build the full analysis prompt for a batch of files.
 * This is a single comprehensive extraction prompt that gets everything in one pass.
 *
 * @param {Array<{relativePath: string, language: string, content: string}>} files
 * @returns {{ userPrompt: string, systemPrompt: string }}
 */
export function buildAnalysisPrompt(files) {
  const fileBlocks = files
    .map(
      (f, i) =>
        `--- FILE ${i + 1}: ${f.relativePath} [${f.language}] ---\n${f.content}\n--- END FILE ${i + 1} ---`,
    )
    .join('\n\n');

  const userPrompt = `Analyze the following source code files and extract ALL of the information described below.

${fileBlocks}

Return a JSON object with the following structure:

{
  "components": [
    {
      "name": "component/module name",
      "type": "module|package|service|library|controller|model|utility|middleware|config",
      "directory": "relative directory path",
      "description": "brief description of purpose",
      "dependencies": ["names of other components this depends on"],
      "files": ["relative file paths belonging to this component"]
    }
  ],

  "classes": [
    {
      "name": "ClassName",
      "file": "relative file path",
      "language": "language name",
      "type": "class|interface|abstract|enum|struct|trait",
      "extends": "parent class name or null",
      "implements": ["interface names"],
      "fields": [
        { "name": "fieldName", "type": "type or unknown", "visibility": "public|private|protected" }
      ],
      "methods": [
        { "name": "methodName", "returnType": "type or unknown", "visibility": "public|private|protected", "isStatic": false }
      ],
      "relationships": [
        { "target": "OtherClassName", "type": "extends|implements|composes|uses|aggregates" }
      ]
    }
  ],

  "database": {
    "models": [
      {
        "name": "ModelName",
        "tableName": "table_name",
        "file": "relative file path",
        "orm": "ORM name (e.g. Sequelize, TypeORM, Prisma, Django, SQLAlchemy, ActiveRecord, GORM) or raw SQL",
        "columns": [
          { "name": "column_name", "type": "data type", "isPrimary": false, "isNullable": true, "defaultValue": null }
        ],
        "relationships": [
          { "type": "one-to-many|many-to-one|many-to-many|one-to-one|belongs-to|has-many", "target": "OtherModelName", "foreignKey": "fk_column or null" }
        ]
      }
    ]
  },

  "endpoints": [
    {
      "method": "GET|POST|PUT|DELETE|PATCH",
      "path": "/api/path",
      "handler": "handlerFunction or Controller.method",
      "file": "relative file path",
      "framework": "Express|FastAPI|Spring|etc",
      "middleware": ["auth", "validation", "etc"],
      "description": "brief description"
    }
  ],

  "externalAPIs": [
    {
      "service": "service name (e.g. Stripe, AWS S3, Twilio, or domain name)",
      "url": "base URL or endpoint pattern if identifiable",
      "method": "HTTP method or SDK method",
      "file": "relative file path",
      "sdk": "SDK name if using an SDK, null if raw HTTP",
      "purpose": "brief description of what this call does"
    }
  ],

  "dependencyFlows": [
    {
      "name": "flow name (e.g. User Registration, Order Processing)",
      "steps": [
        { "from": "component/class name", "to": "component/class name", "action": "calls|queries|sends|publishes", "description": "brief description" }
      ]
    }
  ],

  "architecture": {
    "patterns": ["MVC", "REST API", "Microservices", "Event-Driven", "CQRS", "Repository Pattern", "etc."],
    "techStack": {
      "languages": ["language names found"],
      "frameworks": ["framework names found"],
      "databases": ["database types inferred"],
      "messageBrokers": ["if any"],
      "other": ["other notable technologies"]
    },
    "securitySurface": {
      "authMechanism": "JWT|OAuth|Session|API Key|None identified",
      "protectedEndpoints": ["paths that have auth middleware"],
      "unprotectedEndpoints": ["paths without auth"],
      "dbWritePaths": ["endpoints or functions that write to the database"]
    },
    "summary": "2-3 sentence high-level architectural summary"
  }
}

IMPORTANT RULES:
- Respond with ONLY the JSON object, no other text
- Use empty arrays [] for categories with no findings
- Be specific about relationships between classes and components
- For endpoints, always include the full path pattern
- For external APIs, try to identify the service name even from URL patterns
- For dependency flows, trace the most important request/data paths through the codebase
- For architecture patterns, only list patterns you can clearly identify from the code`;

  return { userPrompt, systemPrompt: SYSTEM_PROMPT };
}

/**
 * Build a lightweight overview prompt for initial project scanning.
 * Used when we just need a high-level summary.
 *
 * @param {Array<string>} filePaths  List of all file paths in the project
 * @returns {{ userPrompt: string, systemPrompt: string }}
 */
export function buildOverviewPrompt(filePaths) {
  const fileList = filePaths.join('\n');

  const userPrompt = `Based on this project's file structure, provide a high-level analysis.

FILE STRUCTURE:
${fileList}

Return a JSON object:
{
  "projectName": "inferred project name",
  "projectType": "web-app|api|library|cli|mobile|desktop|monorepo|other",
  "primaryLanguage": "main language",
  "frameworks": ["detected frameworks"],
  "estimatedComponents": ["list of likely component/module names based on directory structure"],
  "summary": "1-2 sentence description of what this project appears to be"
}

Respond with ONLY the JSON object.`;

  return { userPrompt, systemPrompt: SYSTEM_PROMPT };
}
