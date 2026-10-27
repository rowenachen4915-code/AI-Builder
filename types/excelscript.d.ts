declare namespace ExcelScript {
  interface Workbook { getWorksheets(): Worksheet[]; getWorksheet(n: string): Worksheet | undefined; addWorksheet(n?: string): Worksheet; getTable(n: string): Table | undefined; }
  interface Worksheet { getName(): string; getUsedRange(valuesOnly?: boolean): Range | undefined; getRange(a?: string): Range; getRangeByIndexes(r: number, c: number, rc: number, cc: number): Range; getCell(r: number, c: number): Range; addTable(a: Range | string, h: boolean): Table; }
  interface Range { getValues(): (string | number | boolean)[][]; getFormulas(): (string | number | boolean)[][]; setValues(v: (string | number | boolean)[][]): void; setValue(v: string | number | boolean): void; getRowIndex(): number; getColumnIndex(): number; getFormat(): RangeFormat; setNumberFormatLocal(f: string): void; }
  interface RangeFormat { getFont(): RangeFont; autofitColumns(): void; }
  interface RangeFont { setBold(b: boolean): void; }
  interface Table { setName(n: string): void; addRows(i?: number, v?: (string | number | boolean)[][]): void; resize(r: Range | string): void; }
}
declare const console: { log(...a: (string | number | boolean | object)[]): void };
