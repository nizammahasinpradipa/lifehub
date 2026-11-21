import type { Category, Transaction, Wallet } from '../types/models';

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportTransactionsToCsv(
  transactions: Transaction[],
  wallets: Wallet[],
  categories: Category[]
): void {
  const walletMap = new Map(wallets.map((w) => [w.id, w.name]));
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const headers = [
    'Date',
    'Type',
    'Amount (IDR)',
    'Category',
    'Wallet',
    'Destination Wallet',
    'Merchant',
    'Note',
  ];

  const active = transactions
    .filter((t) => !t.deleted_at)
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  const rows = active.map((tx) => [
    tx.date,
    tx.type,
    tx.amount,
    tx.category_id ? catMap.get(tx.category_id) || '' : '',
    walletMap.get(tx.wallet_id) || '',
    tx.destination_wallet_id ? walletMap.get(tx.destination_wallet_id) || '' : '',
    tx.merchant,
    tx.note,
  ]);

  const csvContent = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `lifehub-transactions-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
