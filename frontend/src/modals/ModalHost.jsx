import { useLedger } from '../context/LedgerContext';
import CreateAccountModal from './CreateAccountModal';
import TransactionModal from './TransactionModal';
import TransferModal from './TransferModal';

/** Renders whichever modal is open in LedgerContext. */
export default function ModalHost() {
  const { modal, closeModal } = useLedger();
  const name = modal?.name;
  const props = modal?.props ?? {};

  return (
    <>
      <CreateAccountModal open={name === 'create-account'} onClose={closeModal} />
      <TransactionModal open={name === 'transaction'} onClose={closeModal} account={props.account} initialType={props.initialType} />
      <TransferModal open={name === 'transfer'} onClose={closeModal} fromAccountId={props.fromAccountId} />
    </>
  );
}
