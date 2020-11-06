import csvParse from 'csv-parse';
import path from 'path';
import fs from 'fs';

import uploadConfig from '../config/upload';

import Transaction from '../models/Transaction';

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    const fsReadStream = fs.createReadStream(filepath);
    const parsers = csvParse({
      from_line: 2,
    });
    const parseCsv = fsReadStream.pipe(parsers);
    const transactions: Transaction[] = [];
    const categories = [];

    parseCsv.on('data', async line => {
      const { title, type, value, category } = line.map(
        (cell: string) => cell.trim,
      );

      if (!title || !type || !value) return;

      categories.push(category);
      transactions.push({ title, type, value, category });
    });

    return transactions;
  }
}

export default ImportTransactionsService;
