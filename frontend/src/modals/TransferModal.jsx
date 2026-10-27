import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import { ArrowDownUp, ArrowLeftRight, Dices } from 'lucide-react';
import Modal from '../components/Modal';
import { Button, Field, Input, cx } from '../components/ui';
import { api, fieldErrors } from '../lib/api';
import { amountError, currencySymbol, formatMoney, newReference } from '../lib/format';
import { useLedger } from '../context/LedgerContext';

function AccountSelect({ value, onChange, accounts, exclude, invalid, placeholder }) {
  return (
    <div
      className={cx(
        'flex h-12 items-center rounded-xl border bg-white/[0.03] transition-colors focus-within:border-indigo-400/70',
        invalid ? 'border-rose-500/60' : 'border-white/10 hover:border-white/20',
      )}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full cursor-pointer bg-transparent px-4 text-[15px] text-white outline-none"
      >
        <option value="">{placeholder}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id} disabled={a.id === exclude}>
            {a.name} — {formatMoney(a.balance)}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function TransferModal({ open, onClose, fromAccountId = '' }) {
  const { refresh, version } = useLedger();
  const [accounts, setAccounts] = useState([]);
  const [from, setFrom] = useState(fromAccountId);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState(newReference('TRF'));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [swapTurns, setSwapTurns] = useState(0);

  useEffect(() => {
    if (!open) return;
    setFrom(fromAccountId);
    setTo('');
    setAmount('');
    setDescription('');
    setReference(newReference('TRF'));
    setErrors({});
  }, [open, fromAccountId]);

  useEffect(() => {
    if (!open) return;
    api
      .listAccounts({ limit: 100 })
      .then((r) => setAccounts(r.data))
      .catch((err) => toast.error(err.message));
  }, [open, version]);

  const fromAccount = useMemo(() => accounts.find((a) => a.id === from), [accounts, from]);

  async function submit(e) {
    e.preventDefault();
    const next = {};
    if (!from) next.from_account_id = 'Choose the source account';
    if (!to) next.to_account_id = 'Choose the destination account';
    if (from && to && from === to) next.to_account_id = 'Source and destination must differ';
    const amtErr = amountError(amount);
    if (amtErr) next.amount = amtErr;
    else if (fromAccount && Number(amount) > fromAccount.balance) next.amount = `Insufficient balance. Available: ${formatMoney(fromAccount.balance)}`;
    if (!reference.trim()) next.reference_id = 'Reference ID is required';
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      const res = await api.transfer({
        from_account_id: from,
        to_account_id: to,
        amount: Number(amount),
        description: description.trim() || undefined,
        reference_id: reference.trim(),
      });
      toast.success(`Transferred ${formatMoney(res.transfer.amount)}`, {
        description: `Source now ${formatMoney(res.balances.from_account.balance)} · Destination now ${formatMoney(res.balances.to_account.balance)}`,
      });
      refresh();
      onClose();
    } catch (err) {
      if (err.code === 'INSUFFICIENT_BALANCE') {
        setErrors({ amount: `Insufficient balance. Available: ${formatMoney(err.details?.balance ?? 0)}` });
      } else if (err.code === 'DUPLICATE_TRANSACTION') {
        setErrors({ reference_id: 'This reference ID was already used' });
      } else {
        const fields = fieldErrors(err);
        if (Object.keys(fields).length) setErrors(fields);
        else toast.error(err.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const swap = () => {
    setFrom(to);
    setTo(from);
    setSwapTurns((t) => t + 1);
    setErrors({});
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer money"
      subtitle="Debit and credit happen atomically. All or nothing."
      icon={ArrowLeftRight}
      accent="from-sky-500 to-indigo-500"
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="From" error={errors.from_account_id} hint={fromAccount ? `Available ${formatMoney(fromAccount.balance)}` : undefined}>
          <AccountSelect
            value={from}
            onChange={(v) => {
              setFrom(v);
              setErrors((s) => ({ ...s, from_account_id: undefined, amount: undefined }));
            }}
            accounts={accounts}
            exclude={to}
            invalid={Boolean(errors.from_account_id)}
            placeholder="Select source account"
          />
        </Field>

        <div className="relative -my-1 flex justify-center">
          <motion.button
            type="button"
            onClick={swap}
            animate={{ rotate: swapTurns * 180 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="grid size-9 place-items-center rounded-full border border-white/10 bg-ink-800 text-slate-300 shadow-lg hover:text-white"
            aria-label="Swap accounts"
          >
            <ArrowDownUp className="size-4" />
          </motion.button>
        </div>

        <Field label="To" error={errors.to_account_id}>
          <AccountSelect
            value={to}
            onChange={(v) => {
              setTo(v);
              setErrors((s) => ({ ...s, to_account_id: undefined }));
            }}
            accounts={accounts}
            exclude={from}
            invalid={Boolean(errors.to_account_id)}
            placeholder="Select destination account"
          />
        </Field>

        <Field label="Amount" error={errors.amount}>
          <Input
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
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Description" hint="Optional">
            <Input value={description} maxLength={500} placeholder="e.g. Rent share" onChange={(e) => setDescription(e.target.value)} />
          </Field>
          <Field label="Reference ID" error={errors.reference_id}>
            <Input
              value={reference}
              maxLength={100}
              className="font-mono text-sm"
              invalid={Boolean(errors.reference_id)}
              onChange={(e) => {
                setReference(e.target.value);
                setErrors((s) => ({ ...s, reference_id: undefined }));
              }}
              suffix={
                <button
                  type="button"
                  title="Generate a new reference"
                  onClick={() => setReference(newReference('TRF'))}
                  className="rounded-lg p-2 text-slate-400 transition-all hover:rotate-45 hover:bg-white/10 hover:text-white"
                >
                  <Dices className="size-4" />
                </button>
              }
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting} icon={ArrowLeftRight} disabled={accounts.length < 2}>
            Transfer
          </Button>
        </div>
        {accounts.length < 2 && <p className="text-right text-xs text-slate-500">You need at least two accounts to transfer.</p>}
      </form>
    </Modal>
  );
}
