"use strict";
/**
 * Structured extraction prompts for LLM-powered code analysis.
 * Ported from server/core/llm/prompts.js — pure string logic, no changes.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildAnalysisPrompt = buildAnalysisPrompt;
exports.buildOverviewPrompt = buildOverviewPrompt;
const SYSTEM_PROMPT = `You are CodeLens, an expert code analyst. You analyze source code files and extract structured information.
You MUST respond ONLY with valid JSON — no markdown, no code fences, no explanations. Just raw JSON.
If a category has no findings, return an empty array for that field.
Be thorough but precise. Only report things you can clearly identify from the code.`;
function buildAnalysisPrompt(files) {
    const fileBlocks = files
        .map((f, i) => `--- FILE ${i + 1}: ${f.relativePath} [${f.language}] ---\n${f.content}\n--- END FILE ${i + 1} ---`)
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
        "orm": "ORM name or raw SQL",
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
      "middleware": ["auth", "validation"],
      "description": "brief description"
    }
  ],

  "externalAPIs": [
    {
      "service": "service name (e.g. Stripe, AWS S3)",
      "url": "base URL or endpoint pattern",
      "method": "HTTP method or SDK method",
      "file": "relative file path",
      "sdk": "SDK name if using an SDK, null if raw HTTP",
      "purpose": "brief description"
    }
  ],

  "dependencyFlows": [
    {
      "name": "flow name (e.g. User Registration)",
      "steps": [
        { "from": "component/class name", "to": "component/class name", "action": "calls|queries|sends|publishes", "description": "brief" }
      ]
    }
  ],

  "architecture": {
    "patterns": ["MVC", "REST API", "etc"],
    "techStack": {
      "languages": ["language names"],
      "frameworks": ["framework names"],
      "databases": ["database types"],
      "messageBrokers": ["if any"],
      "other": ["other notable technologies"]
    },
    "securitySurface": {
      "authMechanism": "JWT|OAuth|Session|API Key|None identified",
      "protectedEndpoints": ["/paths with auth"],
      "unprotectedEndpoints": ["/paths without auth"],
      "dbWritePaths": ["endpoints or functions that write to db"]
    },
    "summary": "2-3 sentence high-level architectural summary"
  }
}

IMPORTANT RULES:
- Respond with ONLY the JSON object, no other text
- Use empty arrays [] for categories with no findings
- For endpoints, always include the full path pattern
- For architecture patterns, only list patterns you can clearly identify from the code`;
    return { userPrompt, systemPrompt: SYSTEM_PROMPT };
}
function buildOverviewPrompt(filePaths) {
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
  "estimatedComponents": ["list of likely module names"],
  "summary": "1-2 sentence description"
}

Respond with ONLY the JSON object.`;
    return { userPrompt, systemPrompt: SYSTEM_PROMPT };
}
//# sourceMappingURL=prompts.js.map