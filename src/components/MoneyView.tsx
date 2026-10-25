import React, { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  Project,
  Transaction,
  TransactionType,
} from '../types/studioos.ts';

interface MoneyViewProps {
  transactions: Transaction[];
  projects: Project[];
  loading: boolean;
  initialOpenCreate?: boolean;
  onClearInitialCreate?: () => void;
  onCreateTransaction: (data: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
}

const INCOME_CATEGORIES = [
  'Client Development',
  'Monthly Service Retainer',
  'App Store Revenue',
  'SaaS Subscription',
  'Consulting & Advisory',
  'Other Income',
];

const EXPENSE_CATEGORIES = [
  'Infrastructure & Hosting',
  'Software & Subscriptions',
  'AI & API Usage',
  'Contractor / Design',
  'Marketing & Distribution',
  'Legal & Administrative',
  'Other Expense',
];

function formatMoney(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const MoneyView: React.FC<MoneyViewProps> = ({
  transactions,
  projects,
  loading,
  initialOpenCreate,
  onClearInitialCreate,
  onCreateTransaction,
  onDeleteTransaction,
}) => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = today.slice(0, 7);

  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [showForm, setShowForm] = useState<boolean>(Boolean(initialOpenCreate));
  const [saving, setSaving] = useState(false);

  // Manual entry state
  const [type, setType] = useState<TransactionType>(TransactionType.Income);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [transactionDate, setTransactionDate] = useState(today);
  const [projectId, setProjectId] = useState('');
  const [client, setClient] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpenForm = (defaultType: TransactionType = TransactionType.Income) => {
    setType(defaultType);
    setCategory(
      defaultType === TransactionType.Income ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    );
    setAmount('');
    setDescription('');
    setTransactionDate(today);
    setProjectId('');
    setClient('');
    setNotes('');
    setShowForm(true);
    if (onClearInitialCreate) onClearInitialCreate();
  };

  const handleTypeChange = (nextType: TransactionType) => {
    setType(nextType);
    setCategory(
      nextType === TransactionType.Income ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = Number(amount);
    if (!amount || Number.isNaN(numericAmount) || numericAmount <= 0) return;

    setSaving(true);
    try {
      await onCreateTransaction({
        type,
        amount: numericAmount,
        category: category.trim() || 'General',
        description: description.trim(),
        transaction_date: transactionDate || today,
        project_id: projectId || null,
        client: client.trim() || null,
        notes: notes.trim() || null,
      });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  // Monthly calculations
  const monthlyTransactions = transactions.filter((tx) =>
    tx.transaction_date.startsWith(currentMonthPrefix)
  );
  const monthlyIncome = monthlyTransactions
    .filter((tx) => tx.type === TransactionType.Income)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const monthlyExpenses = monthlyTransactions
    .filter((tx) => tx.type === TransactionType.Expense)
    .reduce((sum, tx) => sum + Number(tx.amount), 0);
  const netIncome = monthlyIncome - monthlyExpenses;

  const totalUnbilled = projects
    .filter((p) => p.status !== 'Archived' && p.status !== 'Completed')
    .reduce((sum, p) => sum + Number(p.unbilled_amount || 0), 0);

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== 'ALL' && tx.type !== typeFilter) return false;
    return true;
  });

  const categoriesList =
    type === TransactionType.Income ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Financial Activity</h2>
          <p className="text-sm text-slate-600">
            Manual income and expense ledger for BGP Studios (Version 0.1).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenForm(TransactionType.Income)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Income</span>
          </button>
          <button
            onClick={() => handleOpenForm(TransactionType.Expense)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Expense</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Totals */}
      <div className="bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="p-5">
          <div className="text-xs text-slate-500">Monthly Income ({currentMonthPrefix})</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {formatMoney(monthlyIncome)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Recorded client retainers &amp; milestones
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">Monthly Expenses ({currentMonthPrefix})</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-900">
            {formatMoney(monthlyExpenses)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Hosting, Apple Developer, API &amp; ops
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">Net Income ({currentMonthPrefix})</div>
          <div
            className={`mt-2 text-2xl font-bold font-mono tabular-nums ${
              netIncome >= 0 ? 'text-slate-900' : 'text-red-700'
            }`}
          >
            {netIncome >= 0 ? `+${formatMoney(netIncome)}` : formatMoney(netIncome)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Monthly cash operating margin
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs text-slate-500">Unbilled / Outstanding Work</div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {formatMoney(totalUnbilled)}
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Accrued on active client projects
          </div>
        </div>
      </div>

      {/* Manual Transaction Entry Form */}
      {showForm && (
        <div className="bg-white border border-slate-300 rounded-xl p-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-4">
            <h3 className="text-base font-semibold text-slate-900">
              Record Financial Transaction
            </h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-700 cursor-pointer"
              aria-label="Close transaction form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Type *
              </label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => handleTypeChange(TransactionType.Income)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    type === TransactionType.Income
                      ? 'bg-white text-emerald-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange(TransactionType.Expense)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    type === TransactionType.Expense
                      ? 'bg-white text-red-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expense
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (USD) *
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Transaction Date *
              </label>
              <input
                type="date"
                required
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="w-full px-3 py-2 text-sm font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Project (Optional)
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="">— General Studio —</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Client (Optional)
              </label>
              <input
                type="text"
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g., Diana / Mars Roofing"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description *
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Monthly web maintenance retainer"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes (Optional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional billing or invoice note"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="md:col-span-3 flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
              >
                {saving ? 'Recording...' : `Save ${type}`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Bar & Transactions Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
            {[
              { id: 'ALL', label: 'All Activity' },
              { id: TransactionType.Income, label: 'Income Only' },
              { id: TransactionType.Expense, label: 'Expenses Only' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setTypeFilter(tab.id as 'ALL' | TransactionType)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  typeFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <span className="text-xs font-mono tabular-nums text-slate-500">
            Showing {filteredTransactions.length} transaction
            {filteredTransactions.length === 1 ? '' : 's'}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Loading financial activity...
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <p className="text-sm font-medium text-slate-900">
              No transactions recorded for this view.
            </p>
            <p className="text-xs text-slate-500">
              Use Record Income or Record Expense above to log activity.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs text-slate-500 bg-slate-50/60">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Type · Category</th>
                  <th className="py-3 px-4 font-medium">Description &amp; Notes</th>
                  <th className="py-3 px-4 font-medium">Project / Client</th>
                  <th className="py-3 px-4 font-medium text-right">Amount</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTransactions.map((tx) => {
                  const isIncome = tx.type === TransactionType.Income;
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-slate-50/70 transition-colors align-top"
                    >
                      <td className="py-3.5 px-4 text-xs font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {tx.transaction_date}
                      </td>

                      <td className="py-3.5 px-4 text-xs whitespace-nowrap">
                        <span
                          className={
                            isIncome
                              ? 'text-emerald-700 font-semibold'
                              : 'text-slate-700 font-medium'
                          }
                        >
                          {tx.type}
                        </span>
                        <span aria-hidden="true" className="mx-1.5 text-slate-300">
                          ·
                        </span>
                        <span className="text-slate-600">{tx.category}</span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">{tx.description}</div>
                        {tx.notes && (
                          <div className="text-xs text-slate-500 mt-0.5 max-w-md">
                            {tx.notes}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        <div>{tx.project_name || 'General Studio'}</div>
                        {tx.client && (
                          <div className="text-slate-500">Client: {tx.client}</div>
                        )}
                      </td>

                      <td
                        className={`py-3.5 px-4 text-sm font-mono tabular-nums font-semibold text-right whitespace-nowrap ${
                          isIncome ? 'text-emerald-700' : 'text-slate-900'
                        }`}
                      >
                        {isIncome ? '+' : '-'}
                        {formatMoney(tx.amount)}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => onDeleteTransaction(tx.id)}
                          className="p-1.5 text-slate-400 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                          title="Delete transaction"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
