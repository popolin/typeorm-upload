import csvParse from 'csv-parse';
import fs from 'fs';

import { getCustomRepository, getRepository, In } from 'typeorm';

import TransactionsRepository from '../repositories/TransactionsRepository';
import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface TransactionCSV {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filepath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    const fsReadStream = fs.createReadStream(filepath);
    const parsers = csvParse({
      from_line: 2,
    });
    const parseCsv = fsReadStream.pipe(parsers);

    const categories: string[] = [];
    const transactions: TransactionCSV[] = [];

    parseCsv.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );
      // Não utilizar quando o registro estiver incompleto
      if (!title || !type || !value) {
        return;
      }

      categories.push(category);
      transactions.push({ title, type, value, category });
    });
    // Promise para aguardar a conclusão da leitura do arquivo
    await new Promise(resolve => parseCsv.on('end', resolve));

    const finalCategories = await this.findPersistCategories(categories);

    const addTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(addTransactions);
    await fs.promises.unlink(filepath);

    return addTransactions;
  }

  // Retorna categorias recebidas que já estão persistidas
  private async findPersistCategories(
    categories: string[],
  ): Promise<Category[]> {
    const categoriesReposigory = getRepository(Category);

    const noDuplicatedCategories = categories.filter(
      (category, index) => categories.indexOf(category) === index,
    );

    const registeredCategories = await categoriesReposigory.find({
      where: { title: In(noDuplicatedCategories) },
    });

    const registeredCategoriesTitle = registeredCategories.map(
      category => category.title,
    );
    const addCategoryTitles = noDuplicatedCategories.filter(
      category => !registeredCategoriesTitle.includes(category),
    );

    const newCategories = categoriesReposigory.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoriesReposigory.save(newCategories);

    return [...registeredCategories, ...newCategories];
  }
}

export default ImportTransactionsService;
