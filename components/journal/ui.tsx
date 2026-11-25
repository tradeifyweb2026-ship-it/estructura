"use client";

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, CandlestickChart, X } from "lucide-react";
import { formatMoney, numberText, rLabel, type Currency, type Setup } from "@/lib/journal";
import { trackDialog } from "@/lib/dialog-history";

export function Brand() {
  return <span className="brand"><span className="brand-mark"><CandlestickChart size={22} /></span><span>Tradeify<span className="brand-caption">TRADING JOURNAL</span></span></span>;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "quiet" | "danger" };
export function Button({ tone, className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`button ${tone ? "button-" + tone : ""} ${className}`} {...props} />;
}

export function Field({ label, children, hint, wide = false }: { label: string; children: ReactNode; hint?: string; wide?: boolean }) {
  return <label className={`field ${wide ? "span-all" : ""}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Panel({ title, description, action, className = "", children }: { title: string; description?: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <section className={`panel ${className}`}>
    <header className="panel-head"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</header>
    {children}
  </section>;
}

export function Empty({ title, description, action, icon }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty">{icon && <span className="empty-icon">{icon}</span>}<strong>{title}</strong>{description && <p>{description}</p>}{action}</div>;
}

const CloseDialogContext = createContext<(() => void) | undefined>(undefined);

export function ModalClose(props: ButtonProps) {
  const close = useContext(CloseDialogContext);
  return <Button {...props} onClick={close}/>;
}

export function Modal({ title, subtitle, onClose, children, footer, busy = false, wide = false, protectDraft = false, hasChanges, presentation = "dialog" }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; busy?: boolean; wide?: boolean; protectDraft?: boolean; hasChanges?:boolean; presentation?: "dialog" | "sheet" | "page";
}) {
  const [discard,setDiscard]=useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const outsidePress = useRef(false);
  const current = useRef({ busy, protectDraft, hasChanges, onClose });
  useLayoutEffect(() => { current.current = { busy, protectDraft, hasChanges, onClose }; }, [busy, protectDraft, hasChanges, onClose]);
  const id = useId();
  const close = useCallback(() => {
    const state = current.current;
    if (state.busy) return;
    if (state.protectDraft && (state.hasChanges ?? dirty.current)) {setDiscard(true);return;}
    state.onClose();
  }, []);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    const untrack = trackDialog(dialog, close);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (current.current.protectDraft && (current.current.hasChanges ?? dirty.current)) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      untrack();
      window.removeEventListener("beforeunload", beforeUnload);
      if (dialog.open) dialog.close();
      window.requestAnimationFrame(() => {
        const top = [...document.querySelectorAll("dialog[open]")].at(-1);
        if (trigger instanceof HTMLElement && trigger.isConnected && (!top || top.contains(trigger))) trigger.focus({ preventScroll: true });
      });
    };
  }, [close]);
  return <CloseDialogContext.Provider value={close}><dialog ref={ref} aria-labelledby={id} className={`dialog ${wide ? "dialog-wide" : ""} dialog-${presentation}`}
    onKeyDown={(event) => {
      if (event.key !== "Tab") return;
      const dialog = event.currentTarget;
      const controls = [...dialog.querySelectorAll<HTMLElement>("button, input, select, textarea, a[href], [tabindex]")]
        .filter((element) => element.tabIndex >= 0 && !element.matches(":disabled") && element.getClientRects().length > 0);
      const target = event.shiftKey ? controls.at(-1) : controls[0];
      const boundary = event.shiftKey ? controls[0] : controls.at(-1);
      if (target && (document.activeElement === boundary || document.activeElement === dialog)) {
        event.preventDefault();
        target.focus();
      }
    }}
    onInputCapture={() => { dirty.current = true; }} onChangeCapture={() => { dirty.current = true; }}
    onClickCapture={(event) => { if ((event.target as Element).closest("form button[type=button], [data-edit-action]")) dirty.current = true; }}
    onPointerDown={(event) => { outsidePress.current = event.target === event.currentTarget; }}
    onPointerUp={(event) => { if (outsidePress.current && event.target === event.currentTarget) close(); outsidePress.current = false; }}
    onCancel={(event) => { event.preventDefault(); close(); }}>
    <header className="dialog-head">
      <div><h2 id={id}>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
      <Button tone="quiet" className="icon-button" aria-label="Cerrar" disabled={busy} onClick={close}><X size={19}/></Button>
    </header>
    <div className="dialog-body">{children}</div>
    {footer && <footer className="dialog-foot">{footer}</footer>}
  </dialog>{discard&&<Modal title="¿Descartar los cambios?" onClose={()=>setDiscard(false)} footer={<><Button onClick={()=>setDiscard(false)} autoFocus>Seguir editando</Button><Button tone="danger" onClick={()=>{setDiscard(false);current.current.onClose();}}>Descartar cambios</Button></>}><p>Los cambios que todavía no guardaste se perderán.</p></Modal>}</CloseDialogContext.Provider>;
}

export function Metric({ label, value, detail, icon, tone = "" }: { label: string; value: ReactNode; detail: ReactNode; icon?: ReactNode; tone?: string }) {
  return <article className="metric">
    <div className="metric-label"><span>{label}</span><span className="metric-symbol">{icon}</span></div>
    <strong className={`metric-value num ${tone}`}>{value}</strong>
    <p>{detail}</p>
  </article>;
}

export const valueTone = (value: number | null) => value === null || Math.abs(value) < 0.000001 ? "muted" : value > 0 ? "positive" : "negative";
export const pct = (value: number | null) => value === null ? "—" : numberText(value) + "%";
export const cashValue = (cents: number | null, currency: Currency | null) => cents === null || !currency ? "—" : formatMoney(cents, currency);
export const resultName = { open: "Abierta", win: "Ganancia", loss: "Pérdida", flat: "Break-even", unknown: "Sin resultado" } as const;

export function SetupTag({ setup }: { setup?: Setup }) {
  return setup ? <span className={`tag setup-tag tag-${setup.color}`}>{setup.name}</span> : <span className="muted">—</span>;
}

export function TradeSide({ direction }: { direction: "long" | "short" }) {
  return direction === "long" ? <span className="tag side-long"><ArrowUpRight size={13}/>Compra</span> : <span className="tag side-short"><ArrowDownRight size={13}/>Venta</span>;
}

export function Result({ value, unit, currency }: { value: number | null; unit: "r" | "money"; currency?: Currency | null }) {
  return <strong className={`num ${valueTone(value)}`}>{unit === "r" ? rLabel(value) : cashValue(value, currency ?? null)}</strong>;
}
