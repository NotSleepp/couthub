const path = require('node:path');
const { webUrl } = require('./services/platform');
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Los datos deben ser un objeto.');
  return value;
}
function text(value, label, max = 1000, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim()) || value.includes('\0')) throw new Error(`${label}: valor inválido.`);
  return value.trim();
}
function email(data) {
  object(data);
  const value = text(data.email, 'Correo', 320);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error('La dirección de correo no es válida.');
  if (data.provider && !['gmail', 'outlook', 'other'].includes(data.provider)) throw new Error('Proveedor de correo inválido.');
  if (data.url) webUrl(data.url);
  if (data.provider === 'other' && !data.url) throw new Error('Indicá la URL del proveedor de correo.');
  strings(data);
  return { ...data, email: value };
}
function strings(data) {
  for (const key of ['name', 'label', 'alias', 'notes', 'group_name', 'email', 'project_type', 'remote_url']) {
    if (data[key] !== undefined) text(data[key], key, key === 'notes' ? 20000 : 2000, true);
  }
  if (data.color !== undefined && !/^#[0-9a-f]{6}$/i.test(data.color)) throw new Error('Color inválido; usá #RRGGBB.');
}
function project(data) {
  object(data); strings(data);
  text(data.name, 'Nombre'); text(data.path, 'Ruta', 32767);
  if (!path.isAbsolute(data.path)) throw new Error('La ruta del proyecto debe ser absoluta.');
  return data;
}
module.exports = { object, text, email, project, strings };
