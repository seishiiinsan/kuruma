import { ShieldAlert } from "lucide-react";
import { getAccount } from "@/lib/game";
import { MAX_TRADE_RATIO, PAIR_PER_WEEK, TRADES_PER_DAY, YOUNG_ACCOUNT_DAYS, marketBlockText, tradeBlockText } from "@/lib/trust";

/** Why trades or the market are closed, or the limits a young account trades under. */
export async function TrustNotice({ showLimits = false, market = false }: { showLimits?: boolean; market?: boolean }) {
  const account = await getAccount();
  const blocked = market ? marketBlockText(account) : tradeBlockText(account);
  if (!blocked && !(showLimits && account?.young)) return null;

  return (
    <div className="panel-sunken mb-8 flex items-start gap-3 px-4 py-3.5 text-sm sm:px-5">
      <ShieldAlert className={`mt-0.5 size-5 shrink-0 ${blocked ? "text-danger" : "text-blue"}`} aria-hidden />
      <p className="text-pretty text-muted">
        {blocked ?? (
          <>
            Compte de moins de {YOUNG_ACCOUNT_DAYS} jours : les deux côtés d&apos;un échange restent à moins de{" "}
            {MAX_TRADE_RATIO}× l&apos;un de l&apos;autre à la cote.
          </>
        )}{" "}
        <span className="text-muted/80">
          Pour tous : {TRADES_PER_DAY} échanges par 24 h, {PAIR_PER_WEEK} affaires par semaine avec un même joueur.
          Ces règles protègent la cote contre les comptes multiples.
        </span>
      </p>
    </div>
  );
}
