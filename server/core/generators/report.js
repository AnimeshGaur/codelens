import fs from 'fs';
import path from 'path';
import { generateComponentDiagram } from './component-diagram.js';
import { generateClassDiagram } from './class-diagram.js';
import { generateDbDiagram } from './db-diagram.js';
import { generateEndpointDiagram } from './endpoint-diagram.js';
import { generateExternalApiDiagram } from './external-api-diagram.js';
import { generateFlowDiagram } from './flow-diagram.js';
import { generateArchitectureDiagram } from './architecture-diagram.js';

/**
 * Generate all diagrams and produce the final report.
 * @param {object} model    The aggregated codebase model
 * @param {object} overview Project overview from LLM
 * @param {object} config   User config
 * @returns {{ markdown: string, diagrams: object }}
 */
export function generateReport(model, overview, config) {
  const enabledDiagrams = new Set(
    config.diagrams || ['component', 'class', 'db', 'endpoint', 'external', 'flow', 'architecture'],
  );

  const diagrams = {};

  if (enabledDiagrams.has('component')) {
    diagrams.component = generateComponentDiagram(model.components);
  }
  if (enabledDiagrams.has('class')) {
    diagrams.class = generateClassDiagram(model.classes);
  }
  if (enabledDiagrams.has('db')) {
    diagrams.db = generateDbDiagram(model.database);
  }
  if (enabledDiagrams.has('endpoint')) {
    diagrams.endpoint = generateEndpointDiagram(model.endpoints);
  }
  if (enabledDiagrams.has('external')) {
    diagrams.external = generateExternalApiDiagram(model.externalAPIs);
  }
  if (enabledDiagrams.has('flow')) {
    diagrams.flow = generateFlowDiagram(model.dependencyFlows);
  }
  if (enabledDiagrams.has('architecture')) {
    diagrams.architecture = generateArchitectureDiagram(model.architecture);
  }

  // Build the markdown report
  const projectName = overview?.projectName || 'Codebase';
  const sections = [];

  sections.push(`# 📊 CodeLens Report — ${projectName}\n`);
  sections.push(`> Generated on ${new Date().toLocaleString()}\n`);

  if (overview) {
    sections.push('## 📋 Project Overview\n');
    sections.push(`| Property | Value |`);
    sections.push(`|----------|-------|`);
    if (overview.projectType) sections.push(`| **Type** | ${overview.projectType} |`);
    if (overview.primaryLanguage) {
      sections.push(`| **Primary Language** | ${overview.primaryLanguage} |`);
    }
    if (overview.frameworks?.length) {
      sections.push(`| **Frameworks** | ${overview.frameworks.join(', ')} |`);
    }
    if (overview.summary) sections.push(`\n${overview.summary}\n`);
  }

  // Architecture summary
  if (model.architecture?.summary) {
    sections.push('## 🏗️ Architecture Summary\n');
    sections.push(model.architecture.summary + '\n');

    if (model.architecture.patterns?.length > 0) {
      sections.push(`**Patterns:** ${model.architecture.patterns.join(', ')}\n`);
    }

    const ts = model.architecture.techStack;
    if (ts) {
      const parts = [];
      if (ts.languages?.length) parts.push(`**Languages:** ${ts.languages.join(', ')}`);
      if (ts.frameworks?.length) parts.push(`**Frameworks:** ${ts.frameworks.join(', ')}`);
      if (ts.databases?.length) parts.push(`**Databases:** ${ts.databases.join(', ')}`);
      if (ts.messageBrokers?.length) {
        parts.push(`**Message Brokers:** ${ts.messageBrokers.join(', ')}`);
      }
      if (parts.length) sections.push(parts.join(' | ') + '\n');
    }
  }

  sections.push('---\n');

  if (diagrams.architecture) {
    sections.push('## 🏗️ Architecture Overview\n');
    sections.push(diagrams.architecture + '\n');
  }
  if (diagrams.component) {
    sections.push('## 📦 Component Diagram\n');
    sections.push(diagrams.component + '\n');
  }
  if (diagrams.class) {
    sections.push('## 🏛️ Class Diagram\n');
    sections.push(diagrams.class + '\n');
  }
  if (diagrams.db) {
    sections.push('## 🗄️ Database Schema\n');
    sections.push(diagrams.db + '\n');
  }
  if (diagrams.endpoint) {
    sections.push('## 🌐 API Endpoints\n');
    sections.push(diagrams.endpoint + '\n');
  }
  if (diagrams.external) {
    sections.push('## 🔌 External Dependencies\n');
    sections.push(diagrams.external + '\n');
  }
  if (diagrams.flow) {
    sections.push('## 🔄 Dependency Flows\n');
    sections.push(diagrams.flow + '\n');
  }

  // Security surface detail
  const sec = model.architecture?.securitySurface;
  if (sec && (sec.protectedEndpoints?.length || sec.unprotectedEndpoints?.length)) {
    sections.push('## 🔒 Security Surface\n');
    sections.push(`**Authentication:** ${sec.authMechanism || 'Not identified'}\n`);

    if (sec.protectedEndpoints?.length) {
      sections.push('**Protected Endpoints:**');
      sec.protectedEndpoints.forEach(ep => sections.push(`- 🛡️ \`${ep}\``));
      sections.push('');
    }
    if (sec.unprotectedEndpoints?.length) {
      sections.push('**⚠️ Unprotected Endpoints:**');
      sec.unprotectedEndpoints.forEach(ep => sections.push(`- ⚠️ \`${ep}\``));
      sections.push('');
    }
    if (sec.dbWritePaths?.length) {
      sections.push('**DB Write Paths:**');
      sec.dbWritePaths.forEach(p => sections.push(`- ✏️ \`${p}\``));
      sections.push('');
    }
  }

  // Stats footer
  sections.push('---\n');
  sections.push('## 📈 Stats\n');
  sections.push(`| Metric | Count |`);
  sections.push(`|--------|-------|`);
  sections.push(`| Components | ${model.components?.length || 0} |`);
  sections.push(`| Classes | ${model.classes?.length || 0} |`);
  sections.push(`| DB Models | ${model.database?.models?.length || 0} |`);
  sections.push(`| Endpoints | ${model.endpoints?.length || 0} |`);
  sections.push(`| External APIs | ${model.externalAPIs?.length || 0} |`);
  sections.push(`| Dependency Flows | ${model.dependencyFlows?.length || 0} |`);

  sections.push('\n---\n*Generated by [CodeLens](https://github.com/codelens)*');

  const markdown = sections.join('\n');

  return { markdown, diagrams };
}

/**
 * Write the report and individual .mmd files to the output directory.
 * @param {string} outputDir
 * @param {string} markdown
 * @param {object} diagrams
 */
export function writeReport(outputDir, markdown, diagrams) {
  fs.mkdirSync(outputDir, { recursive: true });

  // Main report
  fs.writeFileSync(path.join(outputDir, 'codelens-report.md'), markdown);

  // Individual .mmd files
  const mmdDir = path.join(outputDir, 'diagrams');
  fs.mkdirSync(mmdDir, { recursive: true });

  for (const [name, content] of Object.entries(diagrams)) {
    // Extract just the mermaid content (strip ```mermaid and ```)
    const mmdContent = content
      .replace(/```mermaid\n/g, '')
      .replace(/\n```/g, '')
      .trim();
    fs.writeFileSync(path.join(mmdDir, `${name}.mmd`), mmdContent);
  }

  // Write the raw aggregated model as JSON for the HTML viewer
  fs.writeFileSync(path.join(outputDir, 'codelens-data.json'), JSON.stringify(diagrams, null, 2));
}
