import { ensProfileUrl, explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import { shortAddress, shortHash } from "@/lib/format";

// Tx hash -> Arc explorer. Monospace, underline-on-hover only (no glow).
export function TxLink({ hash, className = "" }: { hash: string; className?: string }) {
  return (
    <a
      href={explorerTxUrl(hash)}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className={`mono text-[11px] text-muted underline decoration-border underline-offset-2 hover:text-text hover:decoration-text ${className}`}
    >
      {shortHash(hash)}
    </a>
  );
}

// Address -> Arc explorer.
export function AddressLink({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noreferrer"
      title={address}
      className="mono text-[11px] text-muted underline decoration-border underline-offset-2 hover:text-text"
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
      className={`mono text-text underline decoration-border underline-offset-2 hover:decoration-text ${className}`}
    >
      {name}
    </a>
  );
}
