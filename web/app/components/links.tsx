import { ensProfileUrl, explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import { shortAddress, shortHash } from "@/lib/format";

// Tx hash -> Arc explorer. Monospace, neutral, underline-on-hover.
export function TxLink({ hash, className = "" }: { hash: string; className?: string }) {
  return (
    <a
      href={explorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className={`mono text-[12px] text-muted underline decoration-border decoration-from-font underline-offset-2 transition-colors hover:text-fg hover:decoration-faint ${className}`}
    >
      {shortHash(hash)}
    </a>
  );
}

// Address -> Arc explorer.
export function AddressLink({
  address,
  className = "",
}: {
  address: string;
  className?: string;
}) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      title={address}
      className={`mono text-[12px] text-muted underline decoration-border underline-offset-2 transition-colors hover:text-fg hover:decoration-faint ${className}`}
    >
      {shortAddress(address)}
    </a>
  );
}

// ENS name -> ENS app profile. Names render everywhere a name exists.
export function EnsLink({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <a
      href={ensProfileUrl(name)}
      target="_blank"
      rel="noreferrer"
      title={`Resolve ${name} on ENS`}
      className={`mono font-medium text-fg-soft underline decoration-border underline-offset-2 transition-colors hover:text-fg hover:decoration-faint ${className}`}
    >
      {name}
    </a>
  );
}
