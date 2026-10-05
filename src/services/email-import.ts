import type { EmailAccount, EmailProvider } from '../types/electron';

function csvRows(input: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { field += '"'; i++; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(field.trim()); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field.trim()); if (row.some(Boolean)) rows.push(row); row = []; field = '';
    } else field += char;
  }
  if (quoted) throw new Error('El CSV contiene comillas sin cerrar.');
  row.push(field.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}
const providerFor = (email: string): EmailProvider => /@(outlook|hotmail|live)\./i.test(email) ? 'outlook' : 'gmail';

export function parseEmailImport(value: string): Partial<EmailAccount>[] {
  const input = value.replace(/^\uFEFF/, '').trim();
  if (!input) throw new Error('Pegá una lista de correos o seleccioná un archivo.');
  if (input.startsWith('[') || input.startsWith('{')) {
    const data = JSON.parse(input);
    return Array.isArray(data) ? data : [data];
  }
  if (!input.split(/\r?\n/, 1)[0].includes(',')) {
    return input.split(/\r?\n/).map(email => email.trim()).filter(Boolean).map(email => ({ email, provider: providerFor(email) }));
  }
  const rows = csvRows(input);
  const headers = rows.shift()!.map(h => h.toLowerCase());
  if (!headers.includes('email')) throw new Error('El CSV debe tener una columna email en la primera fila.');
  const allowed = new Set(['email', 'name', 'alias', 'provider', 'group_name', 'group', 'notes', 'url', 'color', 'favorite']);
  if (headers.some(h => !allowed.has(h)) || new Set(headers).size !== headers.length) throw new Error('El CSV tiene columnas desconocidas o repetidas.');
  return rows.map((row, index) => {
    if (row.length !== headers.length) throw new Error(`La fila ${index + 2} del CSV tiene una cantidad incorrecta de columnas.`);
    const item: Record<string, string | number> = {};
    headers.forEach((key, i) => { item[key === 'group' ? 'group_name' : key] = key === 'favorite' ? (/^(1|true|sí|si)$/i.test(row[i]) ? 1 : 0) : row[i]; });
    if (!item.provider) item.provider = providerFor(String(item.email));
    return item as Partial<EmailAccount>;
  });
}
