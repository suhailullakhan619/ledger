import { useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import Modal from '../components/Modal';
import { Button, Field, Input } from '../components/ui';
import { api, fieldErrors } from '../lib/api';
import { useLedger } from '../context/LedgerContext';

export default function CreateAccountModal({ open, onClose }) {
  const { refresh } = useLedger();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    setName('');
    setError(null);
    onClose();
  };

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Account holder name is required');
      return;
    }
    setSubmitting(true);
    try {
      const account = await api.createAccount(name.trim());
      toast.success(`Account created for ${account.name}`, { description: 'Starting balance is 0.00' });
      refresh();
      close();
      navigate(`/accounts/${account.id}`);
    } catch (err) {
      const fields = fieldErrors(err);
      if (fields.name) setError(fields.name);
      else toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={close} title="Open a new account" subtitle="Balance always starts at zero." icon={UserPlus}>
      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field label="Account holder name" error={error}>
          <Input
            autoFocus
            value={name}
            maxLength={200}
            placeholder="e.g. Priya Sharma"
            invalid={Boolean(error)}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Create account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
