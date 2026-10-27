import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, Dices, Receipt } from 'lucide-react';
import Modal from '../components/Modal';
import { Button, Field, Input, SegmentedControl } from '../components/ui';
import { api, fieldErrors } from '../lib/api';
import { amountError, currencySymbol, formatMoney, newReference } from '../lib/format';
import { useLedger } from '../context/LedgerContext';

const TYPE_OPTIONS = [
  { value: 'credit', label: 'Credit', icon: ArrowDownLeft, activeClass: 'bg-emerald-500/20 ring-1 ring-emerald-400/40' },
  { value: 'debit', label: 'Debit', icon: ArrowUpRight, activeClass: 'bg-rose-500/20 ring-1 ring-rose-400/40' },
];

export default function TransactionModal({ open, onClose, account, initialType = 'credit' }) {
  const { refresh } = useLedger();
  const [type, setType] = useState(initialType);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState(newReference());
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType(initialType);
      setAmount('');
      setDescription('');
      setReference(newReference());
      setErrors({});
    }
  }, [open, initialType]);

  const credit = type === 'credit';

  async function submit(e) {
    e.preventDefault();
    const next = {};
    const amtErr = amountError(amount);
    if (amtErr) next.amount = amtErr;
    if (!reference.trim()) next.reference_id = 'Reference ID is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await api.createTransaction(account.id, {
        type,
        amount: Number(amount),
        description: description.trim() || undefined,
        reference_id: reference.trim(),
      });
      toast.success(`${credit ? 'Credited' : 'Debited'} ${formatMoney(res.data.amount)}`, {
        description: `New balance ${formatMoney(res.meta.balance)}`,
      });
      refresh();
      onClose();
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        setErrors({ amount: `Insufficient balance. Available: ${formatMoney(err.details?.balance ?? account.balance)}` });
      } else if (err.code === 'DUPLICATE_TRANSACTION') {
        setErrors({ reference_id: 'This reference ID was already used on this account' });
        toast.error('Duplicate transaction', { description: 'Nothing was charged. Generate a new reference to retry.' });
      } else {
        const fields = fieldErrors(err);
        if (Object.keys(fields).length) setErrors(fields);
        else toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New transaction"
      subtitle={account ? `${account.name} · Balance ${formatMoney(account.balance)}` : ''}
      icon={Receipt}
      accent={credit ? 'from-emerald-500 to-teal-500' : 'from-rose-500 to-orange-500'}
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} layoutId="txn-type" className="w-full" />

        <Field label="Amount" error={errors.amount} hint="Up to 2 decimals">
          <Input
            autoFocus
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0.00"
            prefix={currencySymbol}
            value={amount}
            invalid={Boolean(errors.amount)}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((s) => ({ ...s, amount: undefined }));
            }}
            className="text-lg"
          />
        </Field>

        <Field label="Description" hint="Optional" error={errors.description}>
          <Input
            value={description}
            maxLength={500}
            placeholder={credit ? 'e.g. Salary for October' : 'e.g. Electricity bill'}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>

        <Field label="Reference ID" hint="Prevents duplicate submissions" error={errors.reference_id}>
          <Input
            value={reference}
            maxLength={100}
            invalid={Boolean(errors.reference_id)}
            className="font-mono"
            onChange={(e) => {
              setReference(e.target.value);
              setErrors((s) => ({ ...s, reference_id: undefined }));
            }}
            suffix={
              <button
                type="button"
                title="Generate a new reference"
                onClick={() => {
                  setReference(newReference());
                  setErrors((s) => ({ ...s, reference_id: undefined }));
                }}
                className="rounded-lg p-2 text-slate-400 transition-all hover:rotate-45 hover:bg-white/10 hover:text-white"
              >
                <Dices className="size-4" />
              </button>
            }
          />
        </Field>

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={credit ? 'credit' : 'debit'} loading={submitting}>
            {credit ? 'Credit account' : 'Debit account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
