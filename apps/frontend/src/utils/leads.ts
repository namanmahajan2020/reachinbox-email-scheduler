export function parseLeads(text:string):string[]{
  return [...new Set(text.split(/[\n,;\t]+/).map(value=>value.trim()).filter(value=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
}
