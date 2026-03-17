/**
 * Language detection by file extension.
 * Ported from server/core/lang-detect.js — pure utility, no changes needed.
 */

const EXTENSION_MAP: Record<string, string> = {
    '.js': 'JavaScript', '.jsx': 'JavaScript (JSX)', '.mjs': 'JavaScript',
    '.ts': 'TypeScript', '.tsx': 'TypeScript (TSX)', '.mts': 'TypeScript',
    '.py': 'Python', '.pyw': 'Python', '.pyi': 'Python',
    '.java': 'Java', '.kt': 'Kotlin', '.kts': 'Kotlin',
    '.go': 'Go', '.rb': 'Ruby', '.erb': 'Ruby (ERB)', '.cs': 'C#', '.php': 'PHP',
    '.rs': 'Rust', '.c': 'C', '.h': 'C', '.cpp': 'C++', '.hpp': 'C++', '.cc': 'C++',
    '.swift': 'Swift', '.dart': 'Dart', '.scala': 'Scala',
    '.ex': 'Elixir', '.exs': 'Elixir', '.erl': 'Erlang',
    '.sql': 'SQL', '.prisma': 'Prisma', '.graphql': 'GraphQL', '.gql': 'GraphQL', '.proto': 'Protobuf',
    '.html': 'HTML', '.htm': 'HTML', '.vue': 'Vue', '.svelte': 'Svelte',
    '.css': 'CSS', '.scss': 'SCSS', '.sass': 'Sass', '.less': 'Less',
    '.yaml': 'YAML', '.yml': 'YAML', '.toml': 'TOML', '.json': 'JSON', '.xml': 'XML',
};

const SOURCE_EXTENSIONS = new Set([
    '.js', '.jsx', '.mjs', '.ts', '.tsx', '.mts',
    '.py', '.pyw', '.pyi', '.java', '.kt', '.kts', '.go',
    '.rb', '.erb', '.cs', '.php', '.rs', '.c', '.h',
    '.cpp', '.hpp', '.cc', '.swift', '.dart', '.scala',
    '.ex', '.exs', '.erl', '.sql', '.prisma', '.graphql', '.gql',
    '.proto', '.html', '.htm', '.vue', '.svelte',
]);

export function detectLanguage(filePath: string): string | null {
    const ext = '.' + filePath.split('.').pop()!.toLowerCase();
    return EXTENSION_MAP[ext] || null;
}

export function isSourceFile(filePath: string): boolean {
    const ext = '.' + filePath.split('.').pop()!.toLowerCase();
    return SOURCE_EXTENSIONS.has(ext);
}

export { EXTENSION_MAP, SOURCE_EXTENSIONS };
