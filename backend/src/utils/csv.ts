export function csvCell(value: string | number | null | undefined, separator = ',') {
  const text = value === null || value === undefined ? '' : String(value)
  if (text.includes('"') || text.includes('\n') || text.includes('\r') || text.includes(separator)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
  separator = ',',
) {
  const lines = [
    headers.map((header) => csvCell(header, separator)).join(separator),
    ...rows.map((row) => row.map((cell) => csvCell(cell, separator)).join(separator)),
  ]
  const body = lines.join('\r\n')
  return separator === ';' ? `\uFEFFsep=;\r\n${body}` : `\uFEFF${body}`
}

export function asciiDownloadFilename(name: string, extension: string) {
  const stem = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${stem || 'download'}.${extension}`
}
