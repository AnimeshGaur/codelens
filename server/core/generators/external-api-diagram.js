/**
 * Generates a Mermaid graph TD showing external API/service dependencies
 * with URL, SDK, HTTP method, and calling module info.
 *
 * @param {Array} externalAPIs  From the aggregated codebase model
 * @returns {string} Mermaid diagram string (no markdown fences)
 */
export function generateExternalApiDiagram(externalAPIs) {
  if (!externalAPIs || externalAPIs.length === 0) {
    return 'graph TD\n    NoAPIs["No external API calls detected"]';
  }

  const lines = ['graph TD'];

  // Central app node
  lines.push('    App(("Application"))');
  lines.push('    style App fill:#2C3E50,stroke:#1A252F,color:#fff');

  // Group by service
  const services = new Map();
  for (const api of externalAPIs) {
    const service = api.service || api.url || 'Unknown Service';
    if (!services.has(service)) services.set(service, []);
    services.get(service).push(api);
  }

  let svcIdx = 0;
  for (const [service, apis] of services) {
    const svcId = `svc${svcIdx++}`;
    const hasSDK = apis.some(a => a.sdk);

    // Build rich node label
    const urlSample = apis[0].url ? ` | ${sanitize(apis[0].url).substring(0, 40)}` : '';
    const sdkLabel = hasSDK ? ` (${sanitize(apis[0].sdk)})` : ' (HTTP)';
    lines.push(`    ${svcId}["${sanitize(service)}${sdkLabel}${urlSample}"]`);

    // Edge with purpose and method
    const purposes = apis.map(a => a.purpose).filter(Boolean).slice(0, 2);
    const methods = [...new Set(apis.map(a => a.method).filter(Boolean))];
    const edgeParts = [];
    if (methods.length > 0) edgeParts.push(methods.join('/'));
    if (purposes.length > 0) edgeParts.push(purposes.join(', '));
    const edgeLabel = edgeParts.length > 0
      ? ` -- "${sanitize(edgeParts.join(': '))}" -->`
      : ' -->';

    lines.push(`    App${edgeLabel} ${svcId}`);

    // Show calling files as small linked nodes
    const callingFiles = [...new Set(apis.map(a => a.file).filter(Boolean))].slice(0, 3);
    for (let i = 0; i < callingFiles.length; i++) {
      const fileId = `${svcId}_f${i}`;
      const fileName = callingFiles[i].split('/').pop();
      lines.push(`    ${fileId}[/"${sanitize(fileName)}"/]`);
      lines.push(`    style ${fileId} fill:#1e2440,stroke:#3d4f7c,color:#8892b0`);
      lines.push(`    ${fileId} -.-> ${svcId}`);
    }

    // Style: SDK = blue, raw HTTP = orange
    if (hasSDK) {
      lines.push(`    style ${svcId} fill:#3498DB,stroke:#2980B9,color:#fff`);
    } else {
      lines.push(`    style ${svcId} fill:#E67E22,stroke:#D35400,color:#fff`);
    }
  }

  return lines.join('\n');
}

function sanitize(str) {
  return (str || '')
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/"/g, "'")
    .replace(/[[\]\\]/g, '')
    .substring(0, 80)
    .trim();
}
