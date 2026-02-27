/**
 * Language detection by file extension.
 * Maps extensions → language names for labeling in prompts and diagrams.
 */

const EXTENSION_MAP = {
  // JavaScript / TypeScript
  '.js': 'JavaScript',
  '.jsx': 'JavaScript (JSX)',
  '.mjs': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript (TSX)',
  '.mts': 'TypeScript',

  // Python
  '.py': 'Python',
  '.pyw': 'Python',
  '.pyi': 'Python',

  // Java / Kotlin
  '.java': 'Java',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',

  // Go
  '.go': 'Go',

  // Ruby
  '.rb': 'Ruby',
  '.erb': 'Ruby (ERB)',

  // C#
  '.cs': 'C#',

  // PHP
  '.php': 'PHP',

  // Rust
  '.rs': 'Rust',

  // C / C++
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.hpp': 'C++',
  '.cc': 'C++',

  // Swift
  '.swift': 'Swift',

  // Dart
  '.dart': 'Dart',

  // Scala
  '.scala': 'Scala',

  // Elixir / Erlang
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',

  // SQL
  '.sql': 'SQL',

  // Config / Schema
  '.prisma': 'Prisma',
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  '.proto': 'Protobuf',

  // Markup / Templates
  '.html': 'HTML',
  '.htm': 'HTML',
  '.vue': 'Vue',
  '.svelte': 'Svelte',

  // Styles
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',

  // Config
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.json': 'JSON',
  '.xml': 'XML',
};

/** Set of extensions we consider "source code" worth analyzing */
const SOURCE_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
  '.mts',
  '.py',
  '.pyw',
  '.pyi',
  '.java',
  '.kt',
  '.kts',
  '.go',
  '.rb',
  '.erb',
  '.cs',
  '.php',
  '.rs',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cc',
  '.swift',
  '.dart',
  '.scala',
  '.ex',
  '.exs',
  '.erl',
  '.sql',
  '.prisma',
  '.graphql',
  '.gql',
  '.proto',
  '.html',
  '.htm',
  '.vue',
  '.svelte',
]);

/**
 * Detect language from file extension.
 * @param {string} filePath
 * @returns {string|null} Language name or null if unknown
 */
export function detectLanguage(filePath) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  return EXTENSION_MAP[ext] || null;
}

/**
 * Check if a file is a source file worth analyzing.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isSourceFile(filePath) {
  const ext = '.' + filePath.split('.').pop().toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

export { EXTENSION_MAP, SOURCE_EXTENSIONS };
