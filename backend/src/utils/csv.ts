export function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function toCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
) {
  const lines = [
    headers.map((header) => csvCell(header)).join(','),
    ...rows.map((row) => row.map((cell) => csvCell(cell)).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function asciiDownloadFilename(name: string, extension: string) {
  const stem = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${stem || 'download'}.${extension}`
}
